package com.external.plugins.actions;

import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginError;
import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginException;
import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionExecutionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static com.appsmith.external.helpers.PluginUtils.STRING_TYPE;
import static com.appsmith.external.helpers.PluginUtils.getDataValueSafelyFromFormData;
import static com.external.plugins.DaouofficeConstants.*;

@Slf4j
public class NotificationAction implements BaseAction {

    private final ObjectMapper objectMapper;

    public NotificationAction(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getActionIdentifier() {
        return ACTION_SEND_NOTIFICATION;
    }

    @Override
    public Mono<ActionExecutionResult> execute(WebClient connection, ActionConfiguration actionConfiguration) {
        ActionExecutionResult result = new ActionExecutionResult();

        try {
            String notificationType = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "notificationType", STRING_TYPE, NOTIFICATION_TYPE_LEAD_REGISTRATION);
            String companyUuid = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "companyUuid", STRING_TYPE, "");
            String platformUserIdsRaw = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "platformUserIds", STRING_TYPE, "");

            // Determine message and title based on notification type
            String message;
            String title;

            if (NOTIFICATION_TYPE_LEAD_REGISTRATION.equals(notificationType)) {
                message = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "message_registration", STRING_TYPE, "");
                title = "[리드 등록]";
            } else if (NOTIFICATION_TYPE_LEAD_ASSIGNMENT.equals(notificationType)) {
                message = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "message_assignment", STRING_TYPE, "");
                title = "[리드 담당자 배정]";
            } else if (NOTIFICATION_TYPE_LEAD_STATUS_UPDATE.equals(notificationType)) {
                message = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "message_status_update", STRING_TYPE, "");
                title = "[리드 상태 변경]";
            } else {
                message = "새로운 알림이 있습니다.";
                title = "[알림]";
            }

            // Build request body
            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("messageEvent", "COMPANY_CREATE");

            ObjectNode notification = requestBody.putObject("notification");
            notification.putArray("notificationTypes").add("PUSH");
            notification.put("senderType", "APP");
            notification.put("companyUuid", companyUuid);
            notification.put("platformSenderId", DEFAULT_PLATFORM_SENDER_ID);
            notification.put("message", message);
            notification.put("linkUrl", "");

            ObjectNode pushOption = requestBody.putObject("pushOption");
            var devices = pushOption.putArray("pushDevices");
            devices.add("PC").add("WEB").add("MOBILE");
            pushOption.put("title", title);
            pushOption.put("body", message);
            pushOption.put("image", "");
            pushOption.put("data", "{\"sendPriority\":\"HIGH\"}");

            var idsArray = requestBody.putArray("platformUserIds");
            if (StringUtils.hasText(platformUserIdsRaw)) {
                for (String id : platformUserIdsRaw.split(",")) {
                    if (StringUtils.hasText(id.trim())) {
                        idsArray.add(id.trim());
                    }
                }
            }

            String targetUrl = "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + NOTIFICATION_SEND_PATH;

            // Request logging
            try {
                log.info("Daouoffice Notification Send Request URL: {}", targetUrl);
                log.info("Daouoffice Notification Send Request Body: {}", objectMapper.writeValueAsString(requestBody));
            } catch (Exception ignore) {
                log.info("Daouoffice Notification Send Request Body (toString): {}", requestBody.toString());
            }

            return connection
                    .post()
                    .uri(uriBuilder -> uriBuilder
                            .scheme("http")
                            .host(SERVICE_GATEWAY_HOST)
                            .port(SERVICE_GATEWAY_PORT)
                            .path(NOTIFICATION_SEND_PATH)
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                            .defaultIfEmpty("")
                            .flatMap(body -> {
                                log.error("Notification API error. status={}, url={}, responseBody={}",
                                        resp.statusCode(), targetUrl, body);
                                return Mono.error(new RuntimeException(
                                        "HTTP " + resp.statusCode() + " from " + targetUrl + " body=" + body));
                            }))
                    .bodyToMono(String.class)
                    .doOnNext(responseBody ->
                            log.info("Notification API success. url={}, responseBody={}", targetUrl, responseBody))
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
                        log.error("Notification send failed. url={}", targetUrl, error);
                        result.setIsExecutionSuccess(false);
                        result.setErrorInfo(new AppsmithPluginException(
                                AppsmithPluginError.PLUGIN_ERROR, "Notification Send Failed: " + error.getMessage()));
                        return Mono.just(result);
                    });

        } catch (Exception e) {
            log.error("Error preparing notification request", e);
            result.setIsExecutionSuccess(false);
            result.setErrorInfo(new AppsmithPluginException(
                    AppsmithPluginError.PLUGIN_ERROR, "Error preparing notification request: " + e.getMessage()));
            return Mono.just(result);
        }
    }
}
