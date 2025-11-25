import type { ModuleInstance } from "ee/constants/ModuleInstanceConstants";
import type { ModuleInstanceEntitiesState } from "ce/reducers/entityReducers/moduleInstanceEntitiesReducer";
import { ENTITY_TYPE } from "ee/entities/DataTree/types";

export const generateModuleInstance = (
  moduleInstance: ModuleInstance,
  moduleInstanceEntities: ModuleInstanceEntitiesState,
) => {
  if (!moduleInstance?.id) {
    return {
      configEntity: null,
      unEvalEntity: null,
    };
  }

  const entity = moduleInstanceEntities?.[moduleInstance.id];

  if (!entity) {
    return {
      configEntity: null,
      unEvalEntity: null,
    };
  }

  const unEvalEntity = {
    ...entity,
    name: moduleInstance.name,
    moduleInstanceId: moduleInstance.id,
    moduleWidgetId: moduleInstance.widgetId,
    layoutOnLoadActions: moduleInstance.layoutOnLoadActions,
    ENTITY_TYPE: ENTITY_TYPE.MODULE_INSTANCE,
  };

  const configEntity = {
    ENTITY_TYPE: ENTITY_TYPE.MODULE_INSTANCE,
    name: moduleInstance.name,
    type: moduleInstance.type,
    moduleInstanceId: moduleInstance.id,
    moduleId: moduleInstance.moduleId,
    modulePackageId: moduleInstance.modulePackageId,
  };

  return {
    configEntity,
    unEvalEntity,
  };
};
