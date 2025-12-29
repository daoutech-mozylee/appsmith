/**
 * moduleInputMerger - 모듈 입력값 병합 유틸리티
 *
 * 인스턴스의 inputs 값과 모듈 정의의 기본값을 병합합니다.
 * - 인스턴스에 값이 있으면 인스턴스 값 사용
 * - 인스턴스에 값이 없으면(undefined) inputsForm의 defaultValue 사용
 * - 새 필드가 추가되면 기본값으로 표시
 *
 * @example
 * ```typescript
 * const mergedInputs = mergeInputsWithDefaults(
 *   { label: "우리팀", isMulti: false },
 *   inputsForm
 * );
 * // 결과: { label: "우리팀", isMulti: false, newField: "기본값" }
 * ```
 */

import type { ModuleInputSection } from "constants/PackageModuleConstants";
import { objectKeys } from "@appsmith/utils";

/**
 * 인스턴스 입력값과 모듈 기본값 병합
 *
 * @param instanceInputs - 페이지에 저장된 인스턴스 입력값
 * @param inputsForm - 모듈 정의의 inputsForm 스키마
 * @returns 병합된 입력값 객체
 */
export function mergeInputsWithDefaults(
  instanceInputs: Record<string, unknown>,
  inputsForm: ModuleInputSection[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // inputsForm의 모든 필드 순회
  for (const section of inputsForm) {
    for (const field of section.children) {
      // 필드 이름 추출
      // propertyName이 "inputs.fieldName" 형태이면 "fieldName" 추출
      // 없으면 label 사용
      const fieldName = extractFieldName(field.propertyName, field.label);

      // 인스턴스에 값이 있으면(undefined가 아니면) 인스턴스 값 사용
      // 없으면 기본값 사용
      if (
        fieldName in instanceInputs &&
        instanceInputs[fieldName] !== undefined
      ) {
        result[fieldName] = instanceInputs[fieldName];
      } else {
        result[fieldName] = field.defaultValue;
      }
    }
  }

  return result;
}

/**
 * propertyName에서 필드 이름 추출
 *
 * @param propertyName - "inputs.fieldName" 형태의 속성 경로
 * @param fallback - propertyName이 없을 때 사용할 대체 값
 * @returns 추출된 필드 이름
 */
export function extractFieldName(
  propertyName: string | undefined,
  fallback: string,
): string {
  if (!propertyName) {
    return fallback;
  }

  // "inputs.fieldName" → "fieldName"
  if (propertyName.startsWith("inputs.")) {
    return propertyName.slice(7); // "inputs.".length === 7
  }

  return propertyName;
}

/**
 * 입력값에서 변경된 필드만 추출
 *
 * 기본값과 동일한 필드는 제외하고, 사용자가 변경한 필드만 반환합니다.
 * 페이지 저장 시 데이터 크기를 줄이는 데 사용할 수 있습니다.
 *
 * @param inputs - 현재 입력값
 * @param inputsForm - 모듈 정의의 inputsForm 스키마
 * @returns 변경된 필드만 포함하는 객체
 */
export function extractChangedInputs(
  inputs: Record<string, unknown>,
  inputsForm: ModuleInputSection[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const section of inputsForm) {
    for (const field of section.children) {
      const fieldName = extractFieldName(field.propertyName, field.label);
      const currentValue = inputs[fieldName];
      const defaultValue = field.defaultValue;

      // 기본값과 다른 경우에만 포함
      if (!isEqual(currentValue, defaultValue)) {
        result[fieldName] = currentValue;
      }
    }
  }

  return result;
}

/**
 * 두 값이 같은지 비교 (깊은 비교)
 *
 * @param a - 비교할 첫 번째 값
 * @param b - 비교할 두 번째 값
 * @returns 같으면 true
 */
function isEqual(a: unknown, b: unknown): boolean {
  // 동일 참조 또는 원시값 비교
  if (a === b) {
    return true;
  }

  // null/undefined 처리
  if (a == null || b == null) {
    return a === b;
  }

  // 타입이 다르면 다름
  if (typeof a !== typeof b) {
    return false;
  }

  // 배열 비교
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((item, index) => isEqual(item, b[index]));
  }

  // 객체 비교
  if (typeof a === "object" && typeof b === "object") {
    const keysA = objectKeys(a as Record<string, unknown>);
    const keysB = objectKeys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) =>
      isEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }

  return false;
}

/**
 * inputsForm에서 모든 필드의 기본값 추출
 *
 * @param inputsForm - 모듈 정의의 inputsForm 스키마
 * @returns 모든 필드의 기본값 객체
 */
export function getDefaultInputs(
  inputsForm: ModuleInputSection[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const section of inputsForm) {
    for (const field of section.children) {
      const fieldName = extractFieldName(field.propertyName, field.label);

      result[fieldName] = field.defaultValue;
    }
  }

  return result;
}

/**
 * 입력값 유효성 검사
 *
 * inputsForm에 정의되지 않은 필드가 있는지 확인합니다.
 *
 * @param inputs - 검사할 입력값
 * @param inputsForm - 모듈 정의의 inputsForm 스키마
 * @returns 유효성 검사 결과
 */
export function validateInputs(
  inputs: Record<string, unknown>,
  inputsForm: ModuleInputSection[],
): { valid: boolean; unknownFields: string[] } {
  const definedFields = new Set<string>();

  for (const section of inputsForm) {
    for (const field of section.children) {
      const fieldName = extractFieldName(field.propertyName, field.label);

      definedFields.add(fieldName);
    }
  }

  const unknownFields = objectKeys(inputs).filter(
    (key) => !definedFields.has(key),
  );

  return {
    valid: unknownFields.length === 0,
    unknownFields,
  };
}
