package com.external.plugins;

import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginError;
import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginException;
import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionExecutionResult;
import com.appsmith.external.models.DatasourceConfiguration;
import com.appsmith.external.models.DatasourceTestResult;
import com.appsmith.external.plugins.BasePlugin;
import com.appsmith.external.plugins.PluginExecutor;
import com.appsmith.external.models.Property;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.pf4j.Extension;
import org.pf4j.PluginWrapper;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.HashSet;
import java.util.Set;

import static com.appsmith.external.helpers.PluginUtils.OBJECT_TYPE;
import static com.appsmith.external.helpers.PluginUtils.STRING_TYPE;
import static com.appsmith.external.helpers.PluginUtils.getDataValueSafelyFromFormData;

@Slf4j
public class DaouofficePlugin extends BasePlugin {

    public DaouofficePlugin(PluginWrapper wrapper) {
        super(wrapper);
    }

    @Extension
    public static class DaouofficePluginExecutor implements PluginExecutor<WebClient> {

        private static final ObjectMapper objectMapper = new ObjectMapper();
        private static final String BASE_API_URL = "https://dev-dopapi.daouoffice.com";
        private static final String DEFAULT_ENDPOINT_PATH = "/public/v1/account";
        private static final String MAIL_SEND_PATH = "/api/mail/internal/noti/send";
        private static final String MAIL_SERVICE_URL = "http://dop-service-gateway.dop-platform.svc.cluster.local:20719";
        private static final Set<String> SUPPORTED_ENDPOINT_PATHS = Set.of(DEFAULT_ENDPOINT_PATH, "/public/v1/dept",
                MAIL_SEND_PATH);
        private static final String PROPERTY_CLIENT_ID = "clientId";
        private static final String PROPERTY_CLIENT_SECRET = "clientSecret";

        @Override
        public Mono<WebClient> datasourceCreate(DatasourceConfiguration datasourceConfiguration) {
            log.debug("DaouofficePlugin: datasourceCreate() 호출됨");

            WebClient webClient = WebClient.builder().build();

            return Mono.just(webClient);
        }

        @Override
        public void datasourceDestroy(WebClient connection) {
            log.debug("DaouofficePlugin: datasourceDestroy() 호출됨");
            // WebClient는 별도 정리가 필요없음
        }

        @Override
        public Set<String> validateDatasource(DatasourceConfiguration datasourceConfiguration) {
            log.debug("DaouofficePlugin: validateDatasource() 호출됨");

            Set<String> invalids = new HashSet<>();

            String clientId = getDatasourceProperty(datasourceConfiguration, PROPERTY_CLIENT_ID);
            if (!StringUtils.hasText(clientId)) {
                invalids.add("다우오피스 Client ID를 입력해주세요.");
            }

            String clientSecret = getDatasourceProperty(datasourceConfiguration, PROPERTY_CLIENT_SECRET);
            if (!StringUtils.hasText(clientSecret)) {
                invalids.add("다우오피스 Client Secret을 입력해주세요.");
            }

            return invalids;
        }

        @Override
        public Mono<DatasourceTestResult> testDatasource(WebClient connection) {
            log.debug("DaouofficePlugin: testDatasource() 호출됨");

            // 간단하게 연결만 확인
            return Mono.just(new DatasourceTestResult());
        }

        @Override
        public Mono<ActionExecutionResult> execute(
                WebClient connection,
                DatasourceConfiguration datasourceConfiguration,
                ActionConfiguration actionConfiguration) {

            log.debug("DaouofficePlugin: execute() 호출됨");

            String endpointPath = resolveEndpointPath(actionConfiguration);
            log.debug("DaouofficePlugin endpoint path: {}", endpointPath);

            return executeDaouofficeRequest(connection, datasourceConfiguration, endpointPath, actionConfiguration);
        }

        private String resolveEndpointPath(ActionConfiguration actionConfiguration) {
            if (actionConfiguration == null || actionConfiguration.getFormData() == null) {
                return DEFAULT_ENDPOINT_PATH;
            }

            String path = getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "endpoint", STRING_TYPE, DEFAULT_ENDPOINT_PATH);

            return StringUtils.hasText(path) ? path : DEFAULT_ENDPOINT_PATH;
        }

