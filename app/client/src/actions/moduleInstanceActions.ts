import type { ModuleInstanceDetails } from "api/ModuleApi";
import type { ReduxAction } from "./ReduxActionTypes";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";

export interface FetchModuleInstancesPayload {
  pageId: string;
}

export const fetchModuleInstancesForPage = (
  pageId: string,
): ReduxAction<FetchModuleInstancesPayload> => ({
  type: ReduxActionTypes.FETCH_MODULE_INSTANCES_INIT,
  payload: { pageId },
});

export interface FetchModuleInstancesSuccessPayload {
  pageId: string;
  instances: ModuleInstanceDetails[];
}

export const fetchModuleInstancesSuccess = (
  pageId: string,
  instances: ModuleInstanceDetails[],
): ReduxAction<FetchModuleInstancesSuccessPayload> => ({
  type: ReduxActionTypes.FETCH_MODULE_INSTANCES_SUCCESS,
  payload: { pageId, instances },
});

export const fetchModuleInstancesError = (
  pageId: string,
): ReduxAction<FetchModuleInstancesPayload> => ({
  type: ReduxActionTypes.FETCH_MODULE_INSTANCES_ERROR,
  payload: { pageId },
});
