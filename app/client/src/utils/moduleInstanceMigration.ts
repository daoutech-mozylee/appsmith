/**
 * moduleInstanceMigration - 모듈 인스턴스 마이그레이션 유틸리티
 *
 * 레거시 구조(moduleInstanceData 포함)를 새 구조(참조 + inputs만)로 변환합니다.
 * 페이지 로드 시 자동으로 감지하여 마이그레이션합니다.
 *
 * @example
 * ```typescript
 * if (needsModuleInstanceMigration(widgetProps)) {
 *   const newProps = migrateModuleInstanceProps(widgetProps);
 *   // newProps는 moduleInstanceData, moduleDSL 등이 제거된 새 구조
 * }
 * ```
 */

import type {
  ModuleWidgetPropsNew,
  ModuleWidgetPropsLegacy,
} from "constants/PackageModuleConstants";

/**
 * 마이그레이션이 필요한지 확인
 *
 * moduleInstanceData가 존재하면 레거시 구조로 판단합니다.
 *
 * @param props - 검사할 위젯 props
 * @returns moduleInstanceData가 존재하면 true (레거시 구조)
 */
export function needsModuleInstanceMigration(
  props: unknown,
): props is ModuleWidgetPropsLegacy {
  if (!props || typeof props !== "object") {
    return false;
  }

  const propsObj = props as Record<string, unknown>;

  // moduleInstanceData가 존재하면 레거시 구조
  return (
    "moduleInstanceData" in propsObj &&
    propsObj.moduleInstanceData !== undefined
  );
}

/**
 * 레거시 구조를 새 구조로 마이그레이션
 *
 * - 필수 필드만 유지 (참조 + 인스턴스 데이터)
 * - moduleInstanceData, moduleDSL, inputsForm, outputsForm 제거
 * - inputs 값은 보존
 *
 * @param legacy - 레거시 구조의 위젯 props
 * @returns 새 구조의 위젯 props
 */
export function migrateModuleInstanceProps(
  legacy: ModuleWidgetPropsLegacy,
): ModuleWidgetPropsNew {
  return {
    // 위젯 기본 속성
    widgetId: legacy.widgetId,
    widgetName: legacy.widgetName,
    type: legacy.type,
    parentId: legacy.parentId,
    renderMode: legacy.renderMode,

    // 모듈 참조 (레지스트리 조회용)
    moduleUUID: legacy.moduleUUID,
    packageUUID: legacy.packageUUID,

    // 인스턴스 식별
    moduleInstanceId: legacy.moduleInstanceId,

    // 인스턴스별 데이터 (사용자가 설정한 값) - 보존
    inputs: legacy.inputs || {},

    // 위치/크기
    leftColumn: legacy.leftColumn,
    rightColumn: legacy.rightColumn,
    topRow: legacy.topRow,
    bottomRow: legacy.bottomRow,

    // 아래 필드들은 제거됨 (레지스트리에서 조회):
    // - moduleName, packageName
    // - moduleInstanceData
    // - moduleDSL
    // - inputsForm, outputsForm
  };
}

/**
 * 마이그레이션된 props에서 제거해야 할 레거시 필드 목록
 */
export const LEGACY_FIELDS_TO_REMOVE = [
  "moduleName",
  "packageName",
  "moduleInstanceData",
  "moduleDSL",
  "inputsForm",
  "outputsForm",
] as const;

/**
 * 레거시 필드들을 제거한 props 반환
 *
 * 원본 객체를 수정하지 않고 새 객체를 반환합니다.
 *
 * @param props - 원본 위젯 props
 * @returns 레거시 필드가 제거된 props
 */
export function removeLegacyFields<T extends Record<string, unknown>>(
  props: T,
): Omit<T, (typeof LEGACY_FIELDS_TO_REMOVE)[number]> {
  const result = { ...props };

  for (const field of LEGACY_FIELDS_TO_REMOVE) {
    delete result[field];
  }

  return result as Omit<T, (typeof LEGACY_FIELDS_TO_REMOVE)[number]>;
}

/**
 * 마이그레이션 로그 출력 (개발 환경에서만)
 *
 * @param instanceId - 모듈 인스턴스 ID
 * @param legacySize - 레거시 데이터 크기 (바이트)
 * @param newSize - 새 데이터 크기 (바이트)
 */
export function logMigration(
  instanceId: string,
  legacySize: number,
  newSize: number,
): void {
  if (process.env.NODE_ENV === "development") {
    const reduction = ((legacySize - newSize) / legacySize) * 100;

    // eslint-disable-next-line no-console
    console.log(
      `[ModuleMigration] Migrated ${instanceId}: ${legacySize}B → ${newSize}B (${reduction.toFixed(1)}% reduction)`,
    );
  }
}

/**
 * props의 대략적인 크기 계산 (바이트)
 *
 * @param props - 크기를 계산할 객체
 * @returns 대략적인 바이트 크기
 */
export function estimatePropsSize(props: unknown): number {
  try {
    return JSON.stringify(props).length;
  } catch {
    return 0;
  }
}
