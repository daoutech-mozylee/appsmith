package com.external.plugins;

import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionExecutionResult;
import com.appsmith.external.models.DatasourceConfiguration;
import com.appsmith.external.models.DatasourceTestResult;
import com.appsmith.external.plugins.BasePlugin;
import com.appsmith.external.plugins.PluginExecutor;
import com.external.plugins.actions.ApprovalAction;
import com.external.plugins.actions.BaseAction;
import com.external.plugins.actions.CalendarAction;
import com.external.plugins.actions.CalendarEventAction;
import com.external.plugins.actions.MailAction;
import com.external.plugins.actions.MessageAction;
import com.external.plugins.actions.NotificationAction;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.pf4j.Extension;
import org.pf4j.PluginWrapper;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static com.appsmith.external.helpers.PluginUtils.STRING_TYPE;
import static com.appsmith.external.helpers.PluginUtils.getDataValueSafelyFromFormData;
import static com.external.plugins.DaouofficeConstants.*;

/**
 * DaouofficePlugin - 다우오피스 서비스 연동 플러그인
 *
 * 지원 액션:
 * - 메일 전송 (send_mail)
 * - 메시지 전송 (send_message)
 * - 알림 전송 (send_notification)
 * - 전자결재 (send_approval)
 * - 조직도 (organization) - placeholder
 * - 캘린더 등록 (register_calendar) - placeholder
 */
@Slf4j
public class DaouofficePlugin extends BasePlugin {

    public DaouofficePlugin(PluginWrapper wrapper) {
        super(wrapper);
    }

    @Extension
    public static class DaouofficePluginExecutor implements PluginExecutor<WebClient> {

        private static final ObjectMapper objectMapper = new ObjectMapper();
        private final Map<String, BaseAction> actionHandlers;

        public DaouofficePluginExecutor() {
            // 액션 핸들러 등록
            this.actionHandlers = new HashMap<>();
            registerAction(new MailAction(objectMapper));
            registerAction(new MessageAction(objectMapper));
            registerAction(new NotificationAction(objectMapper));
            registerAction(new ApprovalAction(objectMapper));
            registerAction(new CalendarAction(objectMapper));
            registerAction(new CalendarEventAction(objectMapper));
        }

        private void registerAction(BaseAction action) {
            actionHandlers.put(action.getActionIdentifier(), action);
        }

        @Override
        public Mono<WebClient> datasourceCreate(DatasourceConfiguration datasourceConfiguration) {
            log.debug("DaouofficePlugin: datasourceCreate() 호출됨");
            return Mono.just(WebClient.builder().build());
        }

        @Override
        public void datasourceDestroy(WebClient connection) {
            log.debug("DaouofficePlugin: datasourceDestroy() 호출됨");
            // WebClient는 별도 정리가 필요없음
        }

        @Override
        public Set<String> validateDatasource(DatasourceConfiguration datasourceConfiguration) {
            log.debug("DaouofficePlugin: validateDatasource() 호출됨");
            return new HashSet<>();
        }

        @Override
        public Mono<DatasourceTestResult> testDatasource(WebClient connection) {
            log.debug("DaouofficePlugin: testDatasource() 호출됨");
            return Mono.just(new DatasourceTestResult());
        }

        @Override
        public Mono<ActionExecutionResult> execute(
                WebClient connection,
                DatasourceConfiguration datasourceConfiguration,
                ActionConfiguration actionConfiguration) {

            log.debug("DaouofficePlugin: execute() 호출됨");

            String action = getActionSafely(actionConfiguration);
            log.debug("DaouofficePlugin action: {}", action);

            // 메일 타입에 따른 분기 처리
            if (ACTION_SEND_MAIL.equals(action)) {
                String mailType = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "mail_type", STRING_TYPE, MAIL_TYPE_LEAD_REGISTRATION);

                if (MAIL_TYPE_LEAD_REGISTRATION.equals(mailType) || MAIL_TYPE_PLAIN.equals(mailType)) {
                    return executeAction(action, connection, actionConfiguration);
                } else if (MAIL_TYPE_LEAD_ASSIGNMENT.equals(mailType)) {
                    return Mono.just(createPlaceholderResult("send_mail_assignment"));
                } else if (MAIL_TYPE_LEAD_STATUS_UPDATE.equals(mailType)) {
                    return Mono.just(createPlaceholderResult("send_mail_status_update"));
                }
            }

            // 등록된 액션 핸들러로 라우팅
            if (actionHandlers.containsKey(action)) {
                return executeAction(action, connection, actionConfiguration);
            }

            // Placeholder 액션 (organization, register_calendar 등)
            return Mono.just(createPlaceholderResult(action));
        }

        private Mono<ActionExecutionResult> executeAction(
                String action, WebClient connection, ActionConfiguration actionConfiguration) {
            BaseAction handler = actionHandlers.get(action);
            if (handler != null) {
                return handler.execute(connection, actionConfiguration);
            }
            return Mono.just(createPlaceholderResult(action));
        }

        private String getActionSafely(ActionConfiguration actionConfiguration) {
            if (actionConfiguration == null || actionConfiguration.getFormData() == null) {
                return ACTION_ORGANIZATION;
            }
            return getDataValueSafelyFromFormData(
                    actionConfiguration.getFormData(), "endpoint", STRING_TYPE, ACTION_ORGANIZATION);
        }

        private ActionExecutionResult createPlaceholderResult(String action) {
            ActionExecutionResult result = new ActionExecutionResult();
            result.setIsExecutionSuccess(true);
            try {
                ObjectNode body = objectMapper.createObjectNode();
                body.put("message", "Action executed successfully (Placeholder)");
                body.put("action", action);
                result.setBody(body);
            } catch (Exception e) {
                result.setBody("Action: " + action);
            }
            return result;
        }
    }
}
