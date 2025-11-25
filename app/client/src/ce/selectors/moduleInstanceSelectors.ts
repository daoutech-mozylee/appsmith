/* eslint-disable @typescript-eslint/no-unused-vars */
import type { DefaultRootState } from "react-redux";
import type { JSCollection } from "entities/JSCollection";
import type { ModuleInstanceEntitiesState } from "ce/reducers/entityReducers/moduleInstanceEntitiesReducer";
import type { ModuleInstanceDetails } from "api/ModuleApi";
import { createSelector } from "reselect";
import type { PageAction } from "constants/AppsmithActionConstants/ActionConstants";

const getModuleInstanceEntities = (
  state: DefaultRootState,
): ModuleInstanceEntitiesState =>
  (state.entities.moduleInstanceEntities ||
    {}) as ModuleInstanceEntitiesState;

export const getModuleInstanceById = (
  state: DefaultRootState,
  id: string,
): ModuleInstanceDetails | undefined => getModuleInstanceEntities(state)[id];

export const getModuleInstanceJSCollectionById = (
  state: DefaultRootState,
  jsCollectionId: string,
): JSCollection | undefined => {
  return undefined;
};

export const getAllUniqueWidgetTypesInUiModules = (
  _state: DefaultRootState,
) => {
  return [];
};

export const getModuleInstancePageLoadActions = createSelector(
  getModuleInstanceEntities,
  (entities): PageAction[][] => {
    const actionSets: PageAction[][] = [];

    Object.values(entities).forEach((entity) => {
      const moduleActions = entity?.moduleLayoutOnLoadActions;

      if (Array.isArray(moduleActions)) {
        moduleActions.forEach((actionSet) => {
          if (Array.isArray(actionSet) && actionSet.length > 0) {
            actionSets.push(actionSet as PageAction[]);
          }
        });
      }
    });

    return actionSets;
  },
);
