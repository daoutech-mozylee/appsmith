import { useMemo } from "react";
import type {
  PackageJSON,
  PackageModuleCard,
} from "constants/PackageModuleConstants";
import { parsePackageJSON } from "utils/packageModuleUtils";

// Webpack require.context 타입 선언
declare const require: {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ): {
    keys(): string[];
    <T>(id: string): T;
  };
};

// Webpack require.context를 사용하여 packages 폴더의 모든 JSON 파일 자동 로드
// 빌드 시점에 동기적으로 로드됨
const packagesContext = require.context("data/packages", false, /\.json$/);

// 파일명과 함께 패키지 데이터 로드 (빌드 시점에 실행)
interface PackageDataWithFilename {
  filename: string;
  data: PackageJSON;
}

// 중복 제거: "./xxx.json" 형식의 키만 사용 (상대 경로)
const PACKAGE_DATA_LIST: PackageDataWithFilename[] = packagesContext
  .keys()
  .filter((key: string) => key.startsWith("./") && key.endsWith(".json"))
  .map((key: string) => {
    const filename = key.slice(2, -5); // "./" 제거, ".json" 제거
    const data = packagesContext<{ default?: PackageJSON } & PackageJSON>(key);
    const packageData = (data.default || data) as PackageJSON;

    return { filename, data: packageData };
  })
  // packageUUID 기준 중복 제거
  .filter(
    (item, index, self) =>
      index ===
      self.findIndex(
        (t) =>
          t.data.exportedPackage?.packageUUID ===
          item.data.exportedPackage?.packageUUID,
      ),
  );

// 모듈 카드 미리 생성 (빌드 시점에 실행)
// export하여 saga 등 다른 곳에서도 접근 가능하게 함
export const PRELOADED_MODULES: PackageModuleCard[] = PACKAGE_DATA_LIST.flatMap(
  ({ data, filename }) => {
    try {
      return parsePackageJSON(data, filename);
    } catch {
      return [];
    }
  },
);

/**
 * 모듈 UUID로 outputsForm을 조회하는 헬퍼 함수
 * 위젯에 outputsForm이 저장되어 있지 않은 경우 fallback으로 사용
 */
export function getOutputsFormByModuleUUID(moduleUUID: string) {
  const moduleCard = PRELOADED_MODULES.find((m) => m.moduleUUID === moduleUUID);

  return moduleCard?.outputsForm;
}

/**
 * 모듈 UUID로 inputsForm을 조회하는 헬퍼 함수
 */
export function getInputsFormByModuleUUID(moduleUUID: string) {
  const moduleCard = PRELOADED_MODULES.find((m) => m.moduleUUID === moduleUUID);

  return moduleCard?.inputsForm;
}

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
