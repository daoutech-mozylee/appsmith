/**
 * moduleTransformUtils - 모듈 데이터 변환 유틸리티
 *
 * 모듈 정의의 원본 데이터를 인스턴스별 고유 데이터로 변환합니다.
 * - 엔티티 이름에 인스턴스 접두사 추가
 * - 바인딩 참조 변환 ({{Entity.prop}} -> {{mod_xxx_Entity.prop}})
 * - this.params 바인딩 변환
 */

import type { Datasource } from "entities/Datasource";
import type {
  ActionConfig,
  ActionCollectionConfig,
} from "constants/PackageModuleConstants";
import { objectKeys } from "@appsmith/utils";

// 타입 정의
export interface ModuleDSLWidget {
  widgetId: string;
  widgetName: string;
  type: string;
  parentId?: string;
  children?: ModuleDSLWidget[];
  dynamicBindingPathList?: Array<{ key: string }>;
  dynamicTriggerPathList?: Array<{ key: string }>;
  [key: string]: unknown;
}

export interface ModuleActionConfig {
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
  runBehaviour?: string;
}

export interface ModuleJSObjectConfig {
  name: string;
  originalName: string;
  body: string;
  variables?: unknown[];
  functions: {
    [functionName: string]: {
      name: string;
      originalName: string;
      runBehaviour?: string;
    };
  };
}

/**
 * 바인딩 경로 내의 엔티티 이름을 변환
 * 예: "{{Query1.data}}" -> "{{mod_xxx_Query1.data}}"
 */
