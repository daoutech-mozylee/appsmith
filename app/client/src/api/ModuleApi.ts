import Api from "api/Api";
import type { AxiosPromise } from "axios";
import type { ApiResponse } from "api/ApiResponses";
import type {
  ModuleInputSection,
  ModuleOutputSection,
  ModuleDSL,
  ActionConfig,
  ActionCollectionConfig,
} from "constants/PackageModuleConstants";

/**
 * 모듈 메타데이터 (목록 조회 시 반환)
 */
export interface UIModuleMeta {
  icon?: string;
  color?: string;
  description?: string;
  tags?: string[];
}

/**
 * 모듈 목록 아이템 (목록 조회 시)
 * definition을 포함하지 않는 경량 DTO
 */
export interface UIModuleListItem {
  moduleUUID: string;
  packageUUID: string;
  moduleName: string;
  packageName: string;
  version: string;
  meta?: UIModuleMeta;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 모듈 definition 구조
 */
export interface UIModuleDefinition {
  layouts: {
    dsl: ModuleDSL;
  };
  inputsForm: ModuleInputSection[];
  outputsForm: ModuleOutputSection[];
  actionList?: ActionConfig[];
  actionCollectionList?: ActionCollectionConfig[];
}

/**
 * 모듈 상세 정보 (상세 조회 시)
 * definition을 포함하는 전체 DTO
 */
export interface UIModuleDetail extends UIModuleListItem {
  definition: UIModuleDefinition;
}

/**
 * 모듈 API 클라이언트
 *
 * Appsmith 서버의 UIModule API를 호출합니다.
 *
 * @example
 * ```typescript
 * // 목록 조회
 * const response = await ModuleApi.fetchModules();
 * const modules = response.data.data;
 *
 * // 상세 조회
 * const detail = await ModuleApi.fetchModuleDetail(moduleUUID);
 * ```
 */
class ModuleApi extends Api {
  static url = "v1/modules";

  /**
   * 모듈 목록 조회
   *
   * 활성화된 모든 모듈의 목록을 조회합니다.
   * definition은 포함되지 않으며, 목록 표시용 메타데이터만 반환됩니다.
   *
   * @returns 모듈 목록
   */
  static async fetchModules(): Promise<
    AxiosPromise<ApiResponse<UIModuleListItem[]>>
  > {
    return Api.get(ModuleApi.url);
  }

  /**
   * 모듈 상세 조회
   *
   * 특정 모듈의 전체 정보를 조회합니다.
   * definition (layouts, inputsForm, outputsForm, actions 등)이 포함됩니다.
   *
   * @param moduleUUID - 조회할 모듈의 UUID
   * @returns 모듈 상세 정보
   */
  static async fetchModuleDetail(
    moduleUUID: string,
  ): Promise<AxiosPromise<ApiResponse<UIModuleDetail>>> {
    return Api.get(`${ModuleApi.url}/${moduleUUID}`);
  }

  /**
   * 모듈 목록 조회 (캐시 무효화 포함)
   *
   * 캐시를 무시하고 최신 데이터를 가져옵니다.
   *
   * @returns 모듈 목록
   */
  static async fetchModulesNoCache(): Promise<
    AxiosPromise<ApiResponse<UIModuleListItem[]>>
  > {
    return Api.get(ModuleApi.url, { _t: Date.now() });
  }
}

export default ModuleApi;
