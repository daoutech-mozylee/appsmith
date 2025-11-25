import Api from "api/Api";
import type { ApiResponse } from "api/ApiResponses";
import type { PageAction } from "constants/AppsmithActionConstants/ActionConstants";

export type CreatorContextType =
  | "PAGE"
  | "MODULE"
  | "WORKFLOW"
  | "APPLICATION"
  | "PACKAGE";

export interface ModuleFormField {
  id: string;
  label?: string;
  propertyName?: string;
  controlType?: string;
  dataType?: string;
  required?: boolean;
  defaultValue?: unknown;
  configuration?: Record<string, unknown>;
}

export interface ModuleFormSection {
  id: string;
  sectionName?: string;
  children?: ModuleFormField[];
}

export interface ModuleLayoutPayload {
  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dsl: Record<string, any>;
  layoutOnLoadActions?: unknown[];
  layoutOnLoadActionErrors?: unknown[];
}

export interface ModulePackageCreateRequest {
  name: string;
  workspaceId: string;
  icon?: string;
  color?: string;
  description?: string;
}

export interface ModuleCreateRequest {
  packageId: string;
  workspaceId: string;
  unpublishedModule: {
    name: string;
    moduleUUID: string;
    icon?: string;
    color?: string;
    description?: string;
    layouts: ModuleLayoutPayload[];
    inputsForm?: ModuleFormSection[];
    outputsForm?: ModuleFormSection[];
    dependencyMap?: Record<string, string[]>;
  };
}

export interface ModuleUpdateRequest {
  unpublishedModule: {
    name?: string;
    icon?: string;
    color?: string;
    description?: string;
    layouts?: ModuleLayoutPayload[];
    inputsForm?: ModuleFormSection[];
    outputsForm?: ModuleFormSection[];
    dependencyMap?: Record<string, string[]>;
  };
}

export interface ModuleInstanceCreateRequest {
  sourceModuleId: string;
  contextId: string;
  contextType: CreatorContextType;
  name: string;
  widgetId: string;
  inputBindings?: Record<string, unknown>;
  outputBindings?: Record<string, unknown>;
}

export interface ModulePackageResponse {
  id: string;
  name: string;
  workspaceId: string;
}

export interface UiModuleVersion {
  name?: string;
  moduleUUID?: string;
  icon?: string;
  color?: string;
  description?: string;
  layouts?: ModuleLayoutPayload[];
  inputsForm?: ModuleFormSection[];
  outputsForm?: ModuleFormSection[];
  dependencyMap?: Record<string, string[]>;
}

export interface UiModuleResponse {
  id: string;
  packageId: string;
  moduleUUID?: string;
  unpublishedModule?: UiModuleVersion;
  publishedModule?: UiModuleVersion;
  workspaceId?: string;
}

export interface ModuleInstanceResponse {
  id: string;
  sourceModuleId: string;
  moduleId?: string;
  moduleUUID?: string;
}

export interface ModuleInstanceDetails {
  id: string;
  sourceModuleId: string;
  moduleId?: string;
  modulePackageId?: string;
  moduleUUID?: string;
  workspaceId?: string;
  applicationId?: string;
  contextId: string;
  contextType: CreatorContextType;
  name: string;
  widgetId?: string;
  inputBindings?: Record<string, unknown>;
  outputBindings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  moduleDslSnapshots?: Array<Record<string, unknown>>;
  moduleLayoutOnLoadActions?: PageAction[][];
}

const MODULE_PACKAGE_URL = "v1/module-packages";
const MODULE_URL = "v1/modules";
const MODULE_INSTANCE_URL = "v1/module-instances";

export type BoardUiModuleSummary = UiModuleResponse;

export const ModuleApi = {
  createModulePackage: (
    payload: ModulePackageCreateRequest,
  ): Promise<ApiResponse<ModulePackageResponse>> =>
    Api.post(MODULE_PACKAGE_URL, payload),
  createModule: (
    payload: ModuleCreateRequest,
  ): Promise<ApiResponse<UiModuleResponse>> => Api.post(MODULE_URL, payload),
  fetchModule: (moduleId: string): Promise<ApiResponse<UiModuleResponse>> =>
    Api.get(`${MODULE_URL}/${moduleId}`),
  updateModule: (
    moduleId: string,
    payload: ModuleUpdateRequest,
  ): Promise<ApiResponse<UiModuleResponse>> =>
    Api.put(`${MODULE_URL}/${moduleId}`, payload),
  createModuleInstance: (
    payload: ModuleInstanceCreateRequest,
  ): Promise<ApiResponse<ModuleInstanceResponse>> =>
    Api.post(MODULE_INSTANCE_URL, payload),
  fetchModuleInstancesForContext: (
    contextType: CreatorContextType,
    contextId: string,
  ): Promise<ApiResponse<ModuleInstanceDetails[]>> =>
    Api.get(`${MODULE_INSTANCE_URL}/context/${contextType}/${contextId}`),
  fetchWorkspaceModules: (
    workspaceId: string,
  ): Promise<ApiResponse<BoardUiModuleSummary[]>> =>
    Api.get(`${MODULE_URL}/workspace/${workspaceId}`),
};

export default ModuleApi;
