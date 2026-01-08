package com.external.plugins.actions;

import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginError;
import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginException;
import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionExecutionResult;
import com.external.plugins.utils.ContentSanitizer;
import com.external.plugins.utils.HtmlTemplateUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static com.appsmith.external.helpers.PluginUtils.OBJECT_TYPE;
import static com.appsmith.external.helpers.PluginUtils.STRING_TYPE;
import static com.appsmith.external.helpers.PluginUtils.getDataValueSafelyFromFormData;
import static com.external.plugins.DaouofficeConstants.*;

@Slf4j
public class MailAction implements BaseAction {

    private final ObjectMapper objectMapper;

    public MailAction(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getActionIdentifier() {
        return ACTION_SEND_MAIL;
    }

    @Override
    public Mono<ActionExecutionResult> execute(WebClient connection, ActionConfiguration actionConfiguration) {
        ActionExecutionResult result = new ActionExecutionResult();

        try {
            String senderName = DEFAULT_SENDER_NAME;
            String senderEmail = DEFAULT_SENDER_EMAIL;
            String toStrRaw = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "to", STRING_TYPE, "");
            String subjectRaw = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "subject", STRING_TYPE, "");

            String mailType = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "mail_type", STRING_TYPE, MAIL_TYPE_LEAD_REGISTRATION);
            log.debug("mailType: {}", mailType);

            // Determine content based on mail type
            String finalTo;
            String finalSubject;
            String finalContents;

            if (MAIL_TYPE_PLAIN.equals(mailType)) {
                finalTo = StringUtils.hasText(toStrRaw) ? toStrRaw : "";
                finalSubject = StringUtils.hasText(subjectRaw) ? subjectRaw : "";
                String contentRaw = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "content", STRING_TYPE, "");
                // Sanitize Base64 image content in HTML
                String sanitizedContent = ContentSanitizer.sanitizeHtmlContent(contentRaw);
                finalContents = StringUtils.hasText(sanitizedContent) ? sanitizedContent : "";
            } else {
                // leadRegistrationMail and fallback
                finalTo = StringUtils.hasText(toStrRaw) ? toStrRaw : "";
                finalSubject = StringUtils.hasText(subjectRaw) ? subjectRaw : "";
                finalContents = HtmlTemplateUtils.getLeadRegistrationTemplate();
            }

            // Get additional options
            String editmode = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "editmode", STRING_TYPE, "html");
            String envFromAddr = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "envFromAddr", STRING_TYPE, "");
            Object withoutNotiObj = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "withoutNoti", OBJECT_TYPE, "false");
            String withoutNotiStr = String.valueOf(withoutNotiObj);

            String targetUrl = "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + MAIL_SEND_PATH;

            log.info("Daouoffice Mail Send Request URL: {}", targetUrl);
            log.info("Daouoffice Mail Send Request TO: {}", finalTo);
            log.info("Daouoffice Mail Send Request SUBJECT: {}", finalSubject);
            log.debug("Daouoffice Mail Send Request CONTENT: {}", finalContents);

            // Build form data
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("senderName", senderName);
            formData.add("senderEmail", senderEmail);
            formData.add("subject", finalSubject);
            formData.add("contents", finalContents);
            formData.add("editmode", editmode);
            formData.add("withoutNoti", String.valueOf("true".equalsIgnoreCase(withoutNotiStr)));

            if (StringUtils.hasText(envFromAddr)) {
                formData.add("envFromAddr", envFromAddr);
            }

            // Handle multiple recipients
            if (StringUtils.hasText(finalTo)) {
                String[] emails = finalTo.split(",");
                for (String email : emails) {
                    if (StringUtils.hasText(email.trim())) {
                        formData.add("to", email.trim());
                    }
                }
            }

            log.debug("Daouoffice Mail Send Request Body: {}", formData);

            return connection
                    .post()
                    .uri(uriBuilder -> uriBuilder
                            .scheme("http")
                            .host(SERVICE_GATEWAY_HOST)
                            .port(SERVICE_GATEWAY_PORT)
                            .path(MAIL_SEND_PATH)
                            .build())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromValue(formData))
                    .retrieve()
                    .bodyToMono(String.class)
                    .map(responseBody -> {
                        try {
                            result.setIsExecutionSuccess(true);
                            result.setBody(objectMapper.readTree(responseBody));
                        } catch (Exception e) {
                            result.setIsExecutionSuccess(true);
                            result.setBody(responseBody);
                        }
                        return result;
                    })
                    .onErrorResume(error -> {
                        log.error("Mail send failed", error);
                        result.setIsExecutionSuccess(false);
                        result.setErrorInfo(new AppsmithPluginException(
                                AppsmithPluginError.PLUGIN_ERROR, "Mail Send Failed: " + error.getMessage()));
                        return Mono.just(result);
                    });

        } catch (Exception e) {
            log.error("Error preparing mail request", e);
            result.setIsExecutionSuccess(false);
            result.setErrorInfo(new AppsmithPluginException(
                    AppsmithPluginError.PLUGIN_ERROR, "Error preparing mail request: " + e.getMessage()));
            return Mono.just(result);
        }
    }
}
