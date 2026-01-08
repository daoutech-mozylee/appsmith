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

@Slf4j
public class MessageAction implements BaseAction {

    private final ObjectMapper objectMapper;

    public MessageAction(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getActionIdentifier() {
        return ACTION_SEND_MESSAGE;
    }

    @Override
    public Mono<ActionExecutionResult> execute(WebClient connection, ActionConfiguration actionConfiguration) {
        ActionExecutionResult result = new ActionExecutionResult();

        try {
            String platformUserId = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "platformUserId", STRING_TYPE, "");
            String toUserId = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "toUserId", STRING_TYPE, "");
            String companyUuid = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "companyUuid", STRING_TYPE, "");
            String cmid = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "cmid", STRING_TYPE, "");
            String message = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "message", STRING_TYPE, "");

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("platformUserId", platformUserId);
            requestBody.put("toUserId", toUserId);
            requestBody.put("companyUuid", companyUuid);
            requestBody.put("cmid", cmid);
            requestBody.put("message", message);
            requestBody.putArray("filePathList");

            String targetUrl = "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + MESSAGE_SEND_PATH;

            // Request logging
            try {
                log.info("Daouoffice Message Send Request URL: {}", targetUrl);
                log.info("Daouoffice Message Send Request Body: {}", objectMapper.writeValueAsString(requestBody));
            } catch (Exception ignore) {
                log.info("Daouoffice Message Send Request Body (toString): {}", requestBody.toString());
            }

            return connection
                    .post()
                    .uri(uriBuilder -> uriBuilder
                            .scheme("http")
                            .host(SERVICE_GATEWAY_HOST)
                            .port(SERVICE_GATEWAY_PORT)
                            .path(MESSAGE_SEND_PATH)
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                            .defaultIfEmpty("")
                            .flatMap(body -> {
                                log.error("Message API error. status={}, url={}, responseBody={}",
                                        resp.statusCode(), targetUrl, body);
                                return Mono.error(new RuntimeException(
                                        "HTTP " + resp.statusCode() + " from " + targetUrl + " body=" + body));
                            }))
                    .bodyToMono(String.class)
                    .doOnNext(responseBody ->
                            log.info("Message API success. url={}, responseBody={}", targetUrl, responseBody))
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
                        log.error("Message send failed. url={}", targetUrl, error);
                        result.setIsExecutionSuccess(false);
                        result.setErrorInfo(new AppsmithPluginException(
                                AppsmithPluginError.PLUGIN_ERROR, "Message Send Failed: " + error.getMessage()));
                        return Mono.just(result);
                    });

        } catch (Exception e) {
            log.error("Error preparing message request", e);
            result.setIsExecutionSuccess(false);
            result.setErrorInfo(new AppsmithPluginException(
                    AppsmithPluginError.PLUGIN_ERROR, "Error preparing message request: " + e.getMessage()));
            return Mono.just(result);
        }
    }
}