export function transformBindingReferences(
  value: unknown,
  entityNameMapping: Map<string, string>,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  let transformed = value;

  entityNameMapping.forEach((newName, oldName) => {
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
 */
export function transformThisParamsBindings(
  value: unknown,
  instancePrefix: string,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const paramsEntityName = `__${instancePrefix}_params__`;

  let transformed = value;

  // this.params.xxx 패턴 변환
  transformed = transformed.replace(
    /this\.params(?=[\?.\[])/g,
    paramsEntityName,
  );

  // inputs.xxx 패턴도 변환
  transformed = transformed.replace(
    /(?<![a-zA-Z0-9_])inputs(?=[\?.\[])/g,
    paramsEntityName,
  );

  return transformed;
}

/**
 * JSObject body 내의 엔티티 참조를 변환
 */
export function transformJSBodyReferences(
  body: string,
  entityNameMapping: Map<string, string>,
): string {
  let transformed = body;

  entityNameMapping.forEach((newName, oldName) => {
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
 */
export function collectWidgetNameMappings(
  dsl: ModuleDSLWidget,
  instancePrefix: string,
  entityNameMapping: Map<string, string>,
): void {
  const newWidgetName = `${instancePrefix}_${dsl.widgetName}`;

  entityNameMapping.set(dsl.widgetName, newWidgetName);

  if (dsl.children && Array.isArray(dsl.children)) {
    for (const child of dsl.children) {
      collectWidgetNameMappings(child, instancePrefix, entityNameMapping);
    }
  }
}

/**
 * 단일 값에 대해 모든 바인딩 변환을 적용
 */
function applyAllBindingTransforms(
  value: unknown,
  entityNameMapping: Map<string, string>,
  instancePrefix: string,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  let transformed = transformBindingReferences(
    value,
    entityNameMapping,
  ) as string;

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

  for (const key of objectKeys(transformed)) {
    if (key === "children") continue;

    const value = transformed[key];

    if (typeof value === "string") {
      transformed[key] = applyAllBindingTransforms(
        value,
        entityNameMapping,
        instancePrefix,
      );
    } else if (typeof value === "object" && value !== null) {
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
export function transformDSLWithUniqueIds(
  dsl: ModuleDSLWidget,
  instancePrefix: string,
  idMapping: Map<string, string>,
  entityNameMapping: Map<string, string>,
): ModuleDSLWidget {
  const newWidgetId = `${instancePrefix}_${dsl.widgetId}`;
  const newWidgetName = `${instancePrefix}_${dsl.widgetName}`;

  idMapping.set(dsl.widgetId, newWidgetId);
  entityNameMapping.set(dsl.widgetName, newWidgetName);

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

  if (dsl.parentId && idMapping.has(dsl.parentId)) {
    transformed.parentId = idMapping.get(dsl.parentId);
  }

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

  // List 위젯의 mainCanvasId, mainContainerId 변환
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
 * 레지스트리의 Actions를 인스턴스용으로 변환
 * ActionConfig는 unpublishedAction 구조를 가짐
 */
export function transformRegistryActions(
  actions: ActionConfig[],
  instancePrefix: string,
  entityNameMapping: Map<string, string>,
  datasources: Datasource[],
): ModuleActionConfig[] {
  const moduleActions: ModuleActionConfig[] = [];

  for (const action of actions) {
    const unpublished = action.unpublishedAction;
    const originalName = unpublished.name;
    const newName = `${instancePrefix}_${originalName}`;

    entityNameMapping.set(originalName, newName);

    // JSObject의 함수인 경우 fullyQualifiedName도 매핑
    if (unpublished.fullyQualifiedName) {
      const parts = unpublished.fullyQualifiedName.split(".");

      if (parts.length === 2) {
        entityNameMapping.set(parts[0], `${instancePrefix}_${parts[0]}`);
      }
    }

    // DB 또는 SAAS 플러그인인 경우
    if (action.pluginType === "DB" || action.pluginType === "SAAS") {
      const datasourceName = unpublished.datasource.name;
      const matchedDatasource = datasources.find(
        (ds) => ds.name === datasourceName,
      );
      const datasourceId = matchedDatasource?.id;

      const executeOnLoad =
        unpublished.runBehaviour === "AUTOMATIC" ||
        unpublished.runBehaviour === "ON_PAGE_LOAD";

      moduleActions.push({
        name: newName,
        originalName,
        pluginType: action.pluginType,
        pluginId: action.pluginId,
        datasource: {
          name: unpublished.datasource.name,
          pluginId: unpublished.datasource.pluginId,
          id: datasourceId,
        },
        actionConfiguration: {
          ...unpublished.actionConfiguration,
        },
        executeOnLoad,
        runBehaviour: unpublished.runBehaviour,
      });
    }
  }

  return moduleActions;
}

/**
 * JSObject body에서 함수 이름들을 추출
 * export default { funcA() {}, async funcB() {}, funcC: () => {} } 형태 파싱
 */
export function extractFunctionNamesFromBody(body: string): string[] {
  const functionNames: string[] = [];

  // 메서드 정의 패턴: funcName() {}, async funcName() {}
  const methodPattern = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
  let match;

  while ((match = methodPattern.exec(body)) !== null) {
    const name = match[1];

    // export, default, return 등 키워드 제외
    if (
      ![
        "export",
        "default",
        "return",
        "if",
        "else",
        "for",
        "while",
        "switch",
        "catch",
        "function",
      ].includes(name)
    ) {
      functionNames.push(name);
    }
  }

  // 화살표 함수 패턴: funcName: () => {}, funcName: async () => {}
  const arrowPattern = /(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/g;

  while ((match = arrowPattern.exec(body)) !== null) {
    const name = match[1];

    if (!functionNames.includes(name)) {
      functionNames.push(name);
    }
  }

  return functionNames;
}

/**
 * 레지스트리의 ActionCollections(JSObjects)를 인스턴스용으로 변환
 * ActionCollectionConfig는 unpublishedCollection 구조를 가짐
 *
 * @param actionCollections - JSObject 컬렉션 목록
 * @param actions - 전체 액션 목록 (JS 함수의 runBehaviour 조회용)
 * @param instancePrefix - 인스턴스 접두사 (예: "mod_xxx")
 * @param entityNameMapping - 엔티티 이름 매핑
 */
export function transformRegistryJSObjects(
  actionCollections: ActionCollectionConfig[],
  actions: ActionConfig[],
  instancePrefix: string,
  entityNameMapping: Map<string, string>,
): ModuleJSObjectConfig[] {
  // JS 함수의 runBehaviour 매핑 생성 (fullyQualifiedName -> runBehaviour)
  // actionList에서 pluginType: "JS"인 항목들에서 추출
  const jsRunBehaviourMap = new Map<string, string>();

  for (const action of actions) {
    if (
      action.pluginType === "JS" &&
      action.unpublishedAction.fullyQualifiedName
    ) {
      jsRunBehaviourMap.set(
        action.unpublishedAction.fullyQualifiedName,
        action.unpublishedAction.runBehaviour,
      );
    }
  }

  const moduleJSObjects: ModuleJSObjectConfig[] = [];

  for (const collection of actionCollections) {
    const unpublished = collection.unpublishedCollection;
    const originalName = unpublished.name;
    const newName = `${instancePrefix}_${originalName}`;

    entityNameMapping.set(originalName, newName);

    // JSObject body에서 함수 이름들을 추출
    const functionNames = extractFunctionNamesFromBody(unpublished.body);
    const functions: ModuleJSObjectConfig["functions"] = {};

    for (const functionName of functionNames) {
      const fullyQualifiedName = `${originalName}.${functionName}`;

      functions[functionName] = {
        name: `${newName}.${functionName}`,
        originalName: functionName,
        runBehaviour: jsRunBehaviourMap.get(fullyQualifiedName),
      };
    }

    moduleJSObjects.push({
      name: newName,
      originalName,
      body: unpublished.body,
      variables: unpublished.variables,
      functions,
    });
  }

  return moduleJSObjects;
}

/**
 * Action/JSObject 바인딩 변환 적용
 */
export function applyBindingTransformations(
  actions: ModuleActionConfig[],
  jsObjects: ModuleJSObjectConfig[],
  entityNameMapping: Map<string, string>,
  instancePrefix: string,
): {
  transformedActions: ModuleActionConfig[];
  transformedJSObjects: ModuleJSObjectConfig[];
} {
  // Actions의 body에 바인딩 변환 적용
  const transformedActions = actions.map((action) => {
    let body = transformBindingReferences(
      action.actionConfiguration.body,
      entityNameMapping,
    ) as string | undefined;

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
  const transformedJSObjects = jsObjects.map((jsObj) => {
    let body = transformJSBodyReferences(jsObj.body, entityNameMapping);

    body = transformThisParamsBindings(body, instancePrefix) as string;

    return {
      ...jsObj,
      body,
    };
  });

  return { transformedActions, transformedJSObjects };
}

/**
 * 모듈 DSL에서 실제 위젯들을 추출
 */
export function extractTargetWidgets(
  moduleDSL: ModuleDSLWidget,
): ModuleDSLWidget[] {
  const targetWidgets: ModuleDSLWidget[] = [];

  if (moduleDSL.children && moduleDSL.children.length > 0) {
    for (const child of moduleDSL.children) {
      if (child.type === "MODULE_CONTAINER_WIDGET" && child.children) {
        const containerCanvas = child.children[0];

        if (
          containerCanvas &&
          containerCanvas.type === "CANVAS_WIDGET" &&
          containerCanvas.children
        ) {
          targetWidgets.push(...containerCanvas.children);
        }
      } else if (child.type === "CANVAS_WIDGET" && child.children) {
        targetWidgets.push(...child.children);
      } else {
        targetWidgets.push(child);
      }
    }
  }

  return targetWidgets;
}
