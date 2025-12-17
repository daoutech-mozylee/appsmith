import { eventChannel, type EventChannel } from "redux-saga";
import {
  call,
  put,
  take,
  fork,
  cancelled,
  race,
  delay,
  select,
} from "redux-saga/effects";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";
import { ERROR_CODES } from "ee/constants/ApiConstants";
import { safeCrashAppRequest } from "actions/errorActions";
import { getIsUserLoggedIn } from "selectors/usersSelectors";
import type { MeDataState } from "reducers/entityReducers/appReducer";
import log from "loglevel";

/**
 * postMessage 이벤트 타입 정의
 * 부모 창에서 보내는 메시지 형식
 */
interface PostMessageEvent {
  type: string;
  payload: Partial<MeDataState>;
}

/**
 * 부모로부터 수신하는 메시지 타입
 */
const INCOMING_MESSAGE_TYPES = {
  SET_ME: "APPSMITH_SET_ME",
} as const;

/**
 * 부모에게 전송하는 메시지 타입
 */
const OUTGOING_MESSAGE_TYPES = {
  READY: "APPSMITH_READY",
} as const;

/**
 * 인증 데이터 수신 타임아웃 (ms)
 */
const AUTH_TIMEOUT_MS = 5000;

/**
 * iframe 내부에서 실행 중인지 확인
 */
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    // cross-origin iframe인 경우 접근 시 에러 발생 → iframe 내부로 판단
    return true;
  }
}

/**
 * 부모 창에 메시지 전송
 */
function sendMessageToParent(type: string, payload?: unknown): void {
  if (!isInIframe()) return;

  window.parent.postMessage(
    { type, payload },
    "*", // 부모 origin을 모르므로 * 사용 (READY 메시지는 민감하지 않음)
  );
}

/**
 * postMessage 이벤트 채널 생성
 * window의 message 이벤트를 Redux Saga에서 처리할 수 있도록 변환
 */
function createPostMessageChannel(): EventChannel<PostMessageEvent> {
  return eventChannel((emit) => {
    const handleMessage = (event: MessageEvent) => {
      // 메시지 데이터 검증
      if (!event.data || typeof event.data !== "object") {
        return;
      }

      const { payload, type } = event.data;

      // 허용된 메시지 타입만 처리
      if (type === INCOMING_MESSAGE_TYPES.SET_ME && payload) {
        log.debug("[PostMessageSaga] Received SET_ME message:", payload);
        emit({ type, payload });
      }
    };

    // 이벤트 리스너 등록
    window.addEventListener("message", handleMessage, false);
    log.info("[PostMessageSaga] postMessage listener registered");

    // cleanup 함수 (채널이 닫힐 때 호출)
    return () => {
      window.removeEventListener("message", handleMessage, false);
      log.info("[PostMessageSaga] postMessage listener removed");
    };
  });
}

/**
 * 타임아웃 시 에러 처리 saga
 * 부모로부터 인증 데이터를 받지 못한 경우 에러 페이지 표시
 */
function* handleAuthTimeout() {
  log.error("[PostMessageSaga] Auth timeout - no response from parent");
  yield put(safeCrashAppRequest(ERROR_CODES.IFRAME_AUTH_ERROR));
}

/**
 * SET_ME 메시지 처리
 */
function* handleSetMeMessage(message: PostMessageEvent) {
  yield put({
    type: ReduxActionTypes.SET_ME_DATA,
    payload: message.payload,
  });
  log.info("[PostMessageSaga] SET_ME_DATA dispatched:", message.payload);
}

/**
 * iframe 환경에서의 인증 handshake 처리
 * 1. 부모에게 READY 메시지 전송
 * 2. 타임아웃 내에 SET_ME 메시지 대기
 * 3. 타임아웃 시 fallback 처리
 */
function* handleIframeAuth(channel: EventChannel<PostMessageEvent>) {
  // 부모에게 준비 완료 알림
  sendMessageToParent(OUTGOING_MESSAGE_TYPES.READY);
  log.info("[PostMessageSaga] Sent READY message to parent");

  // 타임아웃과 메시지 수신 race
  const { message, timeout } = yield race({
    message: take(channel),
    timeout: delay(AUTH_TIMEOUT_MS),
  });

  if (timeout) {
    yield* handleAuthTimeout();

    return false; // 인증 실패
  }

  if (message) {
    yield* handleSetMeMessage(message);

    return true; // 인증 성공
  }

  return false;
}

/**
 * iframe이 아닐 때 Appsmith 인증 확인
 * 인증되지 않은 직접 접근은 에러 페이지 표시
 */
function* handleNonIframeAccess() {
  log.info(
    "[PostMessageSaga] Not running inside iframe, checking Appsmith auth",
  );

  // 사용자 정보 로드 완료 대기
  yield take(ReduxActionTypes.FETCH_USER_DETAILS_SUCCESS);

  // Appsmith 인증 확인
  const isLoggedIn: boolean = yield select(getIsUserLoggedIn);

  if (!isLoggedIn) {
    log.error(
      "[PostMessageSaga] Not in iframe and not authenticated - showing error",
    );
    yield put(safeCrashAppRequest(ERROR_CODES.IFRAME_AUTH_ERROR));

    return false;
  }

  log.info("[PostMessageSaga] Appsmith authenticated, allowing access");

  return true;
}

/**
 * postMessage 이벤트 처리 saga
 * 부모 창에서 전달받은 메시지를 Redux 액션으로 변환
 */
function* watchPostMessages() {
  // iframe이 아닌 경우: Appsmith 인증 확인 후 종료 (postMessage 리스닝 불필요)
  if (!isInIframe()) {
    yield* handleNonIframeAccess();

    return;
  }

  // iframe 환경: postMessage 채널 생성 및 리스닝
  log.info("[PostMessageSaga] Running inside iframe, initiating handshake");

  const channel: EventChannel<PostMessageEvent> = yield call(
    createPostMessageChannel,
  );

  try {
    // handshake 처리
    const authSuccess: boolean = yield* handleIframeAuth(channel);

    if (!authSuccess) {
      // 인증 실패 시 더 이상 메시지 리스닝 불필요
      return;
    }

    // 이후 추가 메시지 계속 리스닝 (me 데이터 업데이트 등)
    while (true) {
      const message: PostMessageEvent = yield take(channel);

      switch (message.type) {
        case INCOMING_MESSAGE_TYPES.SET_ME:
          yield* handleSetMeMessage(message);
          break;

        default:
          log.warn("[PostMessageSaga] Unknown message type:", message.type);
      }
    }
  } finally {
    // saga가 취소되면 채널 닫기
    const isCancelled: boolean = yield cancelled();

    if (isCancelled) {
      channel.close();
    }
  }
}

/**
 * postMessage saga 루트
 * 앱 초기화 시 호출되어 postMessage 리스너를 설정
 */
export default function* postMessageSaga() {
  yield fork(watchPostMessages);
}
