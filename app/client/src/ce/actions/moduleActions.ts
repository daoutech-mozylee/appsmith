import type { BoardUiModuleSummary, UiModuleResponse } from "api/ModuleApi";
import {
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "ee/constants/ReduxActionConstants";
import type { UpdateCanvasPayload } from "actions/pageActions";
import type { ModuleUpdateRequest } from "api/ModuleApi";

export interface FetchWorkspaceModulesPayload {
  workspaceId: string;
}

export const fetchWorkspaceModules = (workspaceId: string) => ({
  type: ReduxActionTypes.FETCH_WORKSPACE_MODULES_INIT,
  payload: {
    workspaceId,
  },
});

export interface FetchWorkspaceModulesSuccessPayload {
  workspaceId: string;
  modules: BoardUiModuleSummary[];
}

export const fetchWorkspaceModulesSuccess = (
  workspaceId: string,
  modules: BoardUiModuleSummary[],
) => ({
  type: ReduxActionTypes.FETCH_WORKSPACE_MODULES_SUCCESS,
  payload: {
    workspaceId,
    modules,
  },
});

export const fetchWorkspaceModulesError = (workspaceId: string) => ({
  type: ReduxActionErrorTypes.FETCH_WORKSPACE_MODULES_ERROR,
  payload: {
    workspaceId,
  },
});

export interface FetchModulePayload {
  moduleId: string;
}

export const fetchModule = (moduleId: string) => ({
  type: ReduxActionTypes.FETCH_MODULE_INIT,
  payload: {
    moduleId,
  },
});

export interface FetchModuleSuccessPayload {
  moduleId: string;
  module: UiModuleResponse;
  canvas?: UpdateCanvasPayload;
}

export const fetchModuleSuccess = (
  moduleId: string,
  module: UiModuleResponse,
  canvas?: UpdateCanvasPayload,
) => ({
  type: ReduxActionTypes.FETCH_MODULE_SUCCESS,
  payload: {
    moduleId,
    module,
    canvas,
  },
});

export const fetchModuleError = (moduleId: string) => ({
  type: ReduxActionErrorTypes.FETCH_MODULE_ERROR,
  payload: {
    moduleId,
  },
});

export interface SaveModulePayload {
  moduleId: string;
  data: ModuleUpdateRequest;
  onSuccess?: () => void;
  onError?: (message?: string) => void;
}

export const saveModule = (
  payload: SaveModulePayload,
): ReduxAction<SaveModulePayload> => ({
  type: ReduxActionTypes.SAVE_MODULE_INIT,
  payload,
});

export const saveModuleSuccess = (
  moduleId: string,
  module: UiModuleResponse,
) => ({
  type: ReduxActionTypes.SAVE_MODULE_SUCCESS,
  payload: {
    moduleId,
    module,
  },
});

export const saveModuleError = (moduleId: string) => ({
  type: ReduxActionErrorTypes.SAVE_MODULE_ERROR,
  payload: {
    moduleId,
  },
});
