import type { BoardUiModuleSummary } from "api/ModuleApi";
import {
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "ee/constants/ReduxActionConstants";
import type {
  FetchWorkspaceModulesPayload,
  FetchWorkspaceModulesSuccessPayload,
} from "ee/actions/moduleActions";
import type { ReduxAction } from "actions/ReduxActionTypes";
import { createImmerReducer } from "utils/ReducerUtils";

export interface ModulesReduxState {
  byWorkspaceId: Record<string, BoardUiModuleSummary[]>;
  isFetchingByWorkspaceId: Record<string, boolean>;
}

const initialState: ModulesReduxState = {
  byWorkspaceId: {},
  isFetchingByWorkspaceId: {},
};

const modulesReducer = createImmerReducer(initialState, {
  [ReduxActionTypes.FETCH_WORKSPACE_MODULES_INIT]: (
    draft: ModulesReduxState,
    action: ReduxAction<FetchWorkspaceModulesPayload>,
  ) => {
    const workspaceId = action.payload?.workspaceId;

    if (workspaceId) {
      draft.isFetchingByWorkspaceId[workspaceId] = true;
    }
  },
  [ReduxActionTypes.FETCH_WORKSPACE_MODULES_SUCCESS]: (
    draft: ModulesReduxState,
    action: ReduxAction<FetchWorkspaceModulesSuccessPayload>,
  ) => {
    const { modules = [], workspaceId } = action.payload;

    if (workspaceId) {
      draft.byWorkspaceId[workspaceId] = modules;
      draft.isFetchingByWorkspaceId[workspaceId] = false;
    }
  },
  [ReduxActionErrorTypes.FETCH_WORKSPACE_MODULES_ERROR]: (
    draft: ModulesReduxState,
    action: ReduxAction<FetchWorkspaceModulesPayload>,
  ) => {
    const workspaceId = action.payload?.workspaceId;

    if (workspaceId) {
      draft.isFetchingByWorkspaceId[workspaceId] = false;
    }
  },
});

export default modulesReducer;
