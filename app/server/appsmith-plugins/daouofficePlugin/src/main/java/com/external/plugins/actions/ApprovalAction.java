package com.external.plugins.actions;

import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginError;
import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginException;
import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionExecutionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static com.appsmith.external.helpers.PluginUtils.STRING_TYPE;
import static com.appsmith.external.helpers.PluginUtils.getDataValueSafelyFromFormData;
import static com.external.plugins.DaouofficeConstants.*;

@Slf4j
public class ApprovalAction implements BaseAction {

    private final ObjectMapper objectMapper;

    public ApprovalAction(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getActionIdentifier() {
        return ACTION_SEND_APPROVAL;
    }

    @Override
    public Mono<ActionExecutionResult> execute(WebClient connection, ActionConfiguration actionConfiguration) {
        ActionExecutionResult result = new ActionExecutionResult();

        try {
            String userId = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "userId", STRING_TYPE, "");
            String companyUuid = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "companyUuid", STRING_TYPE, "");
            String formCode = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "formCode", STRING_TYPE, "");
            String title = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "title", STRING_TYPE, "");
            String content = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "content", STRING_TYPE, "");
            String callbackUrl = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "callbackUrl", STRING_TYPE, "");

            // Build multipart body
            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("userId", userId);
            builder.part("companyUuid", companyUuid);
            builder.part("formCode", formCode);
            if (StringUtils.hasText(title)) {
                builder.part("title", title);
            }
            if (StringUtils.hasText(content)) {
                builder.part("content", content);
            }
            if (StringUtils.hasText(callbackUrl)) {
                builder.part("callbackUrl", callbackUrl);
            }

            String targetUrl = "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + APPROVAL_REQUEST_PATH;

            // Request logging
            log.info("Daouoffice Approval Send Request URL: {}", targetUrl);
            log.info("Daouoffice Approval Send Request Params: userId={}, companyUuid={}, formCode={}, title={}",
                    userId, companyUuid, formCode, title);

            return connection
                    .post()
                    .uri(uriBuilder -> uriBuilder
                            .scheme("http")
                            .host(SERVICE_GATEWAY_HOST)
                            .port(SERVICE_GATEWAY_PORT)
                            .path(APPROVAL_REQUEST_PATH)
                            .build())
                    .header("x-company-uuid", companyUuid)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(builder.build()))
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                            .defaultIfEmpty("")
                            .flatMap(body -> {
                                log.error("Approval API error. status={}, url={}, responseBody={}",
                                        resp.statusCode(), targetUrl, body);
                                return Mono.error(new RuntimeException(
                                        "HTTP " + resp.statusCode() + " from " + targetUrl + " body=" + body));
                            }))
                    .bodyToMono(String.class)
                    .doOnNext(responseBody ->
                            log.info("Approval API success. url={}, responseBody={}", targetUrl, responseBody))
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
                        log.error("Approval send failed. url={}", targetUrl, error);
                        result.setIsExecutionSuccess(false);
                        result.setErrorInfo(new AppsmithPluginException(
                                AppsmithPluginError.PLUGIN_ERROR, "Approval Send Failed: " + error.getMessage()));
                        return Mono.just(result);
                    });

        } catch (Exception e) {
            log.error("Error preparing approval request", e);
            result.setIsExecutionSuccess(false);
            result.setErrorInfo(new AppsmithPluginException(
                    AppsmithPluginError.PLUGIN_ERROR, "Error preparing approval request: " + e.getMessage()));
            return Mono.just(result);
        }
    }
}
