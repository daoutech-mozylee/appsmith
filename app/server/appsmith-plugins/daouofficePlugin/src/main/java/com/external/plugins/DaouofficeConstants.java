package com.external.plugins;

public final class DaouofficeConstants {

    private DaouofficeConstants() {
        // Utility class - prevent instantiation
    }

    // Service Gateway Configuration
    public static final String SERVICE_GATEWAY_HOST = "dop-service-gateway.dop-platform.svc.cluster.local";
    public static final int SERVICE_GATEWAY_PORT = 20719;

    // API Paths
    public static final String MAIL_SEND_PATH = "/api/mail/internal/noti/send";
    public static final String MESSAGE_SEND_PATH = "/api/chat/internal/message/user";
    public static final String NOTIFICATION_SEND_PATH = "/api/notifier/app/dop-employee-approval/user/notification/message";
    public static final String APPROVAL_REQUEST_PATH = "/gw/platform/api/approval/document/popup";
    public static final String CALENDAR_LIST_PATH = "/gw/platform/api/calendars";
    public static final String CALENDAR_EVENT_PATH = "/gw/platform/api/calendar/{calendarId}/event";

    // Action Identifiers (Must match root.json)
    public static final String ACTION_ORGANIZATION = "organization";
    public static final String ACTION_SEND_MAIL = "send_mail";
    public static final String ACTION_SEND_NOTIFICATION = "send_notification";
    public static final String ACTION_SEND_MESSAGE = "send_message";
    public static final String ACTION_SEND_APPROVAL = "send_approval";
    public static final String ACTION_GET_CALENDAR_LIST = "get_calendar_list";
    public static final String ACTION_CREATE_CALENDAR_EVENT = "create_calendar_event";

    // Mail Types
    public static final String MAIL_TYPE_PLAIN = "plainMail";
    public static final String MAIL_TYPE_LEAD_REGISTRATION = "leadRegistrationMail";
    public static final String MAIL_TYPE_LEAD_ASSIGNMENT = "leadAssignmentMail";
    public static final String MAIL_TYPE_LEAD_STATUS_UPDATE = "leadStatusUpdateMail";

    // Notification Types
    public static final String NOTIFICATION_TYPE_LEAD_REGISTRATION = "LEAD_REGISTRATION";
    public static final String NOTIFICATION_TYPE_LEAD_ASSIGNMENT = "LEAD_ASSIGNMENT";
    public static final String NOTIFICATION_TYPE_LEAD_STATUS_UPDATE = "LEAD_STATUS_UPDATE";

    // Default Values
    public static final String DEFAULT_SENDER_NAME = "다우오피스";
    public static final String DEFAULT_SENDER_EMAIL = "noreply@daouoffice.com";
    public static final String DEFAULT_PLATFORM_SENDER_ID = "1452552749567705088";
}
