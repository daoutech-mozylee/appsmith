/**
 * ModuleInterfaceSagas
 *
 * Purpose:
 * This saga file serves as a bridge between the Community Edition (CE) and Enterprise Edition (EE)
 * module-related functionalities. It provides a clean interface layer that handles all interactions
 * between core widget operations and module-specific features available in the enterprise version.
 */
import type { WidgetAddChild } from "actions/pageActions";
import type { ReduxAction } from "actions/ReduxActionTypes";
import type {
  CanvasWidgetsReduxState,
  FlattenedWidgetProps,
} from "ee/reducers/entityReducers/canvasWidgetsReducer";
import type { Saga } from "redux-saga";
import { put, select } from "redux-saga/effects";
import {
  PACKAGE_MODULE_WIDGET_TYPE,
  type ModuleInputSection,
  type ModuleOutputSection,
  type ModuleInstanceInputs,
} from "constants/PackageModuleConstants";
import { generateReactKey } from "utils/generators";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";
import { getCurrentPageId } from "selectors/editorSelectors";
import { getDatasources } from "ee/selectors/entitiesSelector";
import type { Datasource } from "entities/Datasource";
import { objectKeys } from "@appsmith/utils";

export interface HandleModuleWidgetCreationSagaPayload {
  addChildPayload: WidgetAddChild;
  widgets: CanvasWidgetsReduxState;
}

// 모듈 DSL 타입 정의
interface ModuleDSLWidget {
  widgetId: string;
  widgetName: string;
  type: string;
  parentId?: string;
  children?: ModuleDSLWidget[];
  dynamicBindingPathList?: Array<{ key: string }>;
  dynamicTriggerPathList?: Array<{ key: string }>;
  [key: string]: unknown;
}

// 모듈 Action 타입 정의
interface ModuleAction {
  id: string;
  pluginType: string;
  pluginId: string;
  unpublishedAction: {
    moduleId: string;
    name: string;
    fullyQualifiedName?: string;
    datasource: {
      name: string;
      pluginId: string;
      id?: string;
    };
    actionConfiguration: {
      body?: string;
      timeoutInMillisecond?: number;
      [key: string]: unknown;
    };
    runBehaviour?: string;
    dynamicBindingPathList?: Array<{ key: string }>;
    collectionId?: string;
    [key: string]: unknown;
  };
}

// 모듈 ActionCollection(JS Object) 타입 정의
interface ModuleActionCollection {
  id: string;
  unpublishedCollection: {
    moduleId: string;
    name: string;
    pluginId: string;
    pluginType: string;
    body: string;
    variables?: unknown[];
    actions?: unknown[];
  };
}

/**
 * 바인딩 경로 내의 엔티티 이름을 변환
 * 예: "{{Query1.data}}" -> "{{mod_xxx_Query1.data}}"
 * 예: "{{closeModal(Modal1.name)}}" -> "{{closeModal(mod_xxx_Modal1.name)}}"
 */
function transformBindingReferences(
  value: unknown,
  entityNameMapping: Map<string, string>,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  let transformed = value;

  // 각 엔티티 이름에 대해 변환
  entityNameMapping.forEach((newName, oldName) => {
    // 바인딩 내에서 엔티티 이름 뒤에 . 또는 [ 또는 공백이 오는 모든 경우 변환
    // 예: EntityName.xxx, EntityName[xxx], EntityName )
    // 단어 경계를 사용하여 정확한 매칭 (EntityName123 같은 것은 매칭 안 함)
    const generalPattern = new RegExp(
      `(?<![a-zA-Z0-9_])${oldName}(?=[.\\[\\s\\)])`,
      "g",
    );

    transformed = transformed.replace(generalPattern, newName);
  });

  return transformed;
}

/**
 * this.params 및 inputs 바인딩을 모듈 인스턴스의 params 엔티티 참조로 변환
 * 예: "{{this.params.defaultSelected}}" -> "{{__mod_xxx_params__.defaultSelected}}"
 * 예: "{{this.params['inputName']}}" -> "{{__mod_xxx_params__['inputName']}}"
 * 예: "{{inputs.label}}" -> "{{__mod_xxx_params__.label}}"
 */