        private Mono<ActionExecutionResult> executeDaouofficeRequest(
                WebClient connection, DatasourceConfiguration datasourceConfiguration, String requestedPath,
                ActionConfiguration actionConfiguration) {
            ActionExecutionResult result = new ActionExecutionResult();

            if (MAIL_SEND_PATH.equals(requestedPath)) {
                return executeMailSendRequest(connection, actionConfiguration);
            }

            String clientId = getDatasourceProperty(datasourceConfiguration, PROPERTY_CLIENT_ID);
            String clientSecret = getDatasourceProperty(datasourceConfiguration, PROPERTY_CLIENT_SECRET);

            if (!StringUtils.hasText(clientId) || !StringUtils.hasText(clientSecret)) {
                result.setIsExecutionSuccess(false);
                result.setErrorInfo(new AppsmithPluginException(
                        AppsmithPluginError.PLUGIN_EXECUTE_ARGUMENT_ERROR, "Client ID/Secret이 설정되지 않았습니다."));
                return Mono.just(result);
            }

            String sanitizedPath = SUPPORTED_ENDPOINT_PATHS.contains(requestedPath)
                    ? requestedPath
                    : DEFAULT_ENDPOINT_PATH;
            String url = BASE_API_URL + sanitizedPath;

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("clientId", clientId);
            requestBody.put("clientSecret", clientSecret);
            requestBody.put("productName", "");
            requestBody.put("productVersion", "");
            requestBody.put("clientCompanyName", "");

            log.debug("다우오피스 API 호출 시작: {}{}", BASE_API_URL, sanitizedPath);

            return connection
                    .post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.isError(),
                            response -> {
                                log.error("API 호출 실패: HTTP {}", response.statusCode());
                                return Mono.error(new AppsmithPluginException(
                                        AppsmithPluginError.PLUGIN_ERROR, "API 호출 실패: HTTP " + response.statusCode()));
                            })
                    .bodyToMono(String.class)
                    .flatMap(responseBody -> {
                        try {
                            log.debug("API 응답 받음: {}", responseBody);

                            JsonNode jsonResponse = objectMapper.readTree(responseBody);

                            result.setIsExecutionSuccess(true);
                            result.setBody(jsonResponse);

                            log.debug("API 호출 성공!");
                            return Mono.just(result);

                        } catch (Exception e) {
                            log.error("JSON 파싱 실패", e);
                            result.setIsExecutionSuccess(false);
                            result.setErrorInfo(new AppsmithPluginException(
                                    AppsmithPluginError.PLUGIN_JSON_PARSE_ERROR, "응답 데이터 파싱 실패: " + e.getMessage()));
                            return Mono.just(result);
                        }
                    })
                    .onErrorResume(error -> {
                        log.error("API 호출 중 에러 발생", error);
                        result.setIsExecutionSuccess(false);

                        if (error instanceof AppsmithPluginException) {
                            result.setErrorInfo(error);
                        } else {
                            result.setErrorInfo(new AppsmithPluginException(
                                    AppsmithPluginError.PLUGIN_ERROR, "API 호출 실패: " + error.getMessage()));
                        }

                        return Mono.just(result);
                    });
        }

        private String getDatasourceProperty(DatasourceConfiguration datasourceConfiguration, String key) {
            if (datasourceConfiguration == null || datasourceConfiguration.getProperties() == null) {
                return null;
            }

            return datasourceConfiguration.getProperties().stream()
                    .filter(property -> key.equals(property.getKey()))
                    .findFirst()
                    .map(Property::getValue)
                    .map(value -> value == null ? null : String.valueOf(value))
                    .orElse(null);
        }

        private Mono<ActionExecutionResult> executeMailSendRequest(
                WebClient connection, ActionConfiguration actionConfiguration) {

            ActionExecutionResult result = new ActionExecutionResult();

            try {
                String senderEmail = getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "senderEmail",
                        STRING_TYPE, "");
                String senderName = getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "senderName",
                        STRING_TYPE, "");
                String subject = getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "subject",
                        STRING_TYPE, "");
                String contents = getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "contents",
                        STRING_TYPE, "");
                String toStr = getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "to", STRING_TYPE, "");
                String editmode = getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "editmode",
                        STRING_TYPE, "html");
                String envFromAddr = getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "envFromAddr",
                        STRING_TYPE, "");

                Object withoutNotiObj = getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "withoutNoti",
                        OBJECT_TYPE, "false");
                String withoutNotiStr = String.valueOf(withoutNotiObj);

                String targetUrl = MAIL_SERVICE_URL + MAIL_SEND_PATH;

                log.debug("Daouoffice Mail Send Request: {}", targetUrl);

                return connection
                        .post()
                        .uri(uriBuilder -> {
                            // URL components separated to ensure correct building
                            // MAIL_SERVICE_URL is
                            // http://dop-service-gateway.dop-platform.svc.cluster.local:20719
                            uriBuilder.scheme("http")
                                    .host("dop-service-gateway.dop-platform.svc.cluster.local")
                                    .port(20719)
                                    .path(MAIL_SEND_PATH)
                                    .queryParam("senderEmail", senderEmail)
                                    .queryParam("subject", subject)
                                    .queryParam("contents", contents)
                                    .queryParam("editmode", editmode)
                                    .queryParam("withoutNoti", "true".equalsIgnoreCase(withoutNotiStr));

                            if (StringUtils.hasText(senderName)) {
                                uriBuilder.queryParam("senderName", senderName);
                            }
                            if (StringUtils.hasText(envFromAddr)) {
                                uriBuilder.queryParam("envFromAddr", envFromAddr);
                            }

                            // Handle 'to' array (comma separated input -> multiple query params)
                            if (StringUtils.hasText(toStr)) {
                                String[] emails = toStr.split(",");
                                for (String email : emails) {
                                    if (StringUtils.hasText(email.trim())) {
                                        uriBuilder.queryParam("to", email.trim());
                                    }
                                }
                            }

                            return uriBuilder.build();
                        })
                        .contentType(MediaType.APPLICATION_JSON) // Usually POSTs have content type, even if empty body
                        .retrieve()
                        .bodyToMono(String.class)
                        .map(responseBody -> {
                            try {
                                result.setIsExecutionSuccess(true);
                                result.setBody(objectMapper.readTree(responseBody));
                                return result;
                            } catch (Exception e) {
                                result.setIsExecutionSuccess(true);
                                result.setBody(responseBody); // Fallback to string if not JSON
                                return result;
                            }
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
}
