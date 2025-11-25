import type { UiModuleResponse } from "api/ModuleApi";
import type { UpdateCanvasPayload } from "actions/pageActions";
import type { ReduxAction } from "actions/ReduxActionTypes";
import {
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "ee/constants/ReduxActionConstants";
import type {
  FetchModulePayload,
  FetchModuleSuccessPayload,
} from "ee/actions/moduleActions";
import { createImmerReducer } from "utils/ReducerUtils";

export interface ModuleEditorState {
  isFetching: boolean;
  isSaving: boolean;
  moduleId?: string;
  data?: UiModuleResponse;
  canvas?: UpdateCanvasPayload;
  error?: string;
}

const initialState: ModuleEditorState = {
  isFetching: false,
  isSaving: false,
};

const moduleEditorReducer = createImmerReducer(initialState, {
  [ReduxActionTypes.FETCH_MODULE_INIT]: (
    draft: ModuleEditorState,
    action: ReduxAction<FetchModulePayload>,
  ) => {
    draft.isFetching = true;
    draft.moduleId = action.payload.moduleId;
    draft.error = undefined;
  },
  [ReduxActionTypes.FETCH_MODULE_SUCCESS]: (
    draft: ModuleEditorState,
    action: ReduxAction<FetchModuleSuccessPayload>,
  ) => {
    draft.isFetching = false;
    draft.moduleId = action.payload.moduleId;
    draft.data = action.payload.module;
     draft.canvas = action.payload.canvas;
    draft.error = undefined;
  },
  [ReduxActionErrorTypes.FETCH_MODULE_ERROR]: (
    draft: ModuleEditorState,
    action: ReduxAction<FetchModulePayload>,
  ) => {
    draft.isFetching = false;
    draft.error = "FAILED_TO_FETCH_MODULE";
    draft.moduleId = action.payload.moduleId;
  },
  [ReduxActionTypes.SAVE_MODULE_INIT]: (draft: ModuleEditorState) => {
    draft.isSaving = true;
  },
  [ReduxActionTypes.SAVE_MODULE_SUCCESS]: (
    draft: ModuleEditorState,
    action: ReduxAction<{ moduleId: string; module: UiModuleResponse }>,
  ) => {
    draft.isSaving = false;
    draft.data = action.payload.module;
    draft.error = undefined;
  },
  [ReduxActionErrorTypes.SAVE_MODULE_ERROR]: (
    draft: ModuleEditorState,
  ) => {
    draft.isSaving = false;
  },
});

export default moduleEditorReducer;
