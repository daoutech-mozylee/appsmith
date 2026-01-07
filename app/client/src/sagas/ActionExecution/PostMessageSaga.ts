import { call, spawn } from "redux-saga/effects";
import {
  showToastOnExecutionError,
  TriggerFailureError,
} from "sagas/ActionExecution/errorUtils";
import { isEmpty } from "lodash";
import type { TPostWindowMessageDescription } from "workers/Evaluation/fns/postWindowMessage";

export function* postMessageSaga(action: TPostWindowMessageDescription) {
  const { payload } = action;

  yield spawn(executePostMessage, payload);
}

export function* executePostMessage(
  payload: TPostWindowMessageDescription["payload"],
) {
  const { message, source, targetOrigin } = payload;

  try {
    if (isEmpty(targetOrigin)) {
      throw new TriggerFailureError("Please enter a target origin URL.");
    } else {
      if (source !== "window") {
        const src = document.getElementById(
          `iframe-${source}`,
        ) as HTMLIFrameElement;

        if (src && src.contentWindow) {
          src.contentWindow.postMessage(message, targetOrigin);
        } else {
          throw new TriggerFailureError(
            `Cannot find Iframe with name ${source} on this page`,
          );
        }
      } else {
        // OPEN_APPROVAL_POPUP 타입일 경우 같은 window에 메시지 전송
        if (
          typeof message === "object" &&
          message !== null &&
          (message as any).type === "OPEN_APPROVAL_POPUP"
        ) {
          window.postMessage(message, targetOrigin);
        } else {
          window.parent.postMessage(message, targetOrigin, undefined);
        }
      }
    }
  } catch (error) {
    yield call(showToastOnExecutionError, (error as Error).message);
  }
}
