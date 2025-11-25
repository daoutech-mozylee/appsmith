import type { ReduxAction } from "actions/ReduxActionTypes";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";
import type { ModuleInstanceDetails } from "api/ModuleApi";

export type ModuleInstanceEntitiesState = Record<
  string,
  ModuleInstanceDetails
>;

const initialState: ModuleInstanceEntitiesState = {};

export default function moduleInstanceEntitiesReducer(
  state: ModuleInstanceEntitiesState = initialState,
  action: ReduxAction<unknown>,
): ModuleInstanceEntitiesState {
  switch (action.type) {
    case ReduxActionTypes.FETCH_MODULE_INSTANCES_SUCCESS: {
      const { instances } = action.payload as {
        instances: ModuleInstanceDetails[];
      };
      if (!Array.isArray(instances)) {
        return state;
      }

      const updatedState: ModuleInstanceEntitiesState = { ...state };

      instances.forEach((instance) => {
        updatedState[instance.id] = instance;
      });

      return updatedState;
    }
    default:
      return state;
  }
}
