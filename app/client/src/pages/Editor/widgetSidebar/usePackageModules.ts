import { useMemo } from "react";

// ModuleRegistry 초기화 및 헬퍼 함수들을 utils에서 re-export
// 초기화 로직은 utils/moduleRegistryInit.ts에서 관리 (Editor/Viewer 모두에서 로드됨)
export {
  PRELOADED_MODULES,
  getOutputsFormByModuleUUID,
  getInputsFormByModuleUUID,
} from "utils/moduleRegistryInit";

import { PRELOADED_MODULES } from "utils/moduleRegistryInit";

/**
 * Package 모듈을 반환하는 훅
 * require.context로 빌드 시점에 이미 로드되어 있으므로 동기적으로 반환
 */
export const usePackageModules = () => {
  // 이미 로드된 모듈을 그대로 반환 (동기적)
  const packageModules = useMemo(() => PRELOADED_MODULES, []);

  return {
    packageModules,
    isLoading: false, // 이미 로드됨
    error: null,
  };
};

export default usePackageModules;
