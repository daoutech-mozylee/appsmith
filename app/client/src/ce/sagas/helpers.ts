import omit from "lodash/omit";
import merge from "lodash/merge";
import type { CreateNewActionKeyInterface } from "ee/entities/Engine/actionHelpers";
import { CreateNewActionKey } from "ee/entities/Engine/actionHelpers";
import type { DeleteErrorLogPayload } from "actions/debuggerActions";
import type { Action } from "entities/Action";
import type { Log } from "entities/AppsmithConsole";
import type { EvaluationError } from "utils/DynamicBindingUtils";
import { TEMP_DATASOURCE_ID } from "constants/Datasource";
import type { getConfigInitialValues } from "components/formControls/utils";
import type { CreateDatasourceConfig } from "ee/api/DatasourcesApi";
import type { Datasource } from "entities/Datasource";
import { nestDSL, type FlattenedDSL } from "@shared/dsl/src/transform";
import { PACKAGE_MODULE_WIDGET_TYPE } from "constants/PackageModuleConstants";

export interface ResolveParentEntityMetadataReturnType {
  parentEntityId?: string;
  parentEntityKey?: CreateNewActionKeyInterface;
}

// This function is extended in EE. Please check the EE implementation before any modification.
export interface GenerateDestinationIdInfoReturnType {
  pageId?: string;
}

// This function is extended in EE. Please check the EE implementation before any modification.
export function generateDestinationIdInfoForQueryDuplication(
  destinationEntityId: string,
  parentEntityKey: CreateNewActionKeyInterface,
): GenerateDestinationIdInfoReturnType {
  if (parentEntityKey === CreateNewActionKey.PAGE) {
    return { pageId: destinationEntityId };
  }

  return {};
}

// This function is extended in EE. Please check the EE implementation before any modification.
export const resolveParentEntityMetadata = (
  action: Partial<Action>,
): ResolveParentEntityMetadataReturnType => {
  if (action.pageId) {
    return {
      parentEntityId: action.pageId,
      parentEntityKey: CreateNewActionKey.PAGE,
    };
  }

  return { parentEntityId: undefined, parentEntityKey: undefined };
};

export function* transformAddErrorLogsSaga(logs: Log[]) {
  return logs;
}

export function* transformDeleteErrorLogsSaga(payload: DeleteErrorLogPayload) {
  return payload;
}

export function* transformTriggerEvalErrors(errors: EvaluationError[]) {
  return errors;
}

interface CreateDatasourcePayloadFromActionParams {
  currentEnvId: string;
  actionPayload: Datasource | CreateDatasourceConfig;
  initialValues: ReturnType<typeof getConfigInitialValues>;
}

export const createDatasourceAPIPayloadFromAction = (
  props: CreateDatasourcePayloadFromActionParams,
) => {
  const { actionPayload, currentEnvId, initialValues } = props;

  let datasourceStoragePayload = actionPayload.datasourceStorages[currentEnvId];

  datasourceStoragePayload = merge(initialValues, datasourceStoragePayload);

  // in the datasourcestorages, we only need one key, the currentEnvironment
  // we need to remove any other keys present
  const datasourceStorages = {
    [currentEnvId]: datasourceStoragePayload,
  };

  const payload = omit(
    {
      ...actionPayload,
      datasourceStorages,
    },
    ["id", "new", "type", "datasourceConfiguration"],
  );

  if (payload.datasourceStorages) datasourceStoragePayload.isConfigured = true;

  // remove datasourceId from payload if it is equal to TEMP_DATASOURCE_ID
  if (datasourceStoragePayload.datasourceId === TEMP_DATASOURCE_ID)
    datasourceStoragePayload.datasourceId = "";

  return payload;
};

/**
 * 위젯의 모든 자식 위젯 ID를 재귀적으로 수집
 */
function collectAllChildWidgetIds(
  widgetId: string,
  widgets: FlattenedDSL<unknown>,
  collected: Set<string>,
): void {
  const widget = widgets[widgetId] as Record<string, unknown> | undefined;

  if (!widget) return;

  const children = widget.children as string[] | undefined;

  if (children && Array.isArray(children)) {
    for (const childId of children) {
      collected.add(childId);
      collectAllChildWidgetIds(childId, widgets, collected);
    }
  }
}

