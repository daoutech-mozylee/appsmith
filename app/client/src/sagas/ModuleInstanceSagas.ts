/**
 * Module Instance Sagas
 *
 * 모듈 인스턴스의 Query/JS 실행을 담당하는 saga들
 */
import { all, call, put, select, takeEvery } from "redux-saga/effects";
import type { ReduxAction } from "actions/ReduxActionTypes";
import {
  ReduxActionTypes,
  WidgetReduxActionTypes,
} from "ee/constants/ReduxActionConstants";
import type { RegisterModuleInstancePayload } from "reducers/entityReducers/moduleInstancesReducer";
import {
  getModuleInstanceById,
  getModuleInstances,
} from "selectors/moduleInstanceSelectors";
import { getDatasources } from "ee/selectors/entitiesSelector";
import type { Datasource } from "entities/Datasource";
import { getWidgets } from "sagas/selectors";
import type { CanvasWidgetsReduxState } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import { PACKAGE_MODULE_WIDGET_TYPE } from "constants/PackageModuleConstants";
import { getCurrentPageId } from "selectors/editorSelectors";
import type { FlattenedWidgetProps } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import DatasourcesApi from "ee/api/DatasourcesApi";

/**
 * 모듈 인스턴스 등록 후 executeOnLoad Action들을 자동 실행
 */
function* handleModuleInstanceRegistered(
  action: ReduxAction<RegisterModuleInstancePayload>,
) {
  const { actions, instanceId } = action.payload;

  // executeOnLoad가 true인 Action들 찾기
  const executeOnLoadActions = actions.filter((act) => act.executeOnLoad);

  if (executeOnLoadActions.length === 0) {
    return;
  }

  // 각 Action을 순차적으로 실행
  for (const moduleAction of executeOnLoadActions) {
    yield call(executeModuleAction, instanceId, moduleAction.name);
  }
}

/**
 * Datasource 이름으로 ID 찾기
 */
function* findDatasourceByName(
  datasourceName: string,
): Generator<unknown, Datasource | undefined, Datasource[]> {
  const datasources: Datasource[] = yield select(getDatasources);

  return datasources.find((ds) => ds.name === datasourceName);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance: any = yield select(getModuleInstanceById, instanceId);

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
      const formData = moduleAction.actionConfiguration.formData || {};

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
 * 페이지 로드 시 모듈 인스턴스 복원
 * - FETCH_ALL_PAGE_ENTITY_COMPLETION 후 위젯들을 스캔
 * - PACKAGE_MODULE_WIDGET 타입의 위젯에서 moduleInstanceData를 찾음
 * - 각 모듈 위젯에 대해 REGISTER_MODULE_INSTANCE 디스패치
 */
function* handlePageLoadModuleRestore() {
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

  for (const widget of moduleWidgets) {
    // moduleInstanceData가 있는지 확인
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const widgetAny = widget as any;
    const moduleInstanceData = widgetAny.moduleInstanceData;
    const moduleInstanceId = widgetAny.moduleInstanceId;

    if (!moduleInstanceData || !moduleInstanceId) {
      continue;
    }

    // 이미 등록된 인스턴스인지 확인
    if (existingInstances[moduleInstanceId]) {
      continue;
    }

    // 모듈 인스턴스 등록
    yield put({
      type: ReduxActionTypes.REGISTER_MODULE_INSTANCE,
      payload: {
        instanceId: moduleInstanceId,
        moduleId: widgetAny.moduleUUID || "",
        moduleName: widgetAny.moduleName || "",
        packageName: widgetAny.packageName || "",
        widgetId: widget.widgetId,
        pageId,
        actions: moduleInstanceData.actions || [],
        jsObjects: moduleInstanceData.jsObjects || [],
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
 * Module Instance Sagas Root
 */
export default function* moduleInstanceSagas() {
  yield all([
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
  ]);
}
