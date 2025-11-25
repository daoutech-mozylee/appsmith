import { fetchAllApplicationsOfWorkspace } from "ee/actions/applicationActions";
import { fetchWorkspaceModules } from "ee/actions/moduleActions";
import { fetchUsersForWorkspace } from "ee/actions/workspaceActions";
import {
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "ee/constants/ReduxActionConstants";

export const getWorkspaceEntitiesActions = (workspaceId: string = "") => {
  const initActions = [
    fetchAllApplicationsOfWorkspace(workspaceId),
    fetchUsersForWorkspace(workspaceId),
    fetchWorkspaceModules(workspaceId),
  ];

  const successActions = [
    ReduxActionTypes.FETCH_ALL_APPLICATIONS_OF_WORKSPACE_SUCCESS,
    ReduxActionTypes.FETCH_ALL_USERS_SUCCESS,
    ReduxActionTypes.FETCH_WORKSPACE_MODULES_SUCCESS,
  ];

  const errorActions = [
    ReduxActionErrorTypes.FETCH_ALL_APPLICATIONS_OF_WORKSPACE_ERROR,
    ReduxActionErrorTypes.FETCH_ALL_USERS_ERROR,
    ReduxActionErrorTypes.FETCH_WORKSPACE_MODULES_ERROR,
  ];

  return {
    initActions,
    successActions,
    errorActions,
  };
};
