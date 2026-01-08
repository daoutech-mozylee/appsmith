/* eslint-disable no-console */
/**
 * Module Instance Sagas
 *
 * 모듈 인스턴스의 Query/JS 실행을 담당하는 saga들
 */
import {
  all,
  call,
  put,
  select,
  take,
  takeEvery,
  debounce,
} from "redux-saga/effects";
import type { ReduxAction } from "actions/ReduxActionTypes";
import {
  ReduxActionTypes,
  WidgetReduxActionTypes,
} from "ee/constants/ReduxActionConstants";
import type {
  ModuleInstance,
  ModuleInstancesState,
  RegisterModuleInstancePayload,
} from "reducers/entityReducers/moduleInstancesReducer";
import {
  getModuleInstanceById,
  getModuleInstances,
} from "selectors/moduleInstanceSelectors";
import { getDatasources, getAppMode } from "ee/selectors/entitiesSelector";
import { APP_MODE } from "entities/App";
import type { Datasource } from "entities/Datasource";
import { getWidgets } from "sagas/selectors";
import type { CanvasWidgetsReduxState } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import { PACKAGE_MODULE_WIDGET_TYPE } from "constants/PackageModuleConstants";
import { getCurrentPageId } from "selectors/editorSelectors";
import type { FlattenedWidgetProps } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import DatasourcesApi from "ee/api/DatasourcesApi";
import { getCurrentWorkspaceId } from "ee/selectors/selectedWorkspaceSelectors";
import { getDataTree } from "selectors/dataTreeSelectors";
import type { DataTree } from "entities/DataTree/dataTreeTypes";
import type {
  ModuleInstanceOutputs,
  ModuleOutputSection,
} from "constants/PackageModuleConstants";
// ModuleRegistry 초기화 (side-effect import)
// utils/ 폴더에 위치하여 Editor와 Viewer 모드 모두에서 로드됨
import {
  getOutputsFormByModuleUUID,
  getInputsFormByModuleUUID,
  MODULE_REGISTRY_INITIALIZED,
} from "utils/moduleRegistryInit";

// 초기화 확인 (side-effect import 보장)
if (!MODULE_REGISTRY_INITIALIZED) {
  console.warn("[ModuleInstanceSagas] ModuleRegistry initialization failed");
}

import { mergeInputsWithDefaults } from "utils/moduleInputMerger";
import {
  needsModuleInstanceMigration,
  migrateModuleInstanceProps,
  estimatePropsSize,
  logMigration,
} from "utils/moduleInstanceMigration";
import { ModuleRegistry } from "utils/ModuleRegistry";
import {
  transformRegistryActions,
  transformRegistryJSObjects,
  applyBindingTransformations,
  extractTargetWidgets,
  collectWidgetNameMappings,
} from "utils/moduleTransformUtils";
import { objectKeys } from "@appsmith/utils";
import { evaluateAndExecuteDynamicTrigger } from "sagas/EvaluationsSaga";
import { EventType } from "constants/AppsmithActionConstants/ActionConstants";
import { TriggerKind } from "constants/AppsmithActionConstants/ActionConstants";
import { ENTITY_TYPE } from "ee/entities/AppsmithConsole/utils";

/**
 * 모듈 인스턴스 등록 후 executeOnLoad Action/JSFunction들을 자동 실행
 */
