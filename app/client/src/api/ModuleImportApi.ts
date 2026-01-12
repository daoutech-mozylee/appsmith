/**
 * Module Import API
 *
 * 릴레이 서버를 통해 모듈 JSON 파일을 업로드합니다.
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
 * Module Import API
 */
class ModuleImportApi {
  private baseUrl = RELAY_SERVER_URL;

  /**
   * 모듈 JSON 파일 업로드
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
    const formData = new FormData();

    formData.append("file", file);

    if (options?.version) {
      formData.append("version", options.version);
    }

    if (options?.changeLog) {
      formData.append("changeLog", options.changeLog);
    }

    try {
      const response = await axios.post<ModuleUploadResponse>(
        `${this.baseUrl}/api/modules/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return response.data;
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
    const formData = new FormData();

    formData.append("file", file);

    try {
      const response = await axios.post<ModuleUploadResponse>(
        `${this.baseUrl}/api/modules/validate`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return response.data;
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
          errors: ["Failed to validate module"],
          warnings: [],
        },
      };
    }
  }
}

export default new ModuleImportApi();
