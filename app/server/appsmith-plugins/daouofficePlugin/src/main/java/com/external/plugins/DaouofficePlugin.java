package com.external.plugins;

import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginError;
import com.appsmith.external.exceptions.pluginExceptions.AppsmithPluginException;
import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionExecutionResult;
import com.appsmith.external.models.DatasourceConfiguration;
import com.appsmith.external.models.DatasourceTestResult;
import com.appsmith.external.plugins.BasePlugin;
import com.appsmith.external.plugins.PluginExecutor;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.pf4j.Extension;
import org.pf4j.PluginWrapper;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.BodyInserters;
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

        // Internal Service Constants
        private static final String MAIL_SEND_PATH = "/api/mail/internal/noti/send";
        private static final String MESSAGE_SEND_PATH = "/api/chat/internal/message/user";
        private static final String NOTIFICATION_SEND_PATH =
                "/api/notifier/app/dop-employee-approval/user/notification/message";
        private static final String SERVICE_GATEWAY_HOST = "dop-service-gateway.dop-platform.svc.cluster.local";
        private static final String APPROVAL_REQUEST_PATH = "/gw/platform/api/approval/document/popup";
        private static final int SERVICE_GATEWAY_PORT = 20719;

        // Action Identifiers (Must match root.json)
        private static final String ACTION_ORGANIZATION = "organization";
        private static final String ACTION_SEND_MAIL = "send_mail";
        private static final String ACTION_SEND_NOTIFICATION = "send_notification";
        private static final String ACTION_SEND_MESSAGE = "send_message";
        private static final String ACTION_SEND_APPROVAL = "send_approval";
        private static final String ACTION_REGISTER_CALENDAR = "register_calendar";

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

            // 인증 정보가 제거되었으므로 항상 유효하다고 판단
            return new HashSet<>();
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

            String action = getActionSafely(actionConfiguration);
            log.debug("DaouofficePlugin action: {}", action);

            // Dispatch based on action
            if (ACTION_SEND_MAIL.equals(action)) {
                String mailType = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "mail_type", STRING_TYPE, "leadRegistrationMail");
                if ("leadRegistrationMail".equals(mailType) || "plainMail".equals(mailType)) {
                    return executeMailSendRequest(connection, actionConfiguration);
                } else if ("leadAssignmentMail".equals(mailType)) {
                    return Mono.just(createPlaceholderResult("send_mail_assignment"));
                } else if ("leadStatusUpdateMail".equals(mailType)) {
                    return Mono.just(createPlaceholderResult("send_mail_status_update"));
                }
            } else if (ACTION_SEND_MESSAGE.equals(action)) {
                return executeMessageSendRequest(connection, actionConfiguration);
            } else if (ACTION_SEND_NOTIFICATION.equals(action)) {
                return executeNotificationSendRequest(connection, actionConfiguration);
            } else if (ACTION_SEND_APPROVAL.equals(action)) {
                return executeApprovalRequest(connection, actionConfiguration);
            } else if (ACTION_ORGANIZATION.equals(action) || ACTION_REGISTER_CALENDAR.equals(action)) {
            } else if (ACTION_ORGANIZATION.equals(action) || ACTION_REGISTER_CALENDAR.equals(action)) {
                return Mono.just(createPlaceholderResult(action));
            }

            // Default handler
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

        private Mono<ActionExecutionResult> executeMailSendRequest(
                WebClient connection, ActionConfiguration actionConfiguration) {

            ActionExecutionResult result = new ActionExecutionResult();

            try {
                String senderName = "다우오피스";
                String senderEmail = "noreply@daouoffice.com";
                String toStrRaw =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "to", STRING_TYPE, "");
                String subjectRaw =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "subject", STRING_TYPE, "");

                String mailType = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "mail_type", STRING_TYPE, "leadRegistrationMail");
                log.debug("mailtype", mailType);
                // Default logic
                String finalTo = "";
                String finalSubject = "";
                String finalContents = "";

                log.debug("subjectRaw", subjectRaw);

                if ("plainMail".equals(mailType)) {
                    finalTo = StringUtils.hasText(toStrRaw) ? toStrRaw : "";
                    finalSubject = StringUtils.hasText(subjectRaw) ? subjectRaw : "";
                    String contentRaw = getDataValueSafelyFromFormData(
                            actionConfiguration.getFormData(), "content", STRING_TYPE, "");
                    finalContents = StringUtils.hasText(contentRaw) ? contentRaw : "";
                } else {
                    // leadRegistrationMail and fallback
                    finalTo = StringUtils.hasText(toStrRaw) ? toStrRaw : "mrlhs@hyunggil01.dev-dopweb.daouoffice.com";
                    finalSubject = StringUtils.hasText(subjectRaw) ? subjectRaw : "";
                    finalContents = getLeadRegistrationHtmlTemplate();
                }

                // "editmode" defaults to "html"
                String editmode = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "editmode", STRING_TYPE, "html");

                String envFromAddr = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "envFromAddr", STRING_TYPE, "");
                Object withoutNotiObj = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "withoutNoti", OBJECT_TYPE, "false");
                String withoutNotiStr = String.valueOf(withoutNotiObj);

                String targetUrl = "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + MAIL_SEND_PATH;

                log.debug("Daouoffice Mail Send Request: {}", targetUrl);

                final String finalToEffective = finalTo;
                final String finalSubjectEffective = finalSubject;
                final String finalContentsEffective = finalContents;
                final String senderEmailEffective = senderEmail;

                MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
                formData.add("senderName", senderName);
                formData.add("senderEmail", senderEmail);
                formData.add("subject", finalSubjectEffective);
                formData.add("contents", finalContentsEffective);
                formData.add("editmode", editmode);
                formData.add("withoutNoti", String.valueOf("true".equalsIgnoreCase(withoutNotiStr)));

                if (StringUtils.hasText(envFromAddr)) {
                    formData.add("envFromAddr", envFromAddr);
                }

                if (StringUtils.hasText(finalToEffective)) {
                    String[] emails = finalToEffective.split(",");
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

        private Mono<ActionExecutionResult> executeMessageSendRequest(
                WebClient connection, ActionConfiguration actionConfiguration) {

            ActionExecutionResult result = new ActionExecutionResult();

            try {
                String platformUserId = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "platformUserId", STRING_TYPE, "");
                String toUserId =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "toUserId", STRING_TYPE, "");
                String companyUuid = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "companyUuid", STRING_TYPE, "");
                String cmid =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "cmid", STRING_TYPE, "");
                String message =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "message", STRING_TYPE, "");

                ObjectNode requestBody = objectMapper.createObjectNode();
                requestBody.put("platformUserId", platformUserId);
                requestBody.put("toUserId", toUserId);
                requestBody.put("companyUuid", companyUuid);
                requestBody.put("cmid", cmid);
                requestBody.put("message", message);

                requestBody.putArray("filePathList");

                String targetUrl = "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + MESSAGE_SEND_PATH;

                // ✅ 요청 로그 (URL + Body)
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

                        // ✅ 4xx/5xx면 응답 바디를 강제로 읽어서 로그 + 에러에 포함
                        .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                                .defaultIfEmpty("")
                                .flatMap(body -> {
                                    log.error(
                                            "Message API error. status={}, url={}, responseBody={}",
                                            resp.statusCode(),
                                            targetUrl,
                                            body);
                                    return Mono.error(new RuntimeException(
                                            "HTTP " + resp.statusCode() + " from " + targetUrl + " body=" + body));
                                }))
                        .bodyToMono(String.class)

                        // ✅ 성공 응답 로그
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

        private Mono<ActionExecutionResult> executeNotificationSendRequest(
                WebClient connection, ActionConfiguration actionConfiguration) {

            ActionExecutionResult result = new ActionExecutionResult();

            try {
                String notificationType = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "notificationType", STRING_TYPE, "LEAD_REGISTRATION");
                String companyUuid = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "companyUuid", STRING_TYPE, "");
                String platformUserIdsRaw = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "platformUserIds", STRING_TYPE, "");

                String message;
                String title;

                if ("LEAD_REGISTRATION".equals(notificationType)) {
                    message = getDataValueSafelyFromFormData(
                            actionConfiguration.getFormData(), "message_registration", STRING_TYPE, "");
                    title = "[리드 등록]";
                } else if ("LEAD_ASSIGNMENT".equals(notificationType)) {
                    message = getDataValueSafelyFromFormData(
                            actionConfiguration.getFormData(), "message_assignment", STRING_TYPE, "");
                    title = "[리드 담당자 배정]";
                } else if ("LEAD_STATUS_UPDATE".equals(notificationType)) {
                    message = getDataValueSafelyFromFormData(
                            actionConfiguration.getFormData(), "message_status_update", STRING_TYPE, "");
                    title = "[리드 상태 변경]";
                } else {
                    message = "새로운 알림이 있습니다.";
                    title = "[알림]";
                }

                ObjectNode requestBody = objectMapper.createObjectNode();
                requestBody.put("messageEvent", "COMPANY_CREATE");

                ObjectNode notification = requestBody.putObject("notification");
                notification.putArray("notificationTypes").add("PUSH");
                notification.put("senderType", "APP");
                notification.put("companyUuid", companyUuid);
                notification.put("platformSenderId", "1452552749567705088");
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

                String targetUrl =
                        "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + NOTIFICATION_SEND_PATH;

                // ✅ 요청 로그 (URL + Body)
                try {
                    log.info("Daouoffice Notification Send Request URL: {}", targetUrl);
                    log.info(
                            "Daouoffice Notification Send Request Body: {}",
                            objectMapper.writeValueAsString(requestBody));
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

                        // ✅ 4xx/5xx면 응답 바디를 강제로 읽어서 로그 + 에러에 포함
                        .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                                .defaultIfEmpty("")
                                .flatMap(body -> {
                                    log.error(
                                            "Notification API error. status={}, url={}, responseBody={}",
                                            resp.statusCode(),
                                            targetUrl,
                                            body);
                                    return Mono.error(new RuntimeException(
                                            "HTTP " + resp.statusCode() + " from " + targetUrl + " body=" + body));
                                }))
                        .bodyToMono(String.class)

                        // ✅ 성공 응답 로그
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
                                    AppsmithPluginError.PLUGIN_ERROR,
                                    "Notification Send Failed: " + error.getMessage()));
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

        private Mono<ActionExecutionResult> executeApprovalRequest(
                WebClient connection, ActionConfiguration actionConfiguration) {

            ActionExecutionResult result = new ActionExecutionResult();

            try {
                String userId =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "userId", STRING_TYPE, "");
                String companyUuid = getDataValueSafelyFromFormData(
                        actionConfiguration.getFormData(), "companyUuid", STRING_TYPE, "");
                String formCode =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "formCode", STRING_TYPE, "");
                String title =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "title", STRING_TYPE, "");
                String content =
                        getDataValueSafelyFromFormData(actionConfiguration.getFormData(), "content", STRING_TYPE, "");

                // Multipart Body Builder
                // Using Spring's MultipartBodyBuilder
                org.springframework.http.client.MultipartBodyBuilder builder =
                        new org.springframework.http.client.MultipartBodyBuilder();
                builder.part("userId", userId);
                builder.part("companyUuid", companyUuid);
                builder.part("formCode", formCode);
                if (StringUtils.hasText(title)) {
                    builder.part("title", title);
                }
                if (StringUtils.hasText(content)) {
                    // Ensure content type is explicit if needed, but text/plain is default for
                    // string parts
                    builder.part("content", content);
                }

                // files is optional and currently empty

                String targetUrl =
                        "http://" + SERVICE_GATEWAY_HOST + ":" + SERVICE_GATEWAY_PORT + APPROVAL_REQUEST_PATH;

                // ✅ 요청 로그 (URL + Parts Summary)
                try {
                    log.info("Daouoffice Approval Send Request URL: {}", targetUrl);
                    log.info(
                            "Daouoffice Approval Send Request Params: userId={}, companyUuid={}, formCode={}, title={}",
                            userId,
                            companyUuid,
                            formCode,
                            title);
                } catch (Exception ignore) {
                }

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
                        .body(org.springframework.web.reactive.function.BodyInserters.fromMultipartData(
                                builder.build()))
                        .retrieve()

                        // ✅ 4xx/5xx handling
                        .onStatus(HttpStatusCode::isError, resp -> resp.bodyToMono(String.class)
                                .defaultIfEmpty("")
                                .flatMap(body -> {
                                    log.error(
                                            "Approval API error. status={}, url={}, responseBody={}",
                                            resp.statusCode(),
                                            targetUrl,
                                            body);
                                    return Mono.error(new RuntimeException(
                                            "HTTP " + resp.statusCode() + " from " + targetUrl + " body=" + body));
                                }))
                        .bodyToMono(String.class)

                        // ✅ Success Log
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

        private String getLeadAssignmentHtmlTemplate() {
            return "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;'>"
                    + "  <div style='background-color: #4A90E2; padding: 20px; text-align: center; color: white;'>"
                    + "    <h1 style='margin: 0; font-size: 24px;'>리드 배정 알림</h1>"
                    + "  </div>"
                    + "  <div style='padding: 30px; background-color: #ffffff;'>"
                    + "    <p style='font-size: 16px; color: #333;'>안녕하세요,</p>"
                    + "    <p style='font-size: 16px; color: #333;'>새로운 리드의 담당자로 배정되었습니다. <br>자세한 내용은 리드 관리 시스템에서 확인해 주세요.</p>"
                    + "    <div style='margin-top: 30px; text-align: center;'>"
                    + "      <a href='#' style='display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;'>리드 확인하기</a>"
                    + "    </div>"
                    + "  </div>"
                    + "  <div style='background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888;'>"
                    + "    © 2024 DaouOffice Lead Management"
                    + "  </div>"
                    + "</div>";
        }

        private String getLeadRegistrationHtmlTemplate() {
            return "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;'>"
                    + "  <div style='background-color: #4A90E2; padding: 20px; text-align: center; color: white;'>"
                    + "    <h1 style='margin: 0; font-size: 24px;'>리드 등록 알림</h1>"
                    + "  </div>"
                    + "  <div style='padding: 30px; background-color: #ffffff;'>"
                    + "    <p style='font-size: 16px; color: #333;'>안녕하세요,</p>"
                    + "    <p style='font-size: 16px; color: #333;'>새로운 리드가 등록되었습니다. <br>자세한 내용은 리드 관리 시스템에서 확인해 주세요.</p>"
                    + "    <div style='margin-top: 30px; text-align: center;'>"
                    + "      <a href='#' style='display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;'>등록된 리드 확인하기</a>"
                    + "    </div>"
                    + "  </div>"
                    + "  <div style='background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888;'>"
                    + "    © 2024 DaouOffice Lead Management"
                    + "  </div>"
                    + "</div>";
        }
    }
}
