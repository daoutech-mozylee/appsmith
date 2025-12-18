// eslint-disable-next-line @typescript-eslint/no-var-requires
const { match } = require("path-to-regexp");

// Global route prefix for all apps
export const ROUTE_PREFIX = "/all-apps";

export const BASE_URL = `${ROUTE_PREFIX}/`;
export const WORKSPACE_URL = `${ROUTE_PREFIX}/workspace`;
export const PAGE_NOT_FOUND_URL = `${ROUTE_PREFIX}/404`;
export const SERVER_ERROR_URL = `${ROUTE_PREFIX}/500`;
export const APPLICATIONS_URL = `${ROUTE_PREFIX}/applications`;
export const LICENSE_CHECK_PATH = `${ROUTE_PREFIX}/license`;
export const MIGRATIONS_URL = `${ROUTE_PREFIX}/migrations`;

export const TEMPLATES_PATH = `${ROUTE_PREFIX}/templates`;
export const TEMPLATES_ID_PATH = `${ROUTE_PREFIX}/templates/:templateId`;

export const USER_AUTH_URL = `${ROUTE_PREFIX}/user`;
export const PROFILE = `${ROUTE_PREFIX}/profile`;
export const GIT_PROFILE_ROUTE = `${PROFILE}/git`;
export const USERS_URL = `${ROUTE_PREFIX}/users`;
export const SETUP = `${ROUTE_PREFIX}/setup/welcome`;
export const FORGOT_PASSWORD_URL = `${USER_AUTH_URL}/forgotPassword`;
export const RESET_PASSWORD_URL = `${USER_AUTH_URL}/resetPassword`;
export const BASE_SIGNUP_URL = `${ROUTE_PREFIX}/signup`;
export const SIGN_UP_URL = `${USER_AUTH_URL}/signup`;
export const BASE_LOGIN_URL = `${ROUTE_PREFIX}/login`;
export const AUTH_LOGIN_URL = `${USER_AUTH_URL}/login`;
export const SIGNUP_SUCCESS_URL = `${ROUTE_PREFIX}/signup-success`;
export const WORKSPACE_INVITE_USERS_PAGE_URL = `${WORKSPACE_URL}/invite`;
export const WORKSPACE_SETTINGS_PAGE_URL = `${WORKSPACE_URL}/settings`;
export const WORKSPACE_SETTINGS_GENERAL_PAGE_URL = `${WORKSPACE_URL}/settings/general`;
export const WORKSPACE_SETTINGS_MEMBERS_PAGE_URL = `${WORKSPACE_URL}/settings/members`;
export const WORKSPACE_SETTINGS_LICENSE_PAGE_URL = `${ROUTE_PREFIX}/settings/license`;
export const ORG_LOGIN_PATH = `${ROUTE_PREFIX}/org`;

export const matchApplicationPath = match(APPLICATIONS_URL);
export const matchTemplatesPath = match(TEMPLATES_PATH);
export const matchTemplatesIdPath = match(TEMPLATES_ID_PATH);
