package com.external.plugins.actions;

import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginError;
import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginException;
import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionExecutionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static com.appsmith.external.helpers.PluginUtils.STRING_TYPE;
import static com.appsmith.external.helpers.PluginUtils.getDataValueSafelyFromFormData;
import static com.external.plugins.DaouofficeConstants.*;

/**
 * 캘린더 액션 - 캘린더 목록 조회
 *
 * API: GET /gw/platform/api/calendars
 * Header: x-company-uuid
 * Param: userId
 */
@Slf4j
public class CalendarAction implements BaseAction {

    private final ObjectMapper objectMapper;

    public CalendarAction(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getActionIdentifier() {
        return ACTION_REGISTER_CALENDAR;
    }

    @Override
    public Mono<ActionExecutionResult> execute(WebClient connection, ActionConfiguration actionConfiguration) {
        ActionExecutionResult result = new ActionExecutionResult();

        try {
            String companyUuid = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "companyUuid", STRING_TYPE, "");
            String userId = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "calendarUserId", STRING_TYPE, "");

            String targetUrl = "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + CALENDAR_LIST_PATH;

            log.info("Daouoffice Calendar List Request URL: {}", targetUrl);
            log.info("Daouoffice Calendar List Request - companyUuid: {}, userId: {}", companyUuid, userId);

            return connection
                    .get()
                    .uri(uriBuilder -> uriBuilder
                            .scheme("http")
                            .host(SERVICE_GATEWAY_HOST)
                            .port(SERVICE_GATEWAY_PORT)
                            .path(CALENDAR_LIST_PATH)
                            .queryParam("userId", userId)
                            .build())
                    .header("x-company-uuid", companyUuid)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                            .defaultIfEmpty("")
                            .flatMap(body -> {
                                log.error("Calendar API error. status={}, url={}, responseBody={}",
                                        resp.statusCode(), targetUrl, body);
                                return Mono.error(new RuntimeException(
                                        "HTTP " + resp.statusCode() + " from " + targetUrl + " body=" + body));
                            }))
                    .bodyToMono(String.class)
                    .doOnNext(responseBody ->
                            log.info("Calendar API success. url={}, responseBody={}", targetUrl, responseBody))
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
                        log.error("Calendar list fetch failed. url={}", targetUrl, error);
                        result.setIsExecutionSuccess(false);
                        result.setErrorInfo(new AppsmithPluginException(
                                AppsmithPluginError.PLUGIN_ERROR, "Calendar List Fetch Failed: " + error.getMessage()));
                        return Mono.just(result);
                    });

        } catch (Exception e) {
            log.error("Error preparing calendar request", e);
            result.setIsExecutionSuccess(false);
            result.setErrorInfo(new AppsmithPluginException(
                    AppsmithPluginError.PLUGIN_ERROR, "Error preparing calendar request: " + e.getMessage()));
            return Mono.just(result);
        }
    }
}
