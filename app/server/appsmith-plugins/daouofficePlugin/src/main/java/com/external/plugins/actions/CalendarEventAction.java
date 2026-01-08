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
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static com.appsmith.external.helpers.PluginUtils.STRING_TYPE;
import static com.appsmith.external.helpers.PluginUtils.getDataValueSafelyFromFormData;
import static com.external.plugins.DaouofficeConstants.*;

/**
 * 캘린더 일정 등록 액션
 *
 * API: POST /gw/platform/api/calendar/{calendarId}/event
 * Header: x-company-uuid
 * Param: userId
 * Body: type, visibility, timeType, summary, startTime, endTime
 */
@Slf4j
public class CalendarEventAction implements BaseAction {

    private final ObjectMapper objectMapper;

    public CalendarEventAction(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getActionIdentifier() {
        return ACTION_CREATE_CALENDAR_EVENT;
    }

    @Override
    public Mono<ActionExecutionResult> execute(WebClient connection, ActionConfiguration actionConfiguration) {
        ActionExecutionResult result = new ActionExecutionResult();

        try {
            // Header & Param
            String companyUuid = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "companyUuid", STRING_TYPE, "");
            String userId = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "eventUserId", STRING_TYPE, "");
            String calendarId = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "calendarId", STRING_TYPE, "");

            // Body - Form 선택 값
            String type = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "eventType", STRING_TYPE, "normal");
            String visibility = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "eventVisibility", STRING_TYPE, "private");
            String timeType = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "eventTimeType", STRING_TYPE, "timed");

            // Body - 위젯 param으로 받는 값
            String summary = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "summary", STRING_TYPE, "");
            String startTime = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "startTime", STRING_TYPE, "");
            String endTime = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "endTime", STRING_TYPE, "");

            // Build request body
            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("type", type);
            requestBody.put("visibility", visibility);
            requestBody.put("timeType", timeType);
            requestBody.put("summary", summary);
            requestBody.put("startTime", startTime);
            requestBody.put("endTime", endTime);

            // Build URL with calendarId
            String path = CALENDAR_EVENT_PATH.replace("{calendarId}", calendarId);
            String targetUrl = "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + path;

            log.info("========== Daouoffice Calendar Event Create Request ==========");
            log.info("URL: {}", targetUrl);
            log.info("Header[x-company-uuid]: {}", companyUuid);
            log.info("Param[userId]: {}", userId);
            log.info("Body: {}", requestBody.toString());
            log.info("==============================================================");

            return connection
                    .post()
                    .uri(uriBuilder -> uriBuilder
                            .scheme("http")
                            .host(SERVICE_GATEWAY_HOST)
                            .port(SERVICE_GATEWAY_PORT)
                            .path(path)
                            .queryParam("userId", userId)
                            .build())
                    .header("x-company-uuid", companyUuid)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                            .defaultIfEmpty("")
                            .flatMap(body -> {
                                log.error("Calendar Event API error. status={}, url={}, responseBody={}",
                                        resp.statusCode(), targetUrl, body);
                                return Mono.error(new RuntimeException(
                                        "HTTP " + resp.statusCode() + " from " + targetUrl + " body=" + body));
                            }))
                    .bodyToMono(String.class)
                    .doOnNext(responseBody ->
                            log.info("Calendar Event API success. url={}, responseBody={}", targetUrl, responseBody))
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
                        log.error("Calendar event create failed. url={}", targetUrl, error);
                        result.setIsExecutionSuccess(false);
                        result.setErrorInfo(new AppsmithPluginException(
                                AppsmithPluginError.PLUGIN_ERROR, "Calendar Event Create Failed: " + error.getMessage()));
                        return Mono.just(result);
                    });

        } catch (Exception e) {
            log.error("Error preparing calendar event request", e);
            result.setIsExecutionSuccess(false);
            result.setErrorInfo(new AppsmithPluginException(
                    AppsmithPluginError.PLUGIN_ERROR, "Error preparing calendar event request: " + e.getMessage()));
            return Mono.just(result);
        }
    }
}
