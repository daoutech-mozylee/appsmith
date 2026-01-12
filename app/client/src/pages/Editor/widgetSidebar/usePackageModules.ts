import { useState, useEffect, useCallback, useMemo } from "react";
import type { PackageModuleCard } from "constants/PackageModuleConstants";
import { ModuleRegistry } from "utils/ModuleRegistry";

// ModuleRegistry 초기화 및 헬퍼 함수들을 utils에서 re-export
// 초기화 로직은 utils/moduleRegistryInit.ts에서 관리 (Editor/Viewer 모두에서 로드됨)
export {
  PRELOADED_MODULES,
  getOutputsFormByModuleUUID,
  getInputsFormByModuleUUID,
} from "utils/moduleRegistryInit";

import { PRELOADED_MODULES } from "utils/moduleRegistryInit";

/**
 * API 로딩을 포함한 모듈 로딩 설정
 */
interface UsePackageModulesOptions {
  /**
   * API 로딩 사용 여부 (기본값: false - 기존 동작 유지)
   * true: API에서 모듈 목록 로드 시도 후 실패 시 PRELOADED_MODULES 폴백
   * false: PRELOADED_MODULES만 사용 (동기)
   */
  useApi?: boolean;
}

/**
 * 레지스트리 데이터를 PackageModuleCard 형식으로 변환
 */
function convertToPackageModuleCards(): PackageModuleCard[] {
  const all = ModuleRegistry.getAllPartial();

  return all.map((item) => {
    // Partial인 경우 메타데이터만 반환
    if ("_isPartial" in item && item._isPartial) {
      return {
        moduleUUID: item.moduleUUID,
        packageUUID: item.packageUUID,
        moduleName: item.moduleName,
        packageName: item.packageName,
        icon: item.icon,
        color: item.color,
        // definition 필드들은 빈 값 (지연 로딩됨)
        inputsForm: [],
        outputsForm: [],
        dsl: { widgetName: "", type: "CANVAS_WIDGET" },
        actions: [],
        actionCollections: [],
        _isPartial: true,
      } as PackageModuleCard & { _isPartial: true };
    }

    // Full definition인 경우
    return {
      moduleUUID: item.moduleUUID,
      packageUUID: item.packageUUID,
      moduleName: item.moduleName,
      packageName: item.packageName,
      icon: item.icon,
      color: item.color,
      inputsForm: item.inputsForm,
      outputsForm: item.outputsForm,
      dsl: item.dsl,
      actions: item.actions,
      actionCollections: item.actionCollections,
    } as PackageModuleCard;
  });
}

/**
 * Package 모듈을 반환하는 훅
 *
 * 기본 동작: require.context로 빌드 시점에 로드된 PRELOADED_MODULES 반환 (동기)
 *
 * API 연동: useApi=true 옵션 사용 시 API에서 모듈 목록 로드
 * - API 로딩 성공: API 데이터 사용
 * - API 로딩 실패: PRELOADED_MODULES 폴백
 *
 * @param options - 로딩 옵션
 * @returns packageModules, isLoading, error, refresh
 */
export const usePackageModules = (options: UsePackageModulesOptions = {}) => {
  const { useApi = false } = options;

  const [isLoading, setIsLoading] = useState(useApi);
  const [error, setError] = useState<Error | null>(null);
  const [apiLoaded, setApiLoaded] = useState(ModuleRegistry.isApiInitialized());

  // API 로딩 함수
  const loadFromApi = useCallback(async () => {
    if (!useApi) return;

    setIsLoading(true);
    setError(null);

    try {
      await ModuleRegistry.initFromApi();
      setApiLoaded(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        "[usePackageModules] API load failed, using preloaded modules",
        e,
      );
      setError(
        e instanceof Error ? e : new Error("Failed to load modules from API"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [useApi]);

  // 초기 로딩
  useEffect(() => {
    if (useApi && !ModuleRegistry.isApiInitialized()) {
      loadFromApi();
    } else if (useApi) {
      // 이미 초기화됨
      setIsLoading(false);
      setApiLoaded(true);
    }
  }, [useApi, loadFromApi]);

  // 모듈 목록 (API 또는 PRELOADED)
  const packageModules = useMemo(() => {
    if (!useApi) {
      // API 미사용: 기존 동작 유지
      return PRELOADED_MODULES;
    }

    if (apiLoaded) {
      // API 로드 완료: 레지스트리 데이터 사용
      return convertToPackageModuleCards();
    }

    // API 로딩 중 또는 실패: PRELOADED_MODULES 폴백
    return PRELOADED_MODULES;
  }, [useApi, apiLoaded]);

  // 새로고침 함수 (API 강제 재로딩)
  const refresh = useCallback(async () => {
    if (!useApi) return;

    // 레지스트리 클리어 후 다시 로드
    ModuleRegistry.clear();

    // PRELOADED_MODULES 다시 등록 (폴백용)
    PRELOADED_MODULES.forEach((moduleCard) => {
      ModuleRegistry.register({
        moduleUUID: moduleCard.moduleUUID,
        packageUUID: moduleCard.packageUUID,
        moduleName: moduleCard.moduleName,
        packageName: moduleCard.packageName,
        icon: moduleCard.icon,
        inputsForm: moduleCard.inputsForm || [],
        outputsForm: moduleCard.outputsForm || [],
        dsl: moduleCard.dsl,
        actions: moduleCard.actions,
        actionCollections: moduleCard.actionCollections,
        originalSize: { columns: 64, rows: 40 }, // 기본값
      });
    });

    setApiLoaded(false);
    await loadFromApi();
  }, [useApi, loadFromApi]);

  return {
    packageModules,
    isLoading,
    error,
    refresh,
  };
};

export default usePackageModules;
