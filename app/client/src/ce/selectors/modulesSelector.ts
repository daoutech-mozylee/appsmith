import type { DefaultRootState } from "react-redux";
import type { Module } from "ee/constants/ModuleConstants";
import type { BoardUiModuleSummary } from "api/ModuleApi";
import type { ModulesReduxState } from "reducers/uiReducers/modulesReducer";
import type { ModuleEditorState } from "reducers/uiReducers/moduleEditorReducer";
import { createSelector } from "reselect";

const getModulesState = (
  state: DefaultRootState,
): ModulesReduxState => state.ui.modules as ModulesReduxState;

const getModuleEditorState = (
  state: DefaultRootState,
): ModuleEditorState => state.ui.moduleEditor as ModuleEditorState;

export const getAllModules = createSelector(
  getModulesState,
  (modulesState): Record<string, Module> | Record<string, Module> => {
    // Temporary compatibility layer until module domain is fully defined.
    // Consumers expecting Module record can derive from the per-workspace map.
    return modulesState.byWorkspaceId as unknown as Record<string, Module>;
  },
);

export const getModulesForWorkspace = (
  state: DefaultRootState,
  workspaceId?: string,
): BoardUiModuleSummary[] => {
  if (!workspaceId) {
    return [];
  }

  const modulesState = getModulesState(state);

  return modulesState.byWorkspaceId[workspaceId] || [];
};

export const getIsFetchingModulesForWorkspace = (
  state: DefaultRootState,
  workspaceId?: string,
): boolean => {
  if (!workspaceId) {
    return false;
  }

  const modulesState = getModulesState(state);

  return !!modulesState.isFetchingByWorkspaceId[workspaceId];
};

export const getCurrentModuleId = (_state: DefaultRootState) => "";

export const getCurrentBaseModuleId = (_state: DefaultRootState) => "";

export const showUIModulesList = createSelector(
  getModulesState,
  (modulesState) =>
    Object.values(modulesState.byWorkspaceId).some(
      (modules) => Array.isArray(modules) && modules.length > 0,
    ),
);

export const getActionsInCurrentModule = (_state: DefaultRootState) => [];
export const getJSCollectionsInCurrentModule = (_state: DefaultRootState) => [];

export const getModuleInstanceActions = (_state: DefaultRootState) => [];
export const getModuleInstanceJSCollections = (
  _state: DefaultRootState,
) => [];

export const getModuleEditorModule = (state: DefaultRootState) =>
  getModuleEditorState(state).data;

export const getIsModuleEditorLoading = (state: DefaultRootState) =>
  getModuleEditorState(state).isFetching;

export const getModuleEditorError = (state: DefaultRootState) =>
  getModuleEditorState(state).error;

export const getModuleEditorCanvas = (state: DefaultRootState) =>
  getModuleEditorState(state).canvas;

export const getIsModuleSaving = (state: DefaultRootState) =>
  getModuleEditorState(state).isSaving;
