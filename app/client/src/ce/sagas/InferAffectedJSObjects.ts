import type { ReduxAction } from "actions/ReduxActionTypes";
import {
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "ee/constants/ReduxActionConstants";
import { JS_ACTIONS } from "ee/actions/evaluationActionsList";
import type { JSCollection } from "entities/JSCollection";
import type {
  AffectedJSObjects,
  BufferedReduxAction,
} from "actions/EvaluationReduxActionTypes";

/**
 * 커스텀 모듈 인스턴스 관련 액션에서 영향받는 JSObject 추론
 * REGISTER_MODULE_INSTANCE 시 커스텀 모듈의 JSObject가 새로 추가되므로
 * isAllAffected: true를 반환하여 전체 JSObject diff를 수행하도록 함
 */
export function getAffectedJSObjectIdsFromModuleInstance(
  action: ReduxAction<unknown> | BufferedReduxAction<unknown>,
): AffectedJSObjects {
  // 커스텀 모듈 인스턴스 등록/해제 시 전체 JSObject diff 수행
  if (
    action.type === ReduxActionTypes.REGISTER_MODULE_INSTANCE ||
    action.type === ReduxActionTypes.UNREGISTER_MODULE_INSTANCE
  ) {
    return {
      ids: [],
      isAllAffected: true,
    };
  }

  return {
    ids: [],
    isAllAffected: false,
  };
}

export function getAffectedJSObjectIdsFromJSAction(
  action: ReduxAction<unknown> | BufferedReduxAction<unknown>,
): AffectedJSObjects {
  if (action.type === ReduxActionTypes.FETCH_ALL_PAGE_ENTITY_COMPLETION) {
    return {
      ids: [],
      isAllAffected: true,
    };
  }

  if (!JS_ACTIONS.includes(action.type)) {
    return {
      ids: [],
      isAllAffected: false,
    };
  }

  // When fetching JSActions fails, we need to diff all JSObjects because the reducer updates it
  // to empty collection
  if (
    action.type === ReduxActionErrorTypes.FETCH_JS_ACTIONS_ERROR ||
    action.type === ReduxActionErrorTypes.FETCH_JS_ACTIONS_VIEW_MODE_ERROR
  ) {
    return {
      isAllAffected: true,
      ids: [],
    };
  }

  const { payload } = action as ReduxAction<{
    data: JSCollection;
  }> &
    ReduxAction<JSCollection>;
  // some actions have within data property of the action payload, we need to extract it from there
  const innerData = payload?.data || payload;

  const ids = Array.isArray(innerData)
    ? innerData.map(({ id }) => id)
    : [innerData.id];

  return { ids, isAllAffected: false };
}

function getAffectedJSObjectIdsFromBufferedAction(
  action: ReduxAction<unknown> | BufferedReduxAction<unknown>,
): AffectedJSObjects {
  if (action.type !== ReduxActionTypes.BUFFERED_ACTION) {
    return {
      ids: [],
      isAllAffected: false,
    };
  }

  // only Buffered actions here
  return (
    (action as BufferedReduxAction<unknown>).affectedJSObjects || {
      ids: [],
      isAllAffected: false,
    }
  );
}

export const AFFECTED_JS_OBJECTS_FNS = [
  getAffectedJSObjectIdsFromJSAction,
  getAffectedJSObjectIdsFromBufferedAction,
  getAffectedJSObjectIdsFromModuleInstance,
];
