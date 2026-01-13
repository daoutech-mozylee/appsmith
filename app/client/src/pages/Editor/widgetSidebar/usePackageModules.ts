/**
 * usePackageModules Hook
 *
 * API에서 모듈 목록을 로드하여 위젯 사이드바에 표시합니다.
 * JSON 파일은 더 이상 사용하지 않습니다.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import type { PackageModuleCard } from "constants/PackageModuleConstants";
import {
  DEFAULT_MODULE_CARD_PROPS,
  PACKAGE_MODULE_WIDGET_TYPE,
} from "constants/PackageModuleConstants";
import { WIDGET_TAGS } from "constants/WidgetConstants";
import { ModuleRegistry, type ModuleDefinition } from "utils/ModuleRegistry";
import type { WidgetCardProps } from "widgets/BaseWidget";

// 패키지 모듈 기본 썸네일
import PackageModuleThumbnail from "widgets/PackageModuleWidget/thumbnail.svg";

// 레거시 호환용 re-export (다른 파일에서 참조)
export {
  getOutputsFormByModuleUUID,
  getInputsFormByModuleUUID,
} from "utils/moduleRegistryInit";

/**
 * 레지스트리 데이터를 PackageModuleCard 형식으로 변환
 */
function convertToPackageModuleCards(): PackageModuleCard[] {
  const all = ModuleRegistry.getAllPartial();

  // eslint-disable-next-line no-console
  console.log("[convertToPackageModuleCards] Registry data:", all.length, all);

  return all.map((item) => {
    // WidgetCardProps 기본 속성 (탭 표시에 필요)
    const baseProps: WidgetCardProps = {
      type: PACKAGE_MODULE_WIDGET_TYPE as WidgetCardProps["type"],
      displayName: item.moduleName,
      key: `${item.packageUUID}_${item.moduleUUID}`,
      rows: DEFAULT_MODULE_CARD_PROPS.rows,
      columns: DEFAULT_MODULE_CARD_PROPS.columns,
      icon: item.icon || DEFAULT_MODULE_CARD_PROPS.icon,
      thumbnail: PackageModuleThumbnail,
      tags: [WIDGET_TAGS.PACKAGES],
    };

    // Partial인 경우 메타데이터만 반환
    if ("_isPartial" in item && item._isPartial) {
      return {
        ...baseProps,
        moduleUUID: item.moduleUUID,
        packageUUID: item.packageUUID,
        moduleName: item.moduleName,
        packageName: item.packageName,
        moduleType: "UI_MODULE",
        color: item.color,
        inputsForm: [],
        outputsForm: [],
        dsl: { widgetName: "", type: "CANVAS_WIDGET", widgetId: "" },
        actions: [],
        actionCollections: [],
        datasources: [],
        _isPartial: true,
      } as unknown as PackageModuleCard & { _isPartial: true };
    }

    // Full definition인 경우
    const fullDef = item as ModuleDefinition;

    return {
      ...baseProps,
      moduleUUID: fullDef.moduleUUID,
      packageUUID: fullDef.packageUUID,
      moduleName: fullDef.moduleName,
      packageName: fullDef.packageName,
      moduleType: "UI_MODULE",
      color: fullDef.color,
      inputsForm: fullDef.inputsForm,
      outputsForm: fullDef.outputsForm,
      dsl: fullDef.dsl,
      actions: fullDef.actions,
      actionCollections: fullDef.actionCollections,
      datasources: [],
    } as PackageModuleCard;
  });
}

/**
 * Package 모듈을 반환하는 훅
 *
 * API에서 모듈 목록을 로드합니다. (JSON 파일 사용 안 함)
 */
export const usePackageModules = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadCount, setLoadCount] = useState(0); // 리렌더링 트리거용

  // API 로딩 함수
  const loadFromApi = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // eslint-disable-next-line no-console
      console.log(
        "[usePackageModules] Calling ModuleRegistry.initFromApi()...",
      );

      await ModuleRegistry.initFromApi();

      // eslint-disable-next-line no-console
      console.log(
        "[usePackageModules] API loaded successfully, registry size:",
        ModuleRegistry.size(),
        "partial:",
        ModuleRegistry.getAllPartial().length,
      );

      setLoadCount((c) => c + 1); // 리렌더링 트리거
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[usePackageModules] API load failed:", e);
      setError(
        e instanceof Error ? e : new Error("Failed to load modules from API"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 로딩
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      "[usePackageModules] useEffect - isApiInitialized:",
      ModuleRegistry.isApiInitialized(),
    );

    if (!ModuleRegistry.isApiInitialized()) {
      loadFromApi();
    } else {
      // 이미 초기화됨
      setIsLoading(false);
      setLoadCount((c) => c + 1);
    }
  }, [loadFromApi]);

  // 모듈 목록 (항상 레지스트리에서)
  const packageModules = useMemo(() => {
    const cards = convertToPackageModuleCards();

    // eslint-disable-next-line no-console
    console.log(
      "[usePackageModules] packageModules computed:",
      cards.length,
      cards.map((c) => c.moduleName),
    );

    return cards;
  }, [loadCount]); // loadCount가 변경될 때 재계산

  // 새로고침 함수
  const refresh = useCallback(async () => {
    ModuleRegistry.clear();
    await loadFromApi();
  }, [loadFromApi]);

  return {
    packageModules,
    isLoading,
    error,
    refresh,
  };
};

export default usePackageModules;
