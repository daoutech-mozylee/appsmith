import { eventChannel, type EventChannel } from "redux-saga";
import { call, put, take, fork, cancelled } from "redux-saga/effects";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";
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
 * 허용된 postMessage 타입
 */
const ALLOWED_MESSAGE_TYPES = {
  SET_ME: "APPSMITH_SET_ME",
} as const;

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
      if (type === ALLOWED_MESSAGE_TYPES.SET_ME && payload) {
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
 * postMessage 이벤트 처리 saga
 * 부모 창에서 전달받은 메시지를 Redux 액션으로 변환
 */
function* watchPostMessages() {
  const channel: EventChannel<PostMessageEvent> = yield call(
    createPostMessageChannel,
  );

  try {
    while (true) {
      const message: PostMessageEvent = yield take(channel);

      switch (message.type) {
        case ALLOWED_MESSAGE_TYPES.SET_ME:
          // SET_ME_DATA 액션 dispatch
          yield put({
            type: ReduxActionTypes.SET_ME_DATA,
            payload: message.payload,
          });
          log.info(
            "[PostMessageSaga] SET_ME_DATA dispatched:",
            message.payload,
          );
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