function* handleModuleInstanceRegistered(
  action: ReduxAction<RegisterModuleInstancePayload>,
) {
  const { actions, instanceId, jsObjects } = action.payload;

  console.log(
    `[ModuleInstance] handleModuleInstanceRegistered: instanceId=${instanceId}`,
  );
  console.log(
    `[ModuleInstance] jsObjects received:`,
    jsObjects.map((js) => ({
      name: js.name,
      functions: js.functions,
    })),
  );

  // 1. DB/SAAS Action 중 executeOnLoad가 true이거나, runBehaviour가 AUTOMATIC/ON_PAGE_LOAD인 것들 실행
  const executeOnLoadActions = actions.filter((act) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actWithBehaviour = act as any;
    const runBehaviour = actWithBehaviour.runBehaviour;

    // runBehaviour가 있으면 우선 사용 (런타임 체크)
    if (runBehaviour) {
      return runBehaviour === "AUTOMATIC" || runBehaviour === "ON_PAGE_LOAD";
    }

    // runBehaviour가 없으면 executeOnLoad 필드 사용 (이전 버전 호환)
    return act.executeOnLoad === true;
  });

  // 각 DB/SAAS Action을 순차적으로 실행
  for (const moduleAction of executeOnLoadActions) {
    yield call(executeModuleAction, instanceId, moduleAction.name);
  }

  // 2. JSObject의 함수 중 runBehaviour가 AUTOMATIC/ON_PAGE_LOAD인 것들 실행
  const executeOnLoadJSFunctions: Array<{
    jsObjectName: string;
    functionName: string;
  }> = [];

  for (const jsObj of jsObjects) {
    console.log(
      `[ModuleInstance] Checking jsObj: ${jsObj.name}, functions:`,
      jsObj.functions,
    );

    if (jsObj.functions) {
      for (const [functionName, funcInfo] of Object.entries(jsObj.functions)) {
        console.log(
          `[ModuleInstance] Function ${functionName}: runBehaviour=${funcInfo.runBehaviour}`,
        );

        if (
          funcInfo.runBehaviour === "AUTOMATIC" ||
          funcInfo.runBehaviour === "ON_PAGE_LOAD"
        ) {
          executeOnLoadJSFunctions.push({
            jsObjectName: jsObj.name,
            functionName,
          });
        }
      }
    }
  }

  console.log(
    `[ModuleInstance] executeOnLoadJSFunctions:`,
    executeOnLoadJSFunctions,
  );

  // ON_PAGE_LOAD JS 함수가 있는 경우, DataTree 평가가 완료될 때까지 대기
  // 페이지 새로고침 시 모듈 인스턴스가 등록되지만 DataTree에 아직 반영되지 않아서
  // JSObject가 undefined인 상태에서 함수를 호출하면 ReferenceError 발생
  // 또한 params 바인딩(예: {{Query1.data}})이 평가되어야 init에서 올바른 값을 사용할 수 있음
  if (executeOnLoadJSFunctions.length > 0) {
    // DataTree에서 첫 번째 JSObject가 존재하는지 확인
    const firstJsObj = executeOnLoadJSFunctions[0];
    const paramsEntityName = `__${instanceId}_params__`;

    // params 엔티티의 시스템 속성 목록 (사용자 입력 값과 구분)
    const systemProperties = new Set([
      "ENTITY_TYPE",
      "__moduleInstanceId__",
      "actionId",
      "data",
      "isLoading",
      "run",
      "clear",
      "config",
      "responseMeta",
    ]);

    // 초기 inputs 값 저장 (바인딩 문자열인지 확인용)
    const instance: ModuleInstance | undefined = yield select(
      getModuleInstanceById,
      instanceId,
    );
    const initialInputs = instance?.inputs || {};
    const bindingInputs = Object.entries(initialInputs)
      .filter(
        ([, value]) =>
          typeof value === "string" &&
          value.includes("{{") &&
          value.includes("}}"),
      )
      .map(([key]) => key);

    // 평가 완료까지 대기 (최대 10번의 평가 사이클 대기)
    // params 바인딩이 평가될 때까지 충분히 기다림 (Query 실행 포함)
    let waitCount = 0;
    const maxWait = 10;

    while (waitCount < maxWait) {
      const dataTree = (yield select(getDataTree)) as DataTree;

      // JSObject와 params 엔티티가 모두 존재하는지 확인
      const jsObjectExists = !!dataTree[firstJsObj.jsObjectName];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paramsEntity = dataTree[paramsEntityName] as any;

      if (!paramsEntity) {
        yield take(ReduxActionTypes.SET_EVALUATED_TREE);
        waitCount++;
        continue;
      }

      // 사용자 입력 값만 추출 (시스템 속성 제외)
      const userInputEntries = Object.entries(paramsEntity).filter(
        ([key]) => !systemProperties.has(key),
      );

      // 바인딩 문자열이 아직 평가되지 않았는지 확인
      const hasUnresolvedBindings = userInputEntries.some(
        ([, value]) =>
          typeof value === "string" &&
          value.includes("{{") &&
          value.includes("}}"),
      );

      // 바인딩이 있었던 input들이 실제 값을 가지고 있는지 확인
      // Query가 아직 실행되지 않았다면 undefined일 수 있음
      const bindingInputsHaveValues =
        bindingInputs.length === 0 ||
        bindingInputs.some((key) => {
          const value = paramsEntity[key];

          // undefined, null이 아닌 실제 값이 있으면 true
          // 빈 배열 []도 유효한 값으로 처리
          return value !== undefined && value !== null;
        });

      if (jsObjectExists && !hasUnresolvedBindings && bindingInputsHaveValues) {
        break;
      }

      yield take(ReduxActionTypes.SET_EVALUATED_TREE);
      waitCount++;
    }
  }

  // 각 JS 함수를 순차적으로 실행
  for (const { functionName, jsObjectName } of executeOnLoadJSFunctions) {
    yield call(executeModuleJSFunction, instanceId, jsObjectName, functionName);
  }
}

