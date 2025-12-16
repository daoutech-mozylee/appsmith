import { createReducer } from "utils/ReducerUtils";
import type { ReduxAction } from "actions/ReduxActionTypes";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";
import type { User } from "constants/userConstants";
import type { APP_MODE } from "entities/App";

export interface AuthUserState {
  username: string;
  email: string;
  id: string;
}

// 부서 정보
export interface DepartmentInfo {
  id: number;
  name: string;
  sortOrder?: number;
  code?: string;
  alias?: string;
  emailId?: string;
  deletedAt?: string;
  departmentPath?: string;
}

// 다우오피스 로그인 사용자 정보 (postMessage로 전달)
export interface MeDataState {
  id?: number;
  name?: string;
  loginId?: string;
  email?: string;
  departmentInfo?: Pick<
    DepartmentInfo,
    "id" | "name" | "emailId" | "alias" | "departmentPath"
  >;
  gradeName?: string;
  status?: string;
  companyId?: string;
  companyGroupId?: string | number;
  companyUuid?: string;
  companyName?: string;
  siteUrl?: string;
  profileImageUrl?: string;
  /** 경영업무포털 접근 가능 여부 */
  isBusinessPortalAccessible?: boolean;
  /** 통합설정 접근 가능 여부 */
  isSettingAccessible?: boolean;
  /** 아카이빙 접근 가능 여부 */
  isAccessibleArchivingService?: boolean;
  locale?: string;
  /** GNB 사용자화 선택 가능 여부 */
  enableGnbControl?: boolean;
  icon?: string;
  /** 회사 도메인 정보 */
  domain?: string;
  /** 직위 */
  positionName?: string;
  /** 부서 리스트 */
  departments?: DepartmentInfo[];
}

export interface UrlDataState {
  queryParams: Record<string, string>;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  hash: string;
  fullPath: string;
}

export type AppStoreState = Record<string, unknown>;

export interface AppDataState {
  mode?: APP_MODE;
  user: AuthUserState;
  URL: UrlDataState;
  store: AppStoreState;
  geolocation: {
    canBeRequested: boolean;
    currentPosition?: Partial<GeolocationPosition>;
  };
  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflows: Record<string, any>;
  pageSlug: Record<string, { isPersisting: boolean; isError: boolean }>;
  pageSlugValidation: { isValidating: boolean; isValid: boolean };
  // 다우오피스 로그인 사용자 정보 (postMessage로 전달)
  me: MeDataState;
}

/**
 * 기본 me 데이터 반환 (postMessage로 실제 데이터 수신 전까지 사용)
 */
const getDefaultMeData = (): MeDataState => {
  return {};
};

const initialState: AppDataState = {
  user: {
    username: "",
    email: "",
    id: "",
  },
  URL: {
    queryParams: {},
    protocol: "",
    host: "",
    hostname: "",
    port: "",
    pathname: "",
    hash: "",
    fullPath: "",
  },
  store: {},
  geolocation: {
    canBeRequested: "geolocation" in navigator,
    currentPosition: {},
  },
  workflows: {},
  pageSlug: {},
  pageSlugValidation: { isValidating: false, isValid: true },
  me: getDefaultMeData(),
};

const appReducer = createReducer(initialState, {
  [ReduxActionTypes.SET_APP_MODE]: (
    state: AppDataState,
    action: ReduxAction<APP_MODE>,
  ) => {
    return {
      ...state,
      mode: action.payload,
    };
  },
  [ReduxActionTypes.FETCH_USER_DETAILS_SUCCESS]: (
    state: AppDataState,
    action: ReduxAction<User>,
  ) => {
    return {
      ...state,
      user: action.payload,
    };
  },
  [ReduxActionTypes.SET_URL_DATA]: (
    state: AppDataState,
    action: ReduxAction<UrlDataState>,
  ) => {
    return {
      ...state,
      URL: action.payload,
    };
  },
  [ReduxActionTypes.UPDATE_APP_STORE]: (
    state: AppDataState,
    action: ReduxAction<Record<string, unknown>>,
  ) => {
    return {
      ...state,
      store: action.payload,
    };
  },
  [ReduxActionTypes.SET_USER_CURRENT_GEO_LOCATION]: (
    state: AppDataState,
    action: ReduxAction<{ position: GeolocationPosition }>,
  ): AppDataState => {
    return {
      ...state,
      geolocation: {
        ...state.geolocation,
        currentPosition: action.payload.position,
      },
    };
  },
  [ReduxActionTypes.PERSIST_PAGE_SLUG]: (
    state: AppDataState,
    action: ReduxAction<{ pageId: string; slug: string }>,
  ) => {
    return {
      ...state,
      pageSlug: {
        ...state.pageSlug,
        [action.payload.pageId]: {
          isPersisting: true,
          isError: false,
        },
      },
    };
  },
  [ReduxActionTypes.PERSIST_PAGE_SLUG_SUCCESS]: (
    state: AppDataState,
    action: ReduxAction<{ pageId: string; slug: string }>,
  ) => {
    return {
      ...state,
      pageSlug: {
        ...state.pageSlug,
        [action.payload.pageId]: {
          isPersisting: false,
          isError: false,
        },
      },
    };
  },
  [ReduxActionTypes.PERSIST_PAGE_SLUG_ERROR]: (
    state: AppDataState,
    action: ReduxAction<{ pageId: string; slug: string; error: unknown }>,
  ) => {
    return {
      ...state,
      pageSlug: {
        ...state.pageSlug,
        [action.payload.pageId]: {
          isPersisting: false,
          isError: true,
        },
      },
    };
  },
  [ReduxActionTypes.VALIDATE_PAGE_SLUG]: (state: AppDataState) => {
    return {
      ...state,
      pageSlugValidation: {
        isValidating: true,
        isValid: true, // Reset to valid while validating
      },
    };
  },
  [ReduxActionTypes.VALIDATE_PAGE_SLUG_SUCCESS]: (
    state: AppDataState,
    action: ReduxAction<{ slug: string; isValid: boolean }>,
  ) => {
    return {
      ...state,
      pageSlugValidation: {
        isValidating: false,
        isValid: action.payload.isValid,
      },
    };
  },
  [ReduxActionTypes.VALIDATE_PAGE_SLUG_ERROR]: (
    state: AppDataState,
    action: ReduxAction<{ slug: string; isValid: boolean }>,
  ) => {
    return {
      ...state,
      pageSlugValidation: {
        isValidating: false,
        isValid: action.payload.isValid,
      },
    };
  },
  // 다우오피스 사용자 정보 설정 (postMessage로 부모 창에서 전달받음)
  [ReduxActionTypes.SET_ME_DATA]: (
    state: AppDataState,
    action: ReduxAction<Partial<MeDataState>>,
  ) => {
    return {
      ...state,
      me: {
        ...state.me,
        ...action.payload,
      },
    };
  },
});

export default appReducer;
