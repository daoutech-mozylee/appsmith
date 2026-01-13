/**
 * Module Import API
 *
 * 릴레이 서버를 통해 모듈 JSON 파일을 업로드합니다.
 * Appsmith export 형식도 자동으로 UIModule 형식으로 변환합니다.
 *
 * @example
 * ```typescript
 * const result = await ModuleImportApi.uploadModule(file);
 * if (result.success) {
 *   console.log('Uploaded:', result.moduleInfo);
 * }
 * ```
 */

import axios from "axios";

// 릴레이 서버 URL (환경변수 또는 기본값)
const RELAY_SERVER_URL =
  (window as unknown as { RELAY_SERVER_URL?: string }).RELAY_SERVER_URL ||
  "/relay";

/**
 * 모듈 업로드 응답
 */
export interface ModuleUploadResponse {
  success: boolean;
  message?: string;
  moduleInfo?: {
    moduleUUID: string;
    moduleName: string;
    packageName: string;
    version: string;
  };
  validation?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Appsmith Export 형식
 */
interface AppsmithExportFormat {
  artifactJsonType?: string;
  exportedPackage?: {
    packageUUID: string;
    type: string;
    unpublishedPackage?: {
      name: string;
      icon?: string;
      color?: string;
    };
  };
  moduleList?: Array<{
    type: string;
    moduleUUID: string;
    deleted?: boolean;
    unpublishedModule?: {
      name: string;
      inputsForm?: unknown[];
      outputsForm?: unknown[];
      layouts?: Array<{
        dsl: unknown;
      }>;
    };
  }>;
  actionList?: unknown[];
  actionCollectionList?: unknown[];
}

/**
 * UIModule API 형식
 */
interface UIModuleFormat {
  moduleUUID: string;
  packageUUID: string;
  moduleName: string;
  packageName: string;
  version: string;
  meta?: {
    icon?: string;
    color?: string;
    description?: string;
  };
  definition: {
    layouts: Array<{ dsl: unknown }>;
    inputsForm: unknown[];
    outputsForm: unknown[];
    actionList: unknown[];
    actionCollectionList: unknown[];
  };
}

/**
 * Appsmith Export Format인지 확인
 */
function isAppsmithExportFormat(json: unknown): json is AppsmithExportFormat {
  const data = json as AppsmithExportFormat;

  return !!(
    data &&
    (data.artifactJsonType === "PACKAGE" ||
      (data.exportedPackage && data.moduleList))
  );
}

/**
 * UIModule Format인지 확인
 */
function isUIModuleFormat(json: unknown): json is UIModuleFormat {
  const data = json as UIModuleFormat;

  return !!(data && data.moduleUUID && data.packageUUID && data.definition);
}

/**
 * Appsmith Export Format -> UIModule Format 변환
 */
function convertAppsmithExportToUIModule(
  exportJson: AppsmithExportFormat,
  filename?: string,
): UIModuleFormat[] {
  const modules: UIModuleFormat[] = [];

  const { actionCollectionList, actionList, exportedPackage, moduleList } =
    exportJson;

  if (!exportedPackage || !moduleList) {
    throw new Error(
      "Invalid Appsmith export format: missing exportedPackage or moduleList",
    );
  }

  const packageUUID = exportedPackage.packageUUID;
  const packageName = exportedPackage.unpublishedPackage?.name || "Unknown";
  const packageIcon = exportedPackage.unpublishedPackage?.icon;
  const packageColor = exportedPackage.unpublishedPackage?.color;

  // 각 모듈 변환
  moduleList
    .filter((module) => !module.deleted && module.type === "UI_MODULE")
    .forEach((module) => {
      const moduleUUID = module.moduleUUID;
      const moduleName =
        module.unpublishedModule?.name || filename || "Unknown";

      // 이 모듈에 속한 액션들 필터링
      const moduleActions = (actionList || []).filter((action) => {
        const a = action as {
          deleted?: boolean;
          unpublishedAction?: { moduleId?: string };
        };

        return !a.deleted && a.unpublishedAction?.moduleId === moduleName;
      });

      // 이 모듈에 속한 JS 컬렉션 필터링
      const moduleActionCollections = (actionCollectionList || []).filter(
        (collection) => {
          const c = collection as {
            deleted?: boolean;
            unpublishedCollection?: { moduleId?: string };
          };

          return !c.deleted && c.unpublishedCollection?.moduleId === moduleName;
        },
      );

      // layouts 배열 구성
      const layouts = module.unpublishedModule?.layouts || [];
      const layoutsForApi = layouts.map((layout) => ({
        dsl: layout.dsl,
      }));

      // UIModule 형식으로 변환
      const uiModule: UIModuleFormat = {
        moduleUUID,
        packageUUID,
        moduleName,
        packageName,
        version: "1.0.0",
        meta: {
          icon: packageIcon,
          color: packageColor,
          description: `Imported from ${filename || "export file"}`,
        },
        definition: {
          layouts: layoutsForApi,
          inputsForm: module.unpublishedModule?.inputsForm || [],
          outputsForm: module.unpublishedModule?.outputsForm || [],
          actionList: moduleActions,
          actionCollectionList: moduleActionCollections,
        },
      };

      modules.push(uiModule);
    });

  return modules;
}

/**
 * Module Import API
 */
class ModuleImportApi {
  private baseUrl = RELAY_SERVER_URL;

