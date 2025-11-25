import type { MODULE_TYPE } from "ee/constants/ModuleConstants";
import type { ActionResponse } from "api/ActionAPI";
import type { PageAction } from "constants/AppsmithActionConstants/ActionConstants";

export type ModuleId = string;
export type ModuleInstanceId = string;

export enum ModuleInstanceCreatorType {
  MODULE = "MODULE",
  PAGE = "PAGE",
}
export interface ModuleInstance {
  id: ModuleInstanceId;
  type: MODULE_TYPE;
  name: string;
  sourceModuleId: ModuleId;
  moduleId?: string;
  modulePackageId?: string;
  moduleUUID?: string;
  workspaceId?: string;
  applicationId?: string;
  contextId?: string;
  contextType?: string;
  widgetId?: string;
  inputBindings?: Record<string, unknown>;
  outputBindings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  moduleDslSnapshots?: Array<Record<string, unknown>>;
  layoutOnLoadActions?: PageAction[][];
}

export interface ModuleInstanceData {
  config: ModuleInstance;
  data: ActionResponse | undefined;
  isLoading: boolean;
}
export type ModuleInstanceDataState = ModuleInstanceData[];