function transformThisParamsBindings(
  value: unknown,
  instancePrefix: string,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const paramsEntityName = `__${instancePrefix}_params__`;

  let transformed = value;

  // 1. this.params.xxx 또는 this.params['xxx'] 패턴을 변환
  transformed = transformed.replace(/this\.params(?=[.\[])/g, paramsEntityName);

  // 2. inputs.xxx 패턴도 변환 (모듈 JSON에서 사용하는 형식)
  // 단어 경계를 사용하여 정확한 매칭 (예: myInputs는 매칭하지 않음)
  transformed = transformed.replace(
    /(?<![a-zA-Z0-9_])inputs(?=[.\[])/g,
    paramsEntityName,
  );

  return transformed;
}

/**
 * JSObject body 내의 엔티티 참조를 변환
 * JSObject 내에서는 {{}} 없이 직접 엔티티를 참조함
 * 예: "Table1.selectedRow" -> "mod_xxx_Table1.selectedRow"
 */
function transformJSBodyReferences(
  body: string,
  entityNameMapping: Map<string, string>,
): string {
  let transformed = body;

  // 각 엔티티 이름에 대해 변환
  entityNameMapping.forEach((newName, oldName) => {
    // 단어 경계를 사용하여 정확한 엔티티 이름만 변환
    // EntityName.xxx 또는 EntityName[xxx] 패턴
    // 주의: 이미 변환된 이름(mod_xxx_)은 제외
    const pattern = new RegExp(
      `(?<!mod_[a-zA-Z0-9]+_)\\b${oldName}\\b(?=[.\\[])`,
      "g",
    );

    transformed = transformed.replace(pattern, newName);
  });

  return transformed;
}

/**
 * DSL 트리에서 모든 위젯 이름을 수집하여 매핑 생성
 * 바인딩 변환 전에 호출하여 위젯 참조도 변환할 수 있도록 함
 */
function collectWidgetNameMappings(
  dsl: ModuleDSLWidget,
  instancePrefix: string,
  entityNameMapping: Map<string, string>,
): void {
  // 현재 위젯 이름 매핑 추가
  const newWidgetName = `${instancePrefix}_${dsl.widgetName}`;

  entityNameMapping.set(dsl.widgetName, newWidgetName);

  // 자식 위젯들도 재귀적으로 수집
  if (dsl.children && Array.isArray(dsl.children)) {
    for (const child of dsl.children) {
      collectWidgetNameMappings(child, instancePrefix, entityNameMapping);
    }
  }
}

/**
 * 단일 값에 대해 모든 바인딩 변환을 적용
 * 1. 엔티티 이름 변환 (Query1 -> mod_xxx_Query1)
 * 2. this.params 변환 (this.params.xxx -> __mod_xxx_params__.xxx)
 */
function applyAllBindingTransforms(
  value: unknown,
  entityNameMapping: Map<string, string>,
  instancePrefix: string,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // 1. 엔티티 이름 변환
  let transformed = transformBindingReferences(
    value,
    entityNameMapping,
  ) as string;

  // 2. this.params 변환
  transformed = transformThisParamsBindings(
    transformed,
    instancePrefix,
  ) as string;

  return transformed;
}

/**
 * 위젯의 모든 속성에서 바인딩 참조를 변환
 */
function transformWidgetBindings(
  widget: ModuleDSLWidget,
  entityNameMapping: Map<string, string>,
  instancePrefix: string,
): ModuleDSLWidget {
  const transformed: ModuleDSLWidget = { ...widget };

  // 모든 속성을 순회하면서 바인딩 변환
  for (const key of objectKeys(transformed)) {
    if (key === "children") continue; // children은 별도 처리

    const value = transformed[key];

    if (typeof value === "string") {
      const newValue = applyAllBindingTransforms(
        value,
        entityNameMapping,
        instancePrefix,
      );

      // 디버그: 바인딩 변환 로깅 (trigger path인 경우)
      if (
        key === "onItemClick" ||
        key === "onClick" ||
        key === "onRowSelected"
      ) {
        // eslint-disable-next-line no-console
        console.log(
          `[transformWidgetBindings] ${widget.widgetName}.${key}:`,
          `\n  Original: ${value}`,
          `\n  Transformed: ${newValue}`,
          `\n  EntityMapping:`,
          Object.fromEntries(entityNameMapping),
        );
      }

      transformed[key] = newValue;
    } else if (typeof value === "object" && value !== null) {
      // 중첩 객체도 처리 (예: primaryColumns)
      transformed[key] = JSON.parse(
        JSON.stringify(value, (k, v) => {
          if (typeof v === "string") {
            return applyAllBindingTransforms(
              v,
              entityNameMapping,
              instancePrefix,
            );
          }

          return v;
        }),
      );
    }
  }

  // 자식 위젯들도 재귀적으로 변환
  if (widget.children && Array.isArray(widget.children)) {
    transformed.children = widget.children.map((child) =>
      transformWidgetBindings(child, entityNameMapping, instancePrefix),
    );
  }

  return transformed;
}

/**
 * DSL 트리를 순회하면서 위젯 ID와 이름을 고유하게 변환
 */
function transformDSLWithUniqueIds(
  dsl: ModuleDSLWidget,
  instancePrefix: string,
  idMapping: Map<string, string>,
  entityNameMapping: Map<string, string>,
): ModuleDSLWidget {
  const newWidgetId = `${instancePrefix}_${dsl.widgetId}`;
  const newWidgetName = `${instancePrefix}_${dsl.widgetName}`;

  // 기존 ID -> 새 ID 매핑 저장
  idMapping.set(dsl.widgetId, newWidgetId);

  // 위젯 이름도 엔티티 매핑에 추가 (바인딩 변환용)
  entityNameMapping.set(dsl.widgetName, newWidgetName);

  // 먼저 바인딩 변환 적용 (엔티티 이름 변환 + this.params 변환)
  const bindingTransformed = transformWidgetBindings(
    dsl,
    entityNameMapping,
    instancePrefix,
  );

  const transformed: ModuleDSLWidget = {
    ...bindingTransformed,
    widgetId: newWidgetId,
    widgetName: newWidgetName,
  };

  // parentId도 변환 (매핑에 있으면)
  if (dsl.parentId && idMapping.has(dsl.parentId)) {
    transformed.parentId = idMapping.get(dsl.parentId);
  }

  // 자식 위젯들을 먼저 재귀적으로 변환 (자식 ID가 idMapping에 등록되어야 함)
  if (dsl.children && Array.isArray(dsl.children)) {
    transformed.children = dsl.children.map((child) =>
      transformDSLWithUniqueIds(
        child,
        instancePrefix,
        idMapping,
        entityNameMapping,
      ),
    );
  }

  // List 위젯의 mainCanvasId, mainContainerId 변환 (자식 처리 후에 수행)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyTransformed = transformed as any;

  if (
    anyTransformed.mainCanvasId &&
    idMapping.has(anyTransformed.mainCanvasId)
  ) {
    anyTransformed.mainCanvasId = idMapping.get(anyTransformed.mainCanvasId);
  }

  if (
    anyTransformed.mainContainerId &&
    idMapping.has(anyTransformed.mainContainerId)
  ) {
    anyTransformed.mainContainerId = idMapping.get(
      anyTransformed.mainContainerId,
    );
  }

  return transformed;
}

/**
 * DSL 트리를 평탄화하여 widgets 객체 형태로 변환
 */
function flattenDSLToWidgets(
  dsl: ModuleDSLWidget,
  widgets: CanvasWidgetsReduxState,
  parentId: string,
): CanvasWidgetsReduxState {
  // 현재 위젯 추가
  const flattenedWidget: FlattenedWidgetProps = {
    ...dsl,
    parentId,
    children: dsl.children?.map((child) => child.widgetId) || [],
  } as FlattenedWidgetProps;

  // children 속성은 ID 배열로 변환됨
  delete (flattenedWidget as ModuleDSLWidget).children;

  if (dsl.children) {
    flattenedWidget.children = dsl.children.map((child) => child.widgetId);
  }

  widgets[dsl.widgetId] = flattenedWidget;

  // 자식 위젯들도 재귀적으로 평탄화
  if (dsl.children && Array.isArray(dsl.children)) {
    for (const child of dsl.children) {
      flattenDSLToWidgets(child, widgets, dsl.widgetId);
    }
  }

  return widgets;
}

/**
 * 모듈 Actions를 인스턴스용으로 변환
 * @param actions 모듈 액션 배열
 * @param instancePrefix 인스턴스 접두사
 * @param entityNameMapping 엔티티 이름 매핑
 * @param datasources 워크스페이스의 datasources 배열 (ID 매핑용)
 */
function prepareModuleActions(
  actions: ModuleAction[],
  instancePrefix: string,
  entityNameMapping: Map<string, string>,
  datasources: Datasource[],
) {
  const moduleActions: Array<{
    name: string;
    originalName: string;
    pluginType: string;
    pluginId: string;
    datasource: {
      name: string;
      pluginId: string;
      id?: string;
    };
    actionConfiguration: {
      body?: string;
      timeoutInMillisecond?: number;
      [key: string]: unknown;
    };
    executeOnLoad?: boolean;
  }> = [];

  for (const action of actions) {
    const originalName = action.unpublishedAction.name;
    const newName = `${instancePrefix}_${originalName}`;

    // 엔티티 이름 매핑 추가
    entityNameMapping.set(originalName, newName);

    // JSObject의 함수인 경우 fullyQualifiedName도 매핑
    if (action.unpublishedAction.fullyQualifiedName) {
      const parts = action.unpublishedAction.fullyQualifiedName.split(".");

      if (parts.length === 2) {
        entityNameMapping.set(parts[0], `${instancePrefix}_${parts[0]}`);
      }
    }

    // DB 또는 SAAS 플러그인 쿼리인 경우 (API, Google Sheets 등)
    if (action.pluginType === "DB" || action.pluginType === "SAAS") {
      // datasource 이름으로 실제 ID 찾기 (View 모드에서 사용하기 위해 미리 저장)
      // 패키지 JSON의 datasource.id는 이름과 같은 값일 수 있으므로, 실제 datasource에서 찾은 ID를 우선 사용
      const datasourceName = action.unpublishedAction.datasource.name;
      const matchedDatasource = datasources.find(
        (ds) => ds.name === datasourceName,
      );
      // 실제 datasource에서 찾은 ID를 우선 사용 (패키지 JSON의 id는 이름일 수 있음)
      const datasourceId = matchedDatasource?.id;

      // datasource not found 시 런타임에서 에러 처리됨

      const executeOnLoad =
        action.unpublishedAction.runBehaviour === "AUTOMATIC" ||
        action.unpublishedAction.runBehaviour === "ON_PAGE_LOAD";

      moduleActions.push({
        name: newName,
        originalName,
        pluginType: action.pluginType,
        pluginId: action.pluginId,
        datasource: {
          ...action.unpublishedAction.datasource,
          id: datasourceId, // ID 추가
        },
        actionConfiguration: {
          ...action.unpublishedAction.actionConfiguration,
          // 바인딩 변환은 나중에 전체 매핑이 완료된 후 적용
        },
        executeOnLoad,
        // 런타임 체크를 위해 원본 runBehaviour 저장
        runBehaviour: action.unpublishedAction.runBehaviour,
      });
    }
  }

  return moduleActions;
}

/**
 * 모듈 JSObjects를 인스턴스용으로 변환
 */
function prepareModuleJSObjects(
  actionCollections: ModuleActionCollection[],
  instancePrefix: string,
  entityNameMapping: Map<string, string>,
) {
  const moduleJSObjects: Array<{
    name: string;
    originalName: string;
    body: string;
    variables?: unknown[];
  }> = [];

  for (const collection of actionCollections) {
    const originalName = collection.unpublishedCollection.name;
    const newName = `${instancePrefix}_${originalName}`;

    // 엔티티 이름 매핑 추가
    entityNameMapping.set(originalName, newName);

    moduleJSObjects.push({
      name: newName,
      originalName,
      body: collection.unpublishedCollection.body,
      variables: collection.unpublishedCollection.variables,
    });
  }

  return moduleJSObjects;
}

/**
 * Action/JSObject 바인딩 변환 적용
 */
function applyBindingTransformations(
  actions: ReturnType<typeof prepareModuleActions>,
  jsObjects: ReturnType<typeof prepareModuleJSObjects>,
  entityNameMapping: Map<string, string>,
  instancePrefix: string,
) {
  // Actions의 body에 바인딩 변환 적용 (엔티티 이름 + this.params)
  const transformedActions = actions.map((action) => {
    let body = transformBindingReferences(
      action.actionConfiguration.body,
      entityNameMapping,
    ) as string | undefined;

    // this.params 변환 적용
    if (body) {
      body = transformThisParamsBindings(body, instancePrefix) as string;
    }

    return {
      ...action,
      actionConfiguration: {
        ...action.actionConfiguration,
        body,
      },
    };
  });

  // JSObjects의 body에 바인딩 변환 적용
  // JSObject 내에서는 {{}} 없이 직접 엔티티를 참조하므로 transformJSBodyReferences 사용
  const transformedJSObjects = jsObjects.map((jsObj) => {
    let body = transformJSBodyReferences(jsObj.body, entityNameMapping);

    // this.params 변환 적용
    body = transformThisParamsBindings(body, instancePrefix) as string;

    return {
      ...jsObj,
      body,
    };
  });

  return { transformedActions, transformedJSObjects };
}

/**
 * Package Module 위젯 생성 시 내부 DSL을 처리하는 saga
 */
export function* handleModuleWidgetCreationSaga(
  props: HandleModuleWidgetCreationSagaPayload,
) {
  const { addChildPayload, widgets } = props;
  const { newWidgetId, props: widgetProps, type } = addChildPayload;

  // Package Module 위젯이 아니면 기본 동작
  if (type !== PACKAGE_MODULE_WIDGET_TYPE) {
    return widgets;
  }

  // widgetProps에서 모듈 정보 추출
  const moduleData = widgetProps as
    | {
        moduleName?: string;
        packageName?: string;
        moduleUUID?: string;
        packageUUID?: string;
        dsl?: ModuleDSLWidget;
        actions?: ModuleAction[];
        actionCollections?: ModuleActionCollection[];
        // Input/Output 정의 (모듈 설정)
        inputsForm?: ModuleInputSection[];
        outputsForm?: ModuleOutputSection[];
        // 초기 Input 값 (위젯 props에서 전달)
        inputs?: ModuleInstanceInputs;
      }
    | undefined;

  if (!moduleData || !moduleData.dsl) {
    return widgets;
  }

  const pageId: string = yield select(getCurrentPageId);

  // 새로 생성된 PackageModuleWidget 가져오기
  const packageModuleWidget = widgets[newWidgetId];

  if (!packageModuleWidget) {
    return widgets;
  }

  // blueprint로 생성된 내부 Canvas 위젯 찾기
  const canvasWidgetId = packageModuleWidget.children?.[0];

  if (!canvasWidgetId) {
    return widgets;
  }

  const canvasWidget = widgets[canvasWidgetId];

  if (!canvasWidget || canvasWidget.type !== "CANVAS_WIDGET") {
    return widgets;
  }

  // 고유 인스턴스 ID 생성
  const instancePrefix = `mod_${generateReactKey()}`;
  const idMapping = new Map<string, string>();
  const entityNameMapping = new Map<string, string>();

  // 1. 모듈 DSL에서 실제 위젯들 먼저 추출 (위젯 이름 매핑을 위해)
  // Modal, Drawer 등 MainContainer의 모든 children을 처리해야 함
  const moduleDSL = moduleData.dsl;
  const targetWidgets: ModuleDSLWidget[] = [];

  if (moduleDSL.children && moduleDSL.children.length > 0) {
    // 모든 children을 순회하면서 위젯 추출
    for (const child of moduleDSL.children) {
      if (child.type === "MODULE_CONTAINER_WIDGET" && child.children) {
        // ModuleContainer 내부의 실제 위젯들 추출
        const containerCanvas = child.children[0];

        if (
          containerCanvas &&
          containerCanvas.type === "CANVAS_WIDGET" &&
          containerCanvas.children
        ) {
          targetWidgets.push(...containerCanvas.children);
        }
      } else if (child.type === "CANVAS_WIDGET" && child.children) {
        // Canvas 위젯의 children 추출
        targetWidgets.push(...child.children);
      } else {
        // Modal, Drawer 등 다른 위젯은 직접 추가
        targetWidgets.push(child);
      }
    }
  }

  // 2. 위젯 이름 매핑 먼저 수집 (JSObject에서 위젯 참조 변환을 위해)
  for (const widget of targetWidgets) {
    collectWidgetNameMappings(widget, instancePrefix, entityNameMapping);
  }

  // 3. Datasources 조회 (View 모드에서 사용하기 위해 ID를 미리 저장)
  const datasources: Datasource[] = yield select(getDatasources);

  // 4. Actions와 JSObjects 준비 (이름 매핑에 추가)
  const moduleActions = moduleData.actions
    ? prepareModuleActions(
        moduleData.actions,
        instancePrefix,
        entityNameMapping,
        datasources,
      )
    : [];

  const moduleJSObjects = moduleData.actionCollections
    ? prepareModuleJSObjects(
        moduleData.actionCollections,
        instancePrefix,
        entityNameMapping,
      )
    : [];

  // 5. 바인딩 변환 적용 (전체 매핑이 완료된 후 - 위젯 + Actions + JSObjects + this.params)
  const { transformedActions, transformedJSObjects } =
    applyBindingTransformations(
      moduleActions,
      moduleJSObjects,
      entityNameMapping,
      instancePrefix,
    );

  // 6. 모듈 인스턴스 등록 (독립적인 Redux slice에 저장)
  yield put({
    type: ReduxActionTypes.REGISTER_MODULE_INSTANCE,
    payload: {
      instanceId: instancePrefix,
      moduleId: moduleData.moduleUUID || moduleData.moduleName,
      moduleName: moduleData.moduleName,
      packageName: moduleData.packageName,
      widgetId: newWidgetId,
      pageId,
      actions: transformedActions,
      jsObjects: transformedJSObjects,
      // Input/Output 정의 (모듈 설정에서 가져옴)
      inputsForm: moduleData.inputsForm,
      outputsForm: moduleData.outputsForm,
      // 초기 Input 값 (위젯 props에서 전달)
      initialInputs: moduleData.inputs,
    },
  });

  if (targetWidgets.length === 0) {
    return widgets;
  }

  // 7. 각 위젯을 변환하고 Canvas에 추가 (바인딩 변환 포함)
  let updatedWidgets = { ...widgets };
  const newChildrenIds: string[] = [];

  for (const widget of targetWidgets) {
    // 위젯과 그 자식들의 ID를 고유하게 변환 + 바인딩 변환
    const transformedWidget = transformDSLWithUniqueIds(
      widget,
      instancePrefix,
      idMapping,
      entityNameMapping,
    );

    // 변환된 위젯을 평탄화하여 widgets에 추가
    updatedWidgets = flattenDSLToWidgets(
      transformedWidget,
      updatedWidgets,
      canvasWidgetId,
    );

    // Canvas의 children에 추가할 ID 저장
    newChildrenIds.push(transformedWidget.widgetId);
  }

  // Canvas 위젯의 children 업데이트
  updatedWidgets[canvasWidgetId] = {
    ...updatedWidgets[canvasWidgetId],
    children: [
      ...(updatedWidgets[canvasWidgetId].children || []),
      ...newChildrenIds,
    ],
  };

  // PackageModuleWidget에 모듈 정보 저장 (페이지 로드 시 복원용)
  updatedWidgets[newWidgetId] = {
    ...updatedWidgets[newWidgetId],
    moduleName: moduleData.moduleName,
    packageName: moduleData.packageName,
    moduleUUID: moduleData.moduleUUID,
    packageUUID: moduleData.packageUUID,
    moduleInstanceId: instancePrefix,
    // 페이지 로드 시 모듈 인스턴스 복원을 위해 데이터 저장
    moduleInstanceData: {
      actions: transformedActions,
      jsObjects: transformedJSObjects,
      inputsForm: moduleData.inputsForm,
      outputsForm: moduleData.outputsForm,
    },
    // Input/Output 정의 (Property Pane에서 직접 접근용)
    inputsForm: moduleData.inputsForm,
    outputsForm: moduleData.outputsForm,
    // Input 값 저장 (위젯 props로 전달된 값)
    inputs: moduleData.inputs,
  };

  return updatedWidgets;
}

export function* waitForPackageInitialization(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  saga: Saga,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  action: ReduxAction<unknown>,
) {}

export function* handleUIModuleWidgetReplay(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toasts: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  widgets: CanvasWidgetsReduxState,
) {}