  /**
   * JSON 파일 읽기
   */
  private async readFileAsJson(file: File): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string);

          resolve(json);
        } catch (e) {
          reject(new Error("Invalid JSON file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  /**
   * 모듈 JSON 파일 업로드
   * Appsmith export 형식도 자동으로 UIModule 형식으로 변환합니다.
   *
   * @param file - JSON 파일
   * @param options - 업로드 옵션 (version, changeLog)
   * @returns 업로드 결과
   */
  async uploadModule(
    file: File,
    options?: {
      version?: string;
      changeLog?: string;
    },
  ): Promise<ModuleUploadResponse> {
    try {
      // 파일 읽기
      const json = await this.readFileAsJson(file);
      const filename = file.name.replace(/\.json$/i, "");

      let modulesToUpload: UIModuleFormat[] = [];

      // 형식 감지 및 변환
      if (isUIModuleFormat(json)) {
        // 이미 UIModule 형식
        modulesToUpload = [json];
      } else if (isAppsmithExportFormat(json)) {
        // Appsmith export 형식 -> UIModule 형식 변환
        modulesToUpload = convertAppsmithExportToUIModule(json, filename);

        if (modulesToUpload.length === 0) {
          return {
            success: false,
            message: "No UI modules found in the export file",
            validation: {
              valid: false,
              errors: ["No UI modules found in the export file"],
              warnings: [],
            },
          };
        }
      } else {
        return {
          success: false,
          message:
            "Unknown JSON format. Expected Appsmith export or UIModule format.",
          validation: {
            valid: false,
            errors: ["Unknown JSON format"],
            warnings: [],
          },
        };
      }

      // 모듈 업로드 (각각 업로드)
      const results: ModuleUploadResponse[] = [];

      for (const module of modulesToUpload) {
        // 버전 오버라이드
        if (options?.version) {
          module.version = options.version;
        }

        const formData = new FormData();
        const moduleBlob = new Blob([JSON.stringify(module)], {
          type: "application/json",
        });

        formData.append("file", moduleBlob, `${module.moduleName}.json`);

        if (options?.changeLog) {
          formData.append("changeLog", options.changeLog);
        }

        const response = await axios.post<ModuleUploadResponse>(
          `${this.baseUrl}/api/modules/upload`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        results.push(response.data);
      }

      // 결과 집계
      const allSuccess = results.every((r) => r.success);
      const errors: string[] = [];
      const warnings: string[] = [];

      results.forEach((r) => {
        if (r.validation?.errors) {
          errors.push(...r.validation.errors);
        }

        if (r.validation?.warnings) {
          warnings.push(...r.validation.warnings);
        }
      });

      if (allSuccess) {
        const firstModule = modulesToUpload[0];

        return {
          success: true,
          message: `Successfully uploaded ${modulesToUpload.length} module(s)`,
          moduleInfo: {
            moduleUUID: firstModule.moduleUUID,
            moduleName: firstModule.moduleName,
            packageName: firstModule.packageName,
            version: firstModule.version,
          },
          validation: {
            valid: true,
            errors: [],
            warnings,
          },
        };
      } else {
        return {
          success: false,
          message: "Some modules failed to upload",
          validation: {
            valid: false,
            errors,
            warnings,
          },
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data as ModuleUploadResponse;
      }

      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        validation: {
          valid: false,
          errors: ["Failed to upload module"],
          warnings: [],
        },
      };
    }
  }

  /**
   * 모듈 JSON 파일 검증만 수행 (업로드 없이)
   *
   * @param file - JSON 파일
   * @returns 검증 결과
   */
  async validateModule(file: File): Promise<ModuleUploadResponse> {
    try {
      // 파일 읽기
      const json = await this.readFileAsJson(file);
      const filename = file.name.replace(/\.json$/i, "");

      // 형식 감지 및 변환
      if (isUIModuleFormat(json)) {
        return {
          success: true,
          message: "Valid UIModule format",
          moduleInfo: {
            moduleUUID: json.moduleUUID,
            moduleName: json.moduleName,
            packageName: json.packageName,
            version: json.version,
          },
          validation: {
            valid: true,
            errors: [],
            warnings: [],
          },
        };
      } else if (isAppsmithExportFormat(json)) {
        const modules = convertAppsmithExportToUIModule(json, filename);

        if (modules.length === 0) {
          return {
            success: false,
            message: "No UI modules found in the export file",
            validation: {
              valid: false,
              errors: ["No UI modules found"],
              warnings: [],
            },
          };
        }

        const firstModule = modules[0];

        return {
          success: true,
          message: `Valid Appsmith export format (${modules.length} module(s) found)`,
          moduleInfo: {
            moduleUUID: firstModule.moduleUUID,
            moduleName: firstModule.moduleName,
            packageName: firstModule.packageName,
            version: firstModule.version,
          },
          validation: {
            valid: true,
            errors: [],
            warnings: [
              "File will be converted from Appsmith export format to UIModule format",
            ],
          },
        };
      } else {
        return {
          success: false,
          message: "Unknown JSON format",
          validation: {
            valid: false,
            errors: [
              "Unknown JSON format. Expected Appsmith export or UIModule format.",
            ],
            warnings: [],
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        validation: {
          valid: false,
          errors: ["Failed to validate module"],
          warnings: [],
        },
      };
    }
  }
}

export default new ModuleImportApi();