/**
 * 페이지 저장 시 PackageModuleWidget에서 불필요한 대용량 데이터 제거
 *
 * 제거되는 필드:
 * - moduleDSL: 전체 위젯 트리 (ModuleRegistry에서 조회)
 * - moduleInstanceData: 액션/JS/스키마 (ModuleRegistry에서 조회)
 * - inputsForm, outputsForm: 스키마 정의 (ModuleRegistry에서 조회)
 * - moduleName, packageName: 중복 데이터 (UUID로 조회 가능)
 * - 모듈 내부 자식 위젯들: Canvas, IFrame 등 (ModuleRegistry에서 재생성)
 *
 * 유지되는 필드:
 * - moduleUUID, packageUUID: 모듈 참조
 * - moduleInstanceId: 인스턴스 식별자
 * - inputs: 사용자 설정 값
 * - 위치/크기 및 기본 위젯 속성
 */
function filterModuleWidgetsForSave(
  widgets: FlattenedDSL<unknown>,
): FlattenedDSL<unknown> {
  // 1. 모든 PackageModuleWidget의 내부 위젯 ID 수집
  const moduleChildWidgetIds = new Set<string>();

  for (const [widgetId, widget] of Object.entries(widgets)) {
    const w = widget as Record<string, unknown>;

    if (w.type === PACKAGE_MODULE_WIDGET_TYPE) {
      // 이 모듈의 모든 자식 위젯 ID 수집
      collectAllChildWidgetIds(widgetId, widgets, moduleChildWidgetIds);
    }
  }

  // 2. 결과 생성 (모듈 내부 위젯 제외)
  const result: FlattenedDSL<unknown> = {};

  for (const [widgetId, widget] of Object.entries(widgets)) {
    // 모듈 내부 위젯은 제외
    if (moduleChildWidgetIds.has(widgetId)) {
      continue;
    }

    const w = widget as Record<string, unknown>;

    if (w.type === PACKAGE_MODULE_WIDGET_TYPE) {
      // PackageModuleWidget: 최소 참조 구조만 유지
      result[widgetId] = {
        // 위젯 기본 속성
        widgetId: w.widgetId,
        widgetName: w.widgetName,
        type: w.type,
        parentId: w.parentId,
        renderMode: w.renderMode,

        // 모듈 참조 (레지스트리 조회용)
        moduleUUID: w.moduleUUID,
        packageUUID: w.packageUUID,

        // 인스턴스 식별
        moduleInstanceId: w.moduleInstanceId,

        // 인스턴스별 데이터 (사용자가 설정한 값만)
        inputs: w.inputs || {},

        // 위치/크기
        leftColumn: w.leftColumn,
        rightColumn: w.rightColumn,
        topRow: w.topRow,
        bottomRow: w.bottomRow,

        // 기본 위젯 속성 - children은 빈 배열 (로드 시 재생성)
        children: [],
        version: w.version,
        parentRowSpace: w.parentRowSpace,
        parentColumnSpace: w.parentColumnSpace,
        isLoading: w.isLoading,
        responsiveBehavior: w.responsiveBehavior,
        minWidth: w.minWidth,
      } as unknown as FlattenedDSL<unknown>[string];
      // 제거: moduleDSL, moduleInstanceData, inputsForm, outputsForm, moduleName, packageName
    } else {
      // 다른 위젯은 그대로 유지
      result[widgetId] = widget;
    }
  }

  return result;
}

// This function is extended in EE for UI modules
export function* getLayoutSavePayload(
  widgets: FlattenedDSL<unknown>,
  editorConfigs: Record<string, unknown>,
) {
  // 모듈 위젯 데이터 필터링 (최소 참조만 저장)
  const filteredWidgets = filterModuleWidgetsForSave(widgets);
  const nestedDSL = nestDSL(filteredWidgets, Object.keys(filteredWidgets)[0]);

  return {
    ...editorConfigs,
    dsl: nestedDSL,
  };
}

// This is a placeholder saga and is extended in EE
export function* generateUIModuleInstanceSaga() {}