// Datasource 캐시 (API 호출 최소화)
let cachedDatasources: Datasource[] | null = null;

/**
 * Datasource 이름으로 ID 찾기
 * 1. Redux 상태에서 먼저 찾기 (Editor 모드)
 * 2. 캐시된 데이터에서 찾기
 * 3. Editor 모드에서만 API를 통해 fetch (Public 앱에서는 API 호출 건너뜀)
 */
function* findDatasourceByName(
  datasourceName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Generator<unknown, Datasource | undefined, any> {
  // 1. Redux 상태에서 찾기
  const datasources: Datasource[] = yield select(getDatasources);
  const found = datasources.find((ds) => ds.name === datasourceName);

  if (found) {
    return found;
  }

  // 2. 캐시된 데이터에서 찾기
  if (cachedDatasources) {
    return cachedDatasources.find((ds) => ds.name === datasourceName);
  }

  // 3. 앱 모드 확인 - Public 앱(PUBLISHED)에서는 datasources API 호출 건너뛰기
  // Datasources API는 workspace 권한이 필요하여 anonymous 사용자에게 401 반환됨
  const appMode: APP_MODE = yield select(getAppMode);

  if (appMode === APP_MODE.PUBLISHED) {
    console.log(
      `[ModuleInstance] Skipping datasources API call in PUBLISHED mode for "${datasourceName}"`,
    );

    return undefined;
  }

  // 4. Editor 모드에서만 API를 통해 fetch
  try {
    const workspaceId: string = yield select(getCurrentWorkspaceId);

    console.log(
      `[ModuleInstance] Looking for datasource "${datasourceName}", workspaceId=${workspaceId}`,
    );

    if (workspaceId) {
      console.log(
        `[ModuleInstance] Fetching datasources from API for workspace: ${workspaceId}`,
      );
      const response = yield call(DatasourcesApi.fetchDatasources, workspaceId);

      console.log(`[ModuleInstance] API response:`, response);

      if (response?.data?.data) {
        cachedDatasources = response.data.data as Datasource[];
        console.log(
          `[ModuleInstance] Fetched ${cachedDatasources.length} datasources:`,
          cachedDatasources.map((ds) => ds.name),
        );

        return cachedDatasources?.find((ds) => ds.name === datasourceName);
      } else {
        console.log(
          `[ModuleInstance] No data in response, trying response.data directly`,
        );

        // 응답 구조가 다를 수 있음
        if (Array.isArray(response?.data)) {
          cachedDatasources = response.data as Datasource[];
          console.log(
            `[ModuleInstance] Fetched ${cachedDatasources.length} datasources (alt):`,
            cachedDatasources.map((ds) => ds.name),
          );

          return cachedDatasources?.find((ds) => ds.name === datasourceName);
        }
      }
    } else {
      console.log(`[ModuleInstance] No workspaceId available`);
    }
  } catch (error) {
    console.error("[ModuleInstance] Error fetching datasources:", error);
  }

  return undefined;
}

/**
 * 모듈 Action 실행
 */
function* executeModuleAction(
  instanceId: string,
  actionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Generator<unknown, void, any> {
  try {
    // 실행 시작
    yield put({
      type: ReduxActionTypes.EXECUTE_MODULE_ACTION_INIT,
      payload: { instanceId, actionName },
    });

    // 모듈 인스턴스에서 Action 정보 가져오기
    const instance: ModuleInstance | undefined = yield select(
      getModuleInstanceById,
      instanceId,
    );

    if (!instance) {
      throw new Error(`Module instance not found: ${instanceId}`);
    }

    const moduleAction = instance.actions[actionName];

    if (!moduleAction) {
      throw new Error(`Module action not found: ${actionName}`);
    }

    // Datasource ID 확인 (미리 저장된 ID 사용, 없으면 이름으로 조회)
    let datasourceId = moduleAction.datasource.id;

    if (!datasourceId) {
      // ID가 없으면 이름으로 조회 (Editor 모드에서만 동작)
      const datasource: Datasource | undefined = yield call(
        findDatasourceByName,
        moduleAction.datasource.name,
      );

      datasourceId = datasource?.id;
    }

    if (!datasourceId) {
      throw new Error(
        `Datasource not found: ${moduleAction.datasource.name}. ` +
          `Please make sure a datasource with this name exists in your workspace.`,
      );
    }

    // pluginType에 따라 다른 API 및 템플릿 사용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;

    if (moduleAction.pluginType === "SAAS") {
      // SAAS 플러그인 (Google Sheets 등): /trigger 엔드포인트 사용
      // formData를 trigger 형식으로 변환
      const formData = (moduleAction.actionConfiguration.formData || {}) as {
        sheetUrl?: { data?: string };
        sheetName?: { data?: string };
        queryFormat?: { data?: string };
        tableHeaderIndex?: { data?: string };
      };

      const triggerData = {
        requestType: "SHEET_DATA",
        displayType: "DROP_DOWN",
        pluginId: moduleAction.pluginId,
        parameters: {
          sheetUrl: formData.sheetUrl?.data || "",
          sheetName: formData.sheetName?.data || "",
          queryFormat: formData.queryFormat?.data || "ROWS",
          tableHeaderIndex: formData.tableHeaderIndex?.data || "1",
        },
      };

      response = yield call(DatasourcesApi.executeGoogleSheetsDatasourceQuery, {
        datasourceId: datasourceId,
        data: triggerData,
      });
    } else {
      // DB 플러그인 (Postgres, MySQL 등): /schema-preview 엔드포인트 사용
      const template = {
        title: moduleAction.name,
        body: moduleAction.actionConfiguration.body || "",
        configuration: moduleAction.actionConfiguration || {},
        isSuggested: false,
      };

      response = yield call(DatasourcesApi.executeDatasourceQuery, {
        datasourceId: datasourceId,
        data: template,
      });
    }

    // 응답에서 데이터 추출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resultData: any[] = [];

    if (response?.data?.trigger) {
      // SAAS 플러그인 (Google Sheets 등): /trigger 응답 형식
      resultData = response.data.trigger;
    } else if (response?.data?.body) {
      // DB 플러그인: /schema-preview 응답 형식
      resultData = response.data.body;
    } else if (response?.data?.data?.body) {
      resultData = response.data.data.body;
    } else if (Array.isArray(response?.data)) {
      resultData = response.data;
    }

    // 실행 성공
    yield put({
      type: ReduxActionTypes.EXECUTE_MODULE_ACTION_SUCCESS,
      payload: {
        instanceId,
        actionName,
        data: resultData,
      },
    });
  } catch (error) {
    yield put({
      type: ReduxActionTypes.EXECUTE_MODULE_ACTION_ERROR,
      payload: {
        instanceId,
        actionName,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

/**
 * 모듈 JS 함수 실행
 * evaluateAndExecuteDynamicTrigger를 사용하여 JS 함수를 실행
 */
function* executeModuleJSFunction(
  instanceId: string,
  jsObjectName: string,
  functionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Generator<unknown, void, any> {
  try {
    // 실행 시작
    yield put({
      type: ReduxActionTypes.EXECUTE_MODULE_JS_FUNCTION_INIT,
      payload: { instanceId, jsObjectName, functionName },
    });

    // 함수 호출 문자열 생성 (예: "mod_xxx_OrgChartJS.init()")
    const functionCall = `${jsObjectName}.${functionName}()`;

    // triggerMeta 설정
    const triggerMeta = {
      source: {
        id: instanceId,
        name: `${jsObjectName}.${functionName}`,
        type: ENTITY_TYPE.JSACTION,
      },
      triggerPropertyName: `${jsObjectName}.${functionName}`,
      triggerKind: TriggerKind.JS_FUNCTION_EXECUTION,
      onPageLoad: true,
    };

    // evaluateAndExecuteDynamicTrigger를 사용하여 실행
    const response: { errors: unknown[]; result: unknown } = yield call(
      evaluateAndExecuteDynamicTrigger,
      functionCall,
      EventType.ON_JS_FUNCTION_EXECUTE,
      triggerMeta,
    );

    const { errors, result } = response;

    if (errors && errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `[executeModuleJSFunction] Errors in ${jsObjectName}.${functionName}:`,
        errors,
      );

      yield put({
        type: ReduxActionTypes.EXECUTE_MODULE_JS_FUNCTION_ERROR,
        payload: {
          instanceId,
          jsObjectName,
          functionName,
          error: JSON.stringify(errors),
        },
      });

      return;
    }

    // 실행 성공
    yield put({
      type: ReduxActionTypes.EXECUTE_MODULE_JS_FUNCTION_SUCCESS,
      payload: {
        instanceId,
        jsObjectName,
        functionName,
        data: result,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[executeModuleJSFunction] Error ${jsObjectName}.${functionName}:`,
      error,
    );

    yield put({
      type: ReduxActionTypes.EXECUTE_MODULE_JS_FUNCTION_ERROR,
      payload: {
        instanceId,
        jsObjectName,
        functionName,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

/**
 * 페이지 로드 시 모듈 인스턴스 복원
 * - FETCH_ALL_PAGE_ENTITY_COMPLETION 후 위젯들을 스캔
 * - PACKAGE_MODULE_WIDGET 타입의 위젯에서 moduleInstanceData를 찾음
 * - 각 모듈 위젯에 대해 REGISTER_MODULE_INSTANCE 디스패치
 */
function* handlePageLoadModuleRestore() {
  console.log("[ModuleRestore] handlePageLoadModuleRestore called");

  // 현재 페이지 ID 가져오기
  const pageId: string = yield select(getCurrentPageId);

  // 모든 위젯 가져오기
  const widgets: CanvasWidgetsReduxState = yield select(getWidgets);

  // 이미 등록된 모듈 인스턴스 확인
  const existingInstances: Record<string, unknown> =
    yield select(getModuleInstances);

  // PACKAGE_MODULE_WIDGET 타입의 위젯 찾기
  const moduleWidgets = Object.values(widgets).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (widget: any) => widget.type === PACKAGE_MODULE_WIDGET_TYPE,
  );

  console.log(
    `[ModuleRestore] Found ${moduleWidgets.length} module widgets, existing instances: ${objectKeys(existingInstances).length}`,
  );

  for (const widget of moduleWidgets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let widgetAny = widget as any;

    // 레거시 구조 마이그레이션 체크
    // moduleInstanceData가 존재하면 레거시 구조로 판단
    if (needsModuleInstanceMigration(widgetAny)) {
      // 마이그레이션 전 크기 측정 (개발 환경 로깅용)
      const legacySize = estimatePropsSize(widgetAny);

      // 레거시 구조를 새 구조로 변환
      const migratedProps = migrateModuleInstanceProps(widgetAny);

      // 마이그레이션 후 크기 측정 및 로깅
      const newSize = estimatePropsSize(migratedProps);

      logMigration(
        widgetAny.moduleInstanceId || widgetAny.widgetId,
        legacySize,
        newSize,
      );

      // 마이그레이션된 props로 위젯 업데이트 (런타임에서만 적용)
      // 실제 저장소 업데이트는 별도 저장 시점에 처리
      widgetAny = { ...widgetAny, ...migratedProps };
    }

    // 모듈 식별자 및 레거시 데이터 확인
    const moduleInstanceData = widgetAny.moduleInstanceData;
    const moduleInstanceId = widgetAny.moduleInstanceId;
    const moduleUUID = widgetAny.moduleUUID;

    // moduleInstanceId가 없으면 건너뛰기
    if (!moduleInstanceId) {
      continue;
    }

    // 이미 등록된 인스턴스인지 확인
    if (existingInstances[moduleInstanceId]) {
      continue;
    }

    // ModuleRegistry에서 원본 모듈 정의 조회
    const definition = moduleUUID ? ModuleRegistry.get(moduleUUID) : undefined;

    console.log(
      `[ModuleRestore] Widget ${moduleInstanceId}: moduleUUID=${moduleUUID}, definition found=${!!definition}, registry size=${ModuleRegistry.size()}`,
    );

    // inputsForm/outputsForm 조회: 레지스트리 (최신) -> 위젯 -> moduleInstanceData (fallback)
    const inputsForm =
      definition?.inputsForm ||
      (moduleUUID ? getInputsFormByModuleUUID(moduleUUID) : undefined) ||
      widgetAny.inputsForm ||
      moduleInstanceData?.inputsForm;

    const outputsForm =
      definition?.outputsForm ||
      (moduleUUID ? getOutputsFormByModuleUUID(moduleUUID) : undefined) ||
      widgetAny.outputsForm ||
      moduleInstanceData?.outputsForm;

    // actions/jsObjects 준비
    // 레지스트리에서 원본 데이터를 찾았으면 변환하여 사용, 없으면 레거시 데이터 사용
    let actions: RegisterModuleInstancePayload["actions"];
    let jsObjects: RegisterModuleInstancePayload["jsObjects"];

    if (definition) {
      // 레지스트리에서 원본 데이터 조회됨 - 변환하여 사용
      const entityNameMapping = new Map<string, string>();
      const datasources: Datasource[] = yield select(getDatasources);

      // 위젯 이름 매핑 수집 (바인딩 변환용)
      const targetWidgets = extractTargetWidgets(definition.dsl);

      for (const targetWidget of targetWidgets) {
        collectWidgetNameMappings(
          targetWidget,
          moduleInstanceId,
          entityNameMapping,
        );
      }

      // Actions 변환
      const moduleActions = transformRegistryActions(
        definition.actions,
        moduleInstanceId,
        entityNameMapping,
        datasources,
      );

      // JSObjects 변환 (actions 전달하여 JS 함수의 runBehaviour 매핑)
      const moduleJSObjects = transformRegistryJSObjects(
        definition.actionCollections,
        definition.actions,
        moduleInstanceId,
        entityNameMapping,
      );

      // 바인딩 변환 적용
      const transformed = applyBindingTransformations(
        moduleActions,
        moduleJSObjects,
        entityNameMapping,
        moduleInstanceId,
      );

      actions = transformed.transformedActions;
      jsObjects = transformed.transformedJSObjects;

      console.log(
        `[ModuleRestore] Loaded from registry: ${definition.moduleName} (${moduleInstanceId})`,
      );
      console.log(
        `[ModuleRestore] jsObjects:`,
        jsObjects.map((js) => ({
          name: js.name,
          functions: Object.entries(js.functions || {}).map(([fn, info]) => ({
            fn,
            runBehaviour: info.runBehaviour,
          })),
        })),
      );
    } else if (moduleInstanceData) {
      // 레지스트리에 없음 - 레거시 데이터 사용 (fallback)
      actions = moduleInstanceData.actions || [];
      jsObjects = moduleInstanceData.jsObjects || [];

      if (process.env.NODE_ENV === "development") {
        console.log(
          `[ModuleRestore] Using legacy data: ${widgetAny.moduleName || "unknown"} (${moduleInstanceId})`,
        );
      }
    } else {
      // 레지스트리에도 없고 레거시 데이터도 없음 - 건너뛰기
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[ModuleRestore] No data found for module: ${moduleUUID} (${moduleInstanceId})`,
        );
      }

      continue;
    }

    // 인스턴스 입력값과 모듈 기본값 병합
    const instanceInputs = widgetAny.inputs || {};
    const mergedInputs = inputsForm
      ? mergeInputsWithDefaults(instanceInputs, inputsForm)
      : instanceInputs;

    // 모듈 인스턴스 등록
    yield put({
      type: ReduxActionTypes.REGISTER_MODULE_INSTANCE,
      payload: {
        instanceId: moduleInstanceId,
        moduleId: moduleUUID || "",
        moduleName: definition?.moduleName || widgetAny.moduleName || "",
        packageName: definition?.packageName || widgetAny.packageName || "",
        widgetId: widget.widgetId,
        pageId,
        actions,
        jsObjects,
        // Input/Output 정의 및 초기값 전달
        inputsForm,
        outputsForm,
        // 병합된 inputs 사용 (기존 값 보존 + 새 필드 기본값)
        initialInputs: mergedInputs,
      } as RegisterModuleInstancePayload,
    });
  }
}

/**
 * 위젯 삭제 시 모듈 인스턴스 해제
 * - 삭제되는 위젯 중 PACKAGE_MODULE_WIDGET이 있으면 인스턴스 해제
 */
function* handleWidgetDeleteForModuleInstance(
  action: ReduxAction<{
    widgetId?: string;
    parentId?: string;
    isShortcut?: boolean;
  }>,
) {
  const { widgetId } = action.payload;

  // 위젯 정보 가져오기
  const widgets: CanvasWidgetsReduxState = yield select(getWidgets);

  // widgetId가 없으면 선택된 위젯들 확인
  if (!widgetId) {
    // 선택된 위젯 가져오기
    const selectedWidgetIds: string[] = yield select(
      (state) => state.ui.widgetDragResize.selectedWidgets || [],
    );

    // 선택된 위젯들 중 모듈 위젯 찾아서 해제
    for (const selectedId of selectedWidgetIds) {
      const selectedWidget = widgets[selectedId];

      if (selectedWidget?.type === PACKAGE_MODULE_WIDGET_TYPE) {
        yield call(unregisterModuleInstanceForWidget, selectedWidget);
      }

      // 자식 중 모듈 위젯도 확인
      yield call(unregisterModuleInstancesInTree, selectedId, widgets);
    }

    return;
  }

  const widget = widgets[widgetId];

  if (!widget) return;

  // 삭제되는 위젯이 모듈 위젯인지 확인
  if (widget.type === PACKAGE_MODULE_WIDGET_TYPE) {
    yield call(unregisterModuleInstanceForWidget, widget);
  }

  // 자식 위젯들 중에도 모듈 위젯이 있는지 확인 (재귀적으로)
  yield call(unregisterModuleInstancesInTree, widgetId, widgets);
}

/**
 * 위젯 트리 내의 모든 모듈 인스턴스 해제
 */
function* unregisterModuleInstancesInTree(
  widgetId: string,
  widgets: CanvasWidgetsReduxState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Generator<unknown, void, any> {
  const widget = widgets[widgetId];

  if (!widget) return;

  // 자식 위젯들 순회
  const children = widget.children || [];

  for (const childId of children) {
    const childWidget = widgets[childId];

    if (!childWidget) continue;

    // 모듈 위젯이면 해제
    if (childWidget.type === PACKAGE_MODULE_WIDGET_TYPE) {
      yield call(unregisterModuleInstanceForWidget, childWidget);
    }

    // 재귀적으로 자식 확인
    yield call(unregisterModuleInstancesInTree, childId, widgets);
  }
}

/**
 * 특정 위젯의 모듈 인스턴스 해제
 */
function* unregisterModuleInstanceForWidget(widget: FlattenedWidgetProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetAny = widget as any;
  const moduleInstanceId = widgetAny.moduleInstanceId;

  if (!moduleInstanceId) {
    return;
  }

  yield put({
    type: ReduxActionTypes.UNREGISTER_MODULE_INSTANCE,
    payload: { instanceId: moduleInstanceId },
  });
}

/**
 * 바인딩 표현식에서 값을 추출
 * 예: "{{Select1.selectedOptionValue}}" -> Select1.selectedOptionValue의 값
 *
 * 모듈 내부 위젯의 경우, 원본 이름을 인스턴스 접두사가 붙은 이름으로 변환해야 함
 * 예: Select1 -> mod_xxx_Select1
 *
 * @param bindingExpression 바인딩 표현식 (예: "{{Select1.selectedOptionValue}}")
 * @param dataTree 평가된 DataTree
 * @param instancePrefix 모듈 인스턴스 접두사 (예: "mod_xxx")
 */
function extractBindingValue(
  bindingExpression: string,
  dataTree: DataTree,
  instancePrefix?: string,
): unknown {
  // {{...}} 패턴 추출
  const match = bindingExpression.match(/\{\{(.+?)\}\}/);

  if (!match) return bindingExpression; // 바인딩이 아니면 원래 값 반환

  let path = match[1].trim();

  // instancePrefix가 있으면 엔티티 이름에 접두사 추가
  // 예: Select1.selectedOptionValue -> mod_xxx_Select1.selectedOptionValue
  if (instancePrefix) {
    const parts = path.split(".");

    if (parts.length > 0) {
      const entityName = parts[0];
      // 이미 접두사가 붙어있지 않은 경우에만 추가
      // appsmith, storeValue 등 글로벌 엔티티는 제외
      const globalEntities = [
        "appsmith",
        "storeValue",
        "navigateTo",
        "showAlert",
        "showModal",
        "closeModal",
        "copyToClipboard",
        "resetWidget",
        "setInterval",
        "clearInterval",
        "setTimeout",
        "clearTimeout",
      ];

      if (
        !entityName.startsWith(instancePrefix) &&
        !globalEntities.includes(entityName)
      ) {
        parts[0] = `${instancePrefix}_${entityName}`;
        path = parts.join(".");
      }
    }
  }

  // DataTree에서 값 추출 (예: mod_xxx_Select1.selectedOptionValue)
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = dataTree;

  for (const part of parts) {
    if (value === undefined || value === null) return undefined;

    value = value[part];
  }

  return value;
}

/**
 * DataTree 평가 완료 후 모듈 인스턴스의 outputs 계산
 * outputsForm에 정의된 바인딩 표현식을 평가하여 outputs 업데이트
 */
function* handleComputeModuleOutputs(): Generator<unknown, void, unknown> {
  const moduleInstances = (yield select(
    getModuleInstances,
  )) as ModuleInstancesState;
  const dataTree = (yield select(getDataTree)) as DataTree;

  // 모듈 인스턴스가 없으면 종료
  if (objectKeys(moduleInstances).length === 0) return;

  // 각 모듈 인스턴스의 outputs 계산
  for (const instance of Object.values(moduleInstances)) {
    if (!instance.outputsForm) {
      continue;
    }

    const newOutputs: ModuleInstanceOutputs = {};
    let hasChanges = false;

    // outputsForm의 각 섹션과 필드를 순회
    for (const section of instance.outputsForm as ModuleOutputSection[]) {
      for (const output of section.children) {
        const outputName =
          output.label || output.propertyName?.split(".").pop();

        if (!outputName) continue;

        // value 필드에서 바인딩 표현식 추출 (ModuleOutputDefinition은 value 필드 사용)
        const bindingValue = output.value;

        if (bindingValue && typeof bindingValue === "string") {
          // instanceId가 접두사 역할을 함 (예: "mod_xxx")
          const computedValue = extractBindingValue(
            bindingValue,
            dataTree,
            instance.instanceId,
          );

          newOutputs[outputName] = computedValue;

          // 값이 변경되었는지 확인
          if (instance.outputs[outputName] !== computedValue) {
            hasChanges = true;
          }
        }
      }
    }

    // 변경이 있으면 outputs 업데이트
    if (hasChanges) {
      yield put({
        type: ReduxActionTypes.UPDATE_MODULE_INSTANCE_OUTPUTS,
        payload: {
          instanceId: instance.instanceId,
          outputs: newOutputs,
        },
      });
    }
  }
}

/**
 * 위젯 속성 업데이트 요청 시 모듈 인스턴스 inputs 동기화
 *
 * UPDATE_WIDGET_PROPERTY_REQUEST가 dispatch되면 위젯 속성이 업데이트되기 전에
 * 모듈 인스턴스의 inputs를 먼저 업데이트하여 평가 사이클에서 올바른 값을 사용하도록 함.
 *
 * 기존 componentDidUpdate 방식은 평가 사이클 이후에 실행되어 타이밍 문제 발생.
 */
function* handleWidgetPropertyRequestForModuleInputs(
  action: ReduxAction<{
    widgetId: string;
    propertyPath: string;
    propertyValue: unknown;
  }>,
): Generator<unknown, void, unknown> {
  const { propertyPath, propertyValue, widgetId } = action.payload;

  // inputs.xxx 형태의 속성 변경인 경우만 처리
  if (!propertyPath.startsWith("inputs.")) {
    return;
  }

  // 위젯 정보 확인
  const widgets = (yield select(getWidgets)) as CanvasWidgetsReduxState;
  const widget = widgets[widgetId];

  if (!widget || widget.type !== PACKAGE_MODULE_WIDGET_TYPE) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moduleWidget = widget as any;
  const moduleInstanceId = moduleWidget.moduleInstanceId;

  if (!moduleInstanceId) {
    return;
  }

  // input 이름 추출 (예: "inputs.defaultSelected" -> "defaultSelected")
  const inputName = propertyPath.substring("inputs.".length);

  // 모듈 인스턴스의 input 업데이트 (개별 input)
  // 이 액션은 동기적으로 reducer를 실행하여 상태를 업데이트함
  yield put({
    type: ReduxActionTypes.UPDATE_MODULE_INSTANCE_INPUT,
    payload: {
      instanceId: moduleInstanceId,
      inputName,
      value: propertyValue,
    },
  });
}

/**
 * 모듈 액션 실행 요청 처리
 * PluginActionSaga에서 모듈 액션 감지 시 호출됨
 */
function* handleExecuteModuleActionRequest(
  action: ReduxAction<{
    instanceId: string;
    actionName: string;
    params?: Record<string, unknown>;
  }>,
) {
  const { actionName, instanceId } = action.payload;

  try {
    yield call(executeModuleAction, instanceId, actionName);
    // 성공은 executeModuleAction 내부에서 EXECUTE_MODULE_ACTION_SUCCESS dispatch
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[ModuleInstanceSaga] Error executing module action:`, error);
    // 에러는 executeModuleAction 내부에서 EXECUTE_MODULE_ACTION_ERROR dispatch
  }
}

/**
 * Module Instance Sagas Root
 */
export default function* moduleInstanceSagas() {
  console.log("[ModuleInstanceSagas] Saga initialized and running");

  yield all([
    // 모듈 액션 실행 요청 처리
    takeEvery(
      ReduxActionTypes.EXECUTE_MODULE_ACTION_REQUEST,
      handleExecuteModuleActionRequest,
    ),
    // 모듈 인스턴스 등록 시 executeOnLoad 실행
    takeEvery(
      ReduxActionTypes.REGISTER_MODULE_INSTANCE,
      handleModuleInstanceRegistered,
    ),
    // 페이지 로드 시 모듈 인스턴스 복원 (모든 엔티티 로드 완료 후)
    // FETCH_ALL_PAGE_ENTITY_COMPLETION: Datasource 등 모든 엔티티가 로드된 후 발생
    takeEvery(
      ReduxActionTypes.FETCH_ALL_PAGE_ENTITY_COMPLETION,
      handlePageLoadModuleRestore,
    ),
    // 위젯 삭제 시 모듈 인스턴스 해제 (WIDGET_DELETE가 먼저 발생)
    takeEvery(
      WidgetReduxActionTypes.WIDGET_DELETE,
      handleWidgetDeleteForModuleInstance,
    ),
    // DataTree 평가 완료 후 모듈 outputs 계산 (debounce로 성능 최적화)
    debounce(
      100, // 100ms debounce
      ReduxActionTypes.SET_EVALUATED_TREE,
      handleComputeModuleOutputs,
    ),
    // 위젯 속성 업데이트 요청 시 모듈 inputs 동기화
    // REQUEST 단계에서 처리하여 실제 속성 업데이트 및 평가 사이클 전에 inputs가 업데이트되도록 함
    takeEvery(
      ReduxActionTypes.UPDATE_WIDGET_PROPERTY_REQUEST,
      handleWidgetPropertyRequestForModuleInputs,
    ),
  ]);
}
