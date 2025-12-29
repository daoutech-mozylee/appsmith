/**
 * ModuleRegistry 초기화
 *
 * 이 파일은 빌드 시점에 모든 패키지 모듈을 로드하고 ModuleRegistry에 등록합니다.
 * Editor와 Viewer(deploy) 모드 모두에서 로드되어야 하므로 utils/ 폴더에 위치합니다.
 *
 * 중요: 이 파일은 side-effect를 위해 import 되어야 합니다.
 * import "utils/moduleRegistryInit";
 */

import type {
  PackageJSON,
  PackageModuleCard,
} from "constants/PackageModuleConstants";
import { parsePackageJSON } from "utils/packageModuleUtils";
import { ModuleRegistry } from "utils/ModuleRegistry";

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
export const PRELOADED_MODULES: PackageModuleCard[] = PACKAGE_DATA_LIST.flatMap(
  ({ data, filename }) => {
    try {
      return parsePackageJSON(data, filename);
    } catch {
      return [];
    }
  },
);

// ModuleRegistry 초기화 (빌드 시점에 실행)
// 모든 모듈을 레지스트리에 등록하여 UUID로 조회 가능하게 함
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
  });
});

// 디버깅용: 레지스트리 초기화 확인 로그 및 전역 노출
if (process.env.NODE_ENV === "development") {
  // eslint-disable-next-line no-console
  console.log(
    `[ModuleRegistry] Initialized with ${ModuleRegistry.size()} modules:`,
    ModuleRegistry.getAll().map((m) => m.moduleName),
  );

  // 브라우저 콘솔에서 접근 가능하도록 window에 노출
  // 사용법: window.ModuleRegistry.getAll()
  (
    window as unknown as { ModuleRegistry: typeof ModuleRegistry }
  ).ModuleRegistry = ModuleRegistry;
}

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

// 초기화 완료 플래그 (import 확인용)
export const MODULE_REGISTRY_INITIALIZED = true;
