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
import lombok.extern.slf4j.Slf4j;
import org.pf4j.Extension;
import org.pf4j.PluginWrapper;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
public class DaouofficePlugin extends BasePlugin {

    public DaouofficePlugin(PluginWrapper wrapper) {
        super(wrapper);
    }

    @Extension
    public static class DaouofficePluginExecutor implements PluginExecutor<WebClient> {

        private static final ObjectMapper objectMapper = new ObjectMapper();
        private static final String ACTION_FETCH_RECEIVERS = "fetchReceivers";
        private static final String FETCH_RECEIVERS_PATH =
            "/api/agg/gift/receiver?type=DEPT&id=1344934385551454208";
        private static final String DAO_AUTH_HEADER =
                "{\"mac\":\"ZP1q/eR3s0QGTbW0TPa4qAQrza4YSx6J9Sk5ZShD2rQ=\",\"message\":\"test-message\",\"clientId\":\"addcon\"}";

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

            // URL이 입력되었는지 확인
            if (datasourceConfiguration.getUrl() == null ||
                datasourceConfiguration.getUrl().trim().isEmpty()) {
                invalids.add("다우오피스 API URL을 입력해주세요.");
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

            String actionType = resolveActionType(actionConfiguration);
            log.debug("DaouofficePlugin actionType: {}", actionType);

            if (ACTION_FETCH_RECEIVERS.equalsIgnoreCase(actionType)) {
                String baseUrl = datasourceConfiguration.getUrl();
                String url = baseUrl + FETCH_RECEIVERS_PATH;
                return executeHttpGet(connection, url);
            }

            return executeUsingDatasourceUrl(connection, datasourceConfiguration);
        }

        private String resolveActionType(ActionConfiguration actionConfiguration) {
            // 테스트 (일단 fetchReceivers로 고정)
            String actionType = ACTION_FETCH_RECEIVERS;
            if (actionConfiguration == null) {
                return actionType;
            }

            List<Property> templates = actionConfiguration.getPluginSpecifiedTemplates();
            if (templates != null && !templates.isEmpty()) {
                Property template = templates.get(0);
                if (template != null && template.getValue() != null) {
                    actionType = String.valueOf(template.getValue());
                }
            }
            return actionType;
        }

        private Mono<ActionExecutionResult> executeUsingDatasourceUrl(
                WebClient connection, DatasourceConfiguration datasourceConfiguration) {
            ActionExecutionResult result = new ActionExecutionResult();
            String apiUrl = datasourceConfiguration.getUrl();

            if (apiUrl == null || apiUrl.trim().isEmpty()) {
                result.setIsExecutionSuccess(false);
                result.setErrorInfo(new AppsmithPluginException(
                        AppsmithPluginError.PLUGIN_EXECUTE_ARGUMENT_ERROR, "API URL이 설정되지 않았습니다."));
                return Mono.just(result);
            }

            return executeHttpGet(connection, apiUrl);
        }

        private Mono<ActionExecutionResult> executeHttpGet(WebClient connection, String url) {
            ActionExecutionResult result = new ActionExecutionResult();

            log.debug("다우오피스 API 호출 시작: {}", url);

            return connection
                    .method(HttpMethod.GET)
                    .uri(url)
                    .header("X-DaouOffice-Auth", DAO_AUTH_HEADER)
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
    }
}
