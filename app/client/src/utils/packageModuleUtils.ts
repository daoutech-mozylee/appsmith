import type {
  PackageJSON,
  PackageModuleCard,
  PackageGroup,
} from "constants/PackageModuleConstants";
import type { WidgetCardProps } from "widgets/BaseWidget";
import {
  DEFAULT_MODULE_CARD_PROPS,
  PACKAGE_MODULE_WIDGET_TYPE,
} from "constants/PackageModuleConstants";
import { WIDGET_TAGS } from "constants/WidgetConstants";

// 패키지 모듈 기본 썸네일
import PackageModuleThumbnail from "widgets/PackageModuleWidget/thumbnail.svg";

/**
 * Package JSON 파일을 파싱하여 PackageModuleCard 배열로 변환
 * @param packageData - 패키지 JSON 데이터
 * @param filename - 파일명 (확장자 제외) - displayName으로 사용
 */
export function parsePackageJSON(
  packageData: PackageJSON,
  filename?: string,
): PackageModuleCard[] {
  const {
    actionCollectionList,
    actionList,
    datasourceList,
    exportedPackage,
    moduleList,
  } = packageData;

  const packageUUID = exportedPackage.packageUUID;
  const packageName = exportedPackage.unpublishedPackage.name;

  return moduleList
    .filter((module) => !module.deleted && module.type === "UI_MODULE")
    .map((module) => {
      const moduleName = module.unpublishedModule.name;
      const moduleUUID = module.moduleUUID;

      // 이 모듈에 속한 액션들 필터링
      const moduleActions = actionList.filter(
        (action) =>
          !action.deleted && action.unpublishedAction.moduleId === moduleName,
      );

      // 이 모듈에 속한 JS 컬렉션 필터링
      const moduleActionCollections = actionCollectionList.filter(
        (collection) =>
          !collection.deleted &&
          collection.unpublishedCollection.moduleId === moduleName,
      );

      // DSL 가져오기 (첫 번째 레이아웃 사용)
      const dsl = module.unpublishedModule.layouts[0]?.dsl;

      // displayName: 파일명이 있으면 파일명 사용, 없으면 모듈명 사용
      const displayName = filename || moduleName;

      const moduleCard: PackageModuleCard = {
        // WidgetCardProps 기본 속성
        type: PACKAGE_MODULE_WIDGET_TYPE as WidgetCardProps["type"],
        displayName,
        key: `${packageUUID}_${moduleUUID}`,
        rows: DEFAULT_MODULE_CARD_PROPS.rows,
        columns: DEFAULT_MODULE_CARD_PROPS.columns,
        icon:
          exportedPackage.unpublishedPackage.icon ||
          DEFAULT_MODULE_CARD_PROPS.icon,
        thumbnail: PackageModuleThumbnail, // 기본 썸네일 아이콘
        tags: [WIDGET_TAGS.PACKAGES],

        // PackageModuleCard 확장 속성
        moduleUUID,
        packageUUID,
        packageName,
        moduleName,
        moduleType: module.type,
        dsl,
        actions: moduleActions,
        actionCollections: moduleActionCollections,
        datasources: datasourceList.filter((ds) => !ds.deleted),
      };

      return moduleCard;
    });
}

/**
 * 여러 Package JSON을 로드하여 모듈 카드 배열로 변환
 */
export function loadPackageModules(
  packages: PackageJSON[],
): PackageModuleCard[] {
  return packages.flatMap((pkg) => parsePackageJSON(pkg));
}

/**
 * 패키지별로 모듈 그룹화
 */
export function groupModulesByPackage(
  modules: PackageModuleCard[],
): PackageGroup[] {
  const packageMap = new Map<string, PackageGroup>();

  modules.forEach((module) => {
    const existing = packageMap.get(module.packageUUID);

    if (existing) {
      existing.modules.push(module);
    } else {
      packageMap.set(module.packageUUID, {
        packageUUID: module.packageUUID,
        packageName: module.packageName,
        packageIcon: module.icon,
        packageColor: "",
        modules: [module],
      });
    }
  });

  return Array.from(packageMap.values());
}

/**
 * 모듈 DSL에서 위젯 트리를 추출하여 고유 ID로 변환
 * 각 인스턴스마다 고유한 widgetId를 생성하여 충돌 방지
 */
export function createModuleInstanceDSL(
  originalDSL: PackageModuleCard["dsl"],
  instanceId: string,
): PackageModuleCard["dsl"] {
  if (!originalDSL) return originalDSL;

  const cloneDSL = (
    dsl: PackageModuleCard["dsl"],
  ): PackageModuleCard["dsl"] => {
    const newDSL = { ...dsl };

    // widgetId에 instanceId 접두사 추가
    if (newDSL.widgetId) {
      newDSL.widgetId = `${instanceId}_${newDSL.widgetId}`;
    }

    // widgetName에도 instanceId 접두사 추가
    if (newDSL.widgetName) {
      newDSL.widgetName = `${instanceId}_${newDSL.widgetName}`;
    }

    // parentId 업데이트
    if (newDSL.parentId && typeof newDSL.parentId === "string") {
      newDSL.parentId = `${instanceId}_${newDSL.parentId}`;
    }

    // 자식 위젯들도 재귀적으로 처리
    if (newDSL.children && Array.isArray(newDSL.children)) {
      newDSL.children = newDSL.children.map(cloneDSL);
    }

    return newDSL;
  };

  return cloneDSL(originalDSL);
}

/**
 * 고유한 모듈 인스턴스 ID 생성
 */
export function generateModuleInstanceId(): string {
  return `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
