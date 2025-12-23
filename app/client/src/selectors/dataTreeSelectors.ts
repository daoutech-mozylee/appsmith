import { createSelector } from "reselect";
import {
  getCurrentActions,
  getAppData,
  getPluginDependencyConfig,
  getPluginEditorConfigs,
  getCurrentJSCollections,
  getInputsForModule,
  getModuleInstances,
  getModuleInstanceEntities,
  getCurrentModuleActions,
  getCurrentModuleJSCollections,
} from "ee/selectors/entitiesSelector";
import type { AppsmithEntity, WidgetEntity } from "ee/entities/DataTree/types";
import type {
  ConfigTree,
  DataTree,
  UnEvalTree,
} from "entities/DataTree/dataTreeTypes";
import { DataTreeFactory } from "entities/DataTree/dataTreeFactory";
import { ENTITY_TYPE } from "ee/entities/DataTree/types";
import {
  getIsMobileBreakPoint,
  getMetaWidgets,
  getWidgets,
  getWidgetsMeta,
} from "sagas/selectors";
import "url-search-params-polyfill";
import type { DefaultRootState } from "react-redux";
import { getSelectedAppThemeProperties } from "./appThemingSelectors";
import { getWindowDimensions } from "./windowSelectors";
import type { LoadingEntitiesState } from "reducers/evaluationReducers/loadingEntitiesReducer";
import _, { get } from "lodash";
import type { EvaluationError } from "utils/DynamicBindingUtils";
import { getEvalErrorPath } from "utils/DynamicBindingUtils";
import ConfigTreeActions from "utils/configTree";
import { DATATREE_INTERNAL_KEYWORDS } from "constants/WidgetValidation";
import { getLayoutSystemType } from "./layoutSystemSelectors";
import {
  getCurrentWorkflowActions,
  getCurrentWorkflowJSActions,
} from "ee/selectors/workflowSelectors";
import { getCurrentApplication } from "ee/selectors/applicationSelectors";
import { getCurrentAppWorkspace } from "ee/selectors/selectedWorkspaceSelectors";
import type { PageListReduxState } from "reducers/entityReducers/pageListReducer";
import { getCurrentEnvironmentName } from "ee/selectors/dataTreeCyclicSelectors";
import { objectKeys } from "@appsmith/utils";
// 커스텀 모듈 인스턴스 import
import { getModuleInstances as getCustomModuleInstances } from "selectors/moduleInstanceSelectors";
import type { ModuleInstancesState } from "reducers/entityReducers/moduleInstancesReducer";
import { EvaluationSubstitutionType } from "constants/EvaluationConstants";
import { PACKAGE_MODULE_WIDGET_TYPE } from "constants/PackageModuleConstants";

export const getLoadingEntities = (state: DefaultRootState) =>
  state.evaluations.loadingEntities;

/**
 * 커스텀 모듈 인스턴스의 Action/JSObject 데이터를 DataTree 형식으로 변환
 * - Action: mod_xxx_Query1.data, mod_xxx_Query1.isLoading 등의 바인딩 지원
 * - JSObject: mod_xxx_JSObject1.functionName.data 등의 바인딩 지원
 * - params: __mod_xxx_params__ 엔티티로 this.params 바인딩 지원
 * - outputs: __mod_xxx_outputs__ 엔티티로 모듈 출력값 접근 지원
 * - widgetDataAugmentation: widgetId -> { inputs, outputs } 매핑
 *
 * 위젯 props의 inputs를 직접 읽어 타이밍 문제 해결:
 * - moduleInstances.inputs는 UPDATE_MODULE_INSTANCE_INPUT 후에만 업데이트됨
 * - widgets[widgetId].inputs는 UPDATE_WIDGET_PROPERTY 후 즉시 업데이트됨
 * - 두 소스를 병합하여 최신 값을 사용 (위젯 props 우선)
 */
const getCustomModuleInstancesDataTree = createSelector(
  getCustomModuleInstances,
  getWidgets,
  (moduleInstances: ModuleInstancesState, widgets) => {
    const dataTree: UnEvalTree = {};
    const configTree: ConfigTree = {};
    // widgetId -> { inputs, outputs } 매핑 (위젯 엔티티에 추가할 데이터)
    const widgetDataAugmentation: Record<
      string,
      { inputs: Record<string, unknown>; outputs: Record<string, unknown> }
    > = {};

    // 각 모듈 인스턴스 순회
    Object.values(moduleInstances).forEach((instance) => {
      // 각 Action에 대해 DataTree 엔티티 생성
      Object.entries(instance.actions).forEach(([actionName, action]) => {
        const actionData = instance.actionData[actionName];

        // Action 엔티티 생성 (mod_xxx_Query1)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (dataTree as any)[actionName] = {
          actionId: `${instance.instanceId}_${action.originalName}`,
          data: actionData?.data ?? undefined,
          isLoading: actionData?.isLoading ?? false,
          // 모듈 정보 (확장 속성)
          moduleName: instance.moduleName,
          moduleInstanceId: instance.instanceId,
          // Action 정보
          actionName: action.originalName,
          pluginType: action.pluginType,
          datasource: action.datasource,
          // 메타 정보
          ENTITY_TYPE: ENTITY_TYPE.ACTION,
          run: {},
          clear: {},
          config: {},
          datasourceUrl: "",
          responseMeta: {
            isExecutionSuccess: !actionData?.error,
          },
        };

        // Config 엔티티 생성
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (configTree as any)[actionName] = {
          name: actionName,
          actionId: `${instance.instanceId}_${action.originalName}`,
          pluginType: action.pluginType,
          ENTITY_TYPE: ENTITY_TYPE.ACTION,
          bindingPaths: {
            data: EvaluationSubstitutionType.TEMPLATE,
            isLoading: EvaluationSubstitutionType.TEMPLATE,
          },
          reactivePaths: {
            data: EvaluationSubstitutionType.TEMPLATE,
            isLoading: EvaluationSubstitutionType.TEMPLATE,
          },
          dependencyMap: {},
          logBlackList: {},
          dynamicBindingPathList: [],
        };
      });

      // 각 JSObject에 대해 DataTree 엔티티 생성
      Object.entries(instance.jsObjects).forEach(([jsObjectName, jsObject]) => {
        const jsData = instance.jsData[jsObjectName] || {};

        // JSObject의 함수들을 추출 (body에서 파싱)
        const functionNames = extractFunctionNames(jsObject.body);
        const meta: Record<
          string,
          { arguments: unknown[]; confirmBeforeExecute: boolean }
        > = {};
        const bindingPaths: Record<string, EvaluationSubstitutionType> = {
          body: EvaluationSubstitutionType.SMART_SUBSTITUTE,
        };
        const reactivePaths: Record<string, EvaluationSubstitutionType> = {
          body: EvaluationSubstitutionType.SMART_SUBSTITUTE,
        };
        const dynamicBindingPathList: Array<{ key: string }> = [
          { key: "body" },
        ];
        const dependencyMap: Record<string, string[]> = { body: [] };
        const actionsData: Record<string, { data: unknown }> = {};

        // 각 함수에 대해 메타 정보 생성
        functionNames.forEach((funcName) => {
          meta[funcName] = {
            arguments: [],
            confirmBeforeExecute: false,
          };
          bindingPaths[funcName] = EvaluationSubstitutionType.SMART_SUBSTITUTE;
          reactivePaths[funcName] = EvaluationSubstitutionType.SMART_SUBSTITUTE;
          reactivePaths[`${funcName}.data`] =
            EvaluationSubstitutionType.SMART_SUBSTITUTE;
          dynamicBindingPathList.push({ key: funcName });
          dependencyMap["body"].push(funcName);
          actionsData[funcName] = {
            data: jsData[funcName]?.data ?? {},
          };
        });

        // 변수 처리 (unknown[] 타입이므로 타입 단언 사용)
        const variables = jsObject.variables || [];
        const variableList: Record<string, unknown> = {};
        const listVariables: string[] = [];

        (variables as Array<{ name: string; value: unknown }>).forEach(
          (variable) => {
            // 변수 값이 문자열인 경우 JSON.parse 시도 (JSON에서 로드된 값은 문자열임)
            // 예: "[]" -> [], "null" -> null, "123" -> 123
            let parsedValue = variable.value;

            if (typeof variable.value === "string") {
              try {
                parsedValue = JSON.parse(variable.value);
              } catch {
                // JSON 파싱 실패 시 원래 문자열 값 유지
                parsedValue = variable.value;
              }
            }

            variableList[variable.name] = parsedValue;
            listVariables.push(variable.name);
            bindingPaths[variable.name] =
              EvaluationSubstitutionType.SMART_SUBSTITUTE;
            reactivePaths[variable.name] =
              EvaluationSubstitutionType.SMART_SUBSTITUTE;
            dynamicBindingPathList.push({ key: variable.name });
          },
        );

        // this. 참조를 JSObject 이름으로 변환
        let transformedBody = jsObject.body.replace(
          /this\./g,
          `${jsObjectName}.`,
        );

        // 모듈 인스턴스 JSObject의 변수 초기화 표현식을 실제 값으로 교체
        // eval worker가 body를 파싱할 때 바인딩으로 래핑하는 것을 방지
        // 예: "selectedMembers: inputs?.defaultSelected || []" -> "selectedMembers: []"
        for (const [varName, varValue] of Object.entries(variableList)) {
          // 변수 선언 패턴: varName: <expression> (뒤에 , 또는 } 또는 줄바꿈이 올 수 있음)
          const varPattern = new RegExp(
            `(${varName}\\s*:\\s*)([^,}\\n]+)(?=[,}\\n])`,
            "g",
          );

          transformedBody = transformedBody.replace(
            varPattern,
            `$1${JSON.stringify(varValue)}`,
          );
        }

        // JSObject 엔티티 생성 (mod_xxx_JSObject1)
        dataTree[jsObjectName] = {
          ...variableList,
          ...actionsData,
          body: transformedBody,
          ENTITY_TYPE: ENTITY_TYPE.JSACTION,
          actionId: `${instance.instanceId}_${jsObject.originalName}`,
        };

        // Config 엔티티 생성 (JSObject 구조에 맞게)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (configTree as any)[jsObjectName] = {
          actionId: `${instance.instanceId}_${jsObject.originalName}`,
          meta: meta,
          name: jsObjectName,
          pluginType: "JS",
          ENTITY_TYPE: ENTITY_TYPE.JSACTION,
          bindingPaths: bindingPaths,
          reactivePaths: reactivePaths,
          dynamicBindingPathList: dynamicBindingPathList,
          variables: listVariables,
          dependencyMap: dependencyMap,
          actionNames: new Set(functionNames),
          dynamicTriggerPathList: functionNames.map((name) => ({ key: name })),
        };
      });

      // 모듈 인스턴스의 params 엔티티 생성 (this.params 바인딩 지원)
      // __mod_xxx_params__ 형태로 생성하여 모듈 내부 바인딩에서 접근 가능
      const paramsEntityName = `__${instance.instanceId}_params__`;
      const paramsBindingPaths: Record<string, EvaluationSubstitutionType> = {};
      const paramsReactivePaths: Record<string, EvaluationSubstitutionType> =
        {};

      // 위젯에서 최신 inputs 값 가져오기 (타이밍 문제 해결)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const moduleWidget = widgets[instance.widgetId] as any;
      const widgetInputs = moduleWidget?.inputs || {};

      // inputs 병합: instance.inputs (기본값) + widgetInputs (최신값, 우선)
      const mergedInputs: Record<string, unknown> = {
        ...instance.inputs,
        ...widgetInputs,
      };

      // 간단한 바인딩 문자열을 실제 값으로 파싱
      // 예: "{{[]}}" -> [], "{{true}}" -> true, "{{123}}" -> 123
      const parsedInputs: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(mergedInputs)) {
        if (typeof value === "string") {
          // {{...}} 형태의 바인딩 문자열 확인
          const bindingMatch = value.match(/^\{\{(.+)\}\}$/s);

          if (bindingMatch) {
            let innerValue = bindingMatch[1].trim();

            // trailing comma 제거 (JSON 표준에서 허용 안됨)
            // 예: [1, 2,] -> [1, 2], {"a": 1,} -> {"a": 1}
            innerValue = innerValue.replace(/,(\s*[}\]])/g, "$1");

            // 간단한 리터럴 값만 파싱 시도 ([], {}, true, false, 숫자, 문자열)
            try {
              // JSON으로 파싱 가능한 경우
              parsedInputs[key] = JSON.parse(innerValue);
            } catch {
              // JSON 파싱 실패 시 원래 값 유지 (복잡한 바인딩은 eval worker가 처리)
              parsedInputs[key] = value;
            }
          } else {
            parsedInputs[key] = value;
          }
        } else {
          parsedInputs[key] = value;
        }
      }

      // 각 input에 대해 binding path 생성
      Object.keys(parsedInputs).forEach((inputName) => {
        paramsBindingPaths[inputName] = EvaluationSubstitutionType.TEMPLATE;
        paramsReactivePaths[inputName] = EvaluationSubstitutionType.TEMPLATE;
      });

      // params 엔티티 생성 (parsedInputs 사용 - 바인딩 파싱된 값)
      dataTree[paramsEntityName] = {
        ...parsedInputs,
        ENTITY_TYPE: ENTITY_TYPE.APPSMITH, // Special entity type
        __moduleInstanceId__: instance.instanceId,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (configTree as any)[paramsEntityName] = {
        name: paramsEntityName,
        ENTITY_TYPE: ENTITY_TYPE.APPSMITH,
        bindingPaths: paramsBindingPaths,
        reactivePaths: paramsReactivePaths,
        dependencyMap: {},
        logBlackList: {},
        dynamicBindingPathList: Object.keys(parsedInputs).map((key) => ({
          key,
        })),
      };

      // 모듈 인스턴스의 outputs 엔티티 생성
      // __mod_xxx_outputs__ 형태로 생성하여 부모 페이지에서 접근 가능
      const outputsEntityName = `__${instance.instanceId}_outputs__`;
      const outputsBindingPaths: Record<string, EvaluationSubstitutionType> =
        {};
      const outputsReactivePaths: Record<string, EvaluationSubstitutionType> =
        {};

      // 각 output에 대해 binding path 생성
      Object.keys(instance.outputs).forEach((outputName) => {
        outputsBindingPaths[outputName] = EvaluationSubstitutionType.TEMPLATE;
        outputsReactivePaths[outputName] = EvaluationSubstitutionType.TEMPLATE;
      });

      // outputs 엔티티 생성
      dataTree[outputsEntityName] = {
        ...instance.outputs,
        ENTITY_TYPE: ENTITY_TYPE.APPSMITH,
        __moduleInstanceId__: instance.instanceId,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (configTree as any)[outputsEntityName] = {
        name: outputsEntityName,
        ENTITY_TYPE: ENTITY_TYPE.APPSMITH,
        bindingPaths: outputsBindingPaths,
        reactivePaths: outputsReactivePaths,
        dependencyMap: {},
        logBlackList: {},
        dynamicBindingPathList: Object.keys(instance.outputs).map((key) => ({
          key,
        })),
      };

      // 위젯 엔티티에 추가할 inputs/outputs 데이터 저장
      // widgetId로 매핑하여 나중에 위젯 엔티티에 병합
      // mergedInputs를 사용하여 최신 값 반영
      widgetDataAugmentation[instance.widgetId] = {
        inputs: mergedInputs,
        outputs: instance.outputs,
      };
    });

    return { dataTree, configTree, widgetDataAugmentation };
  },
);

/**
 * JSObject body에서 함수 이름들을 추출
 * 간단한 정규식 기반 파싱 (export default 내부의 함수들)
 */
function extractFunctionNames(body: string): string[] {
  const functionNames: string[] = [];

  // async functionName() 또는 functionName() 또는 functionName: function() 패턴 찾기
  const patterns = [
    /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g, // functionName() { or async functionName() {
    /(\w+)\s*:\s*(?:async\s+)?function\s*\([^)]*\)\s*\{/g, // functionName: function() {
    /(\w+)\s*:\s*(?:async\s+)?\([^)]*\)\s*=>/g, // functionName: () => or functionName: async () =>
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(body)) !== null) {
      const funcName = match[1];

      // 예약어나 특수 키워드 제외
      if (
        funcName &&
        ![
          "if",
          "else",
          "for",
          "while",
          "switch",
          "catch",
          "function",
          "return",
          "export",
          "default",
        ].includes(funcName)
      ) {
        if (!functionNames.includes(funcName)) {
          functionNames.push(funcName);
        }
      }
    }
  }

  return functionNames;
}

/**
 * This selector is created to combine a couple of data points required by getUnevaluatedDataTree selector.
 * Current version of reselect package only allows upto 12 arguments. Hence, this workaround.
 * TODO: Figure out a better way to do this in a separate task. Or update the package if possible.
 */
const getLayoutSystemPayload = createSelector(
  getLayoutSystemType,
  getIsMobileBreakPoint,
  (layoutSystemType, isMobile) => {
    return {
      layoutSystemType,
      isMobile,
    };
  },
);

const getCurrentActionsEntities = createSelector(
  getCurrentActions,
  getCurrentModuleActions,
  getCurrentWorkflowActions,
  (actions, moduleActions, workflowActions) => {
    return [...actions, ...moduleActions, ...workflowActions];
  },
);
const getCurrentJSActionsEntities = createSelector(
  getCurrentJSCollections,
  getCurrentModuleJSCollections,
  getCurrentWorkflowJSActions,
  (jsActions, moduleJSActions, workflowJsActions) => {
    return [...jsActions, ...moduleJSActions, ...workflowJsActions];
  },
);

const getModulesData = createSelector(
  getInputsForModule,
  getModuleInstances,
  getModuleInstanceEntities,
  (moduleInputs, moduleInstances, moduleInstanceEntities) => {
    return {
      moduleInputs: moduleInputs,
      moduleInstances: moduleInstances,
      moduleInstanceEntities: moduleInstanceEntities,
    };
  },
);

const getActionsFromUnevaluatedDataTree = createSelector(
  getCurrentActionsEntities,
  getPluginEditorConfigs,
  getPluginDependencyConfig,
  (actions, editorConfigs, pluginDependencyConfig) =>
    DataTreeFactory.actions(actions, editorConfigs, pluginDependencyConfig),
);

const getJSActionsFromUnevaluatedDataTree = createSelector(
  getCurrentJSActionsEntities,
  (jsActions) => DataTreeFactory.jsActions(jsActions),
);

const getWidgetsFromUnevaluatedDataTree = createSelector(
  getModulesData,
  getWidgets,
  getWidgetsMeta,
  getLoadingEntities,
  getLayoutSystemPayload,
  (moduleData, widgets, widgetsMeta, loadingEntities, layoutSystemPayload) =>
    DataTreeFactory.widgets(
      moduleData.moduleInputs,
      moduleData.moduleInstances,
      moduleData.moduleInstanceEntities,
      widgets,
      widgetsMeta,
      loadingEntities,
      layoutSystemPayload.layoutSystemType,
      layoutSystemPayload.isMobile,
    ),
);
const getMetaWidgetsFromUnevaluatedDataTree = createSelector(
  getMetaWidgets,
  getWidgetsMeta,
  getLoadingEntities,
  (metaWidgets, widgetsMeta, loadingEntities) =>
    DataTreeFactory.metaWidgets(metaWidgets, widgetsMeta, loadingEntities),
);

// * This is only for internal use to avoid cyclic dependency issue
const getPageListState = (state: DefaultRootState) => state.entities.pageList;
const getCurrentPageName = createSelector(
  getPageListState,
  (pageList: PageListReduxState) =>
    pageList.pages.find((page) => page.pageId === pageList.currentPageId)
      ?.pageName,
);

export const getUnevaluatedDataTree = createSelector(
  getActionsFromUnevaluatedDataTree,
  getJSActionsFromUnevaluatedDataTree,
  getWidgetsFromUnevaluatedDataTree,
  getMetaWidgetsFromUnevaluatedDataTree,
  getAppData,
  getSelectedAppThemeProperties,
  getWindowDimensions,
  getCurrentAppWorkspace,
  getCurrentApplication,
  getCurrentPageName,
  getCurrentEnvironmentName,
  getCustomModuleInstancesDataTree, // 커스텀 모듈 인스턴스 추가
  (
    actions,
    jsActions,
    widgets,
    metaWidgets,
    appData,
    theme,
    windowDimensions,
    currentWorkspace,
    currentApplication,
    getCurrentPageName,
    currentEnvironmentName,
    customModuleInstances, // 커스텀 모듈 인스턴스 데이터
  ) => {
    let dataTree: UnEvalTree = {
      ...actions.dataTree,
      ...jsActions.dataTree,
      ...widgets.dataTree,
      ...customModuleInstances.dataTree, // 커스텀 모듈 인스턴스 병합
    };
    let configTree: ConfigTree = {
      ...actions.configTree,
      ...jsActions.configTree,
      ...widgets.configTree,
      ...customModuleInstances.configTree, // 커스텀 모듈 인스턴스 config 병합
    };

    dataTree.appsmith = {
      ...appData,
      // combine both persistent and transient state with the transient state
      // taking precedence in case the key is the same
      store: appData.store,
      theme,
      ui: windowDimensions,
      currentPageName: getCurrentPageName,
      workspaceName: currentWorkspace.name,
      appName: currentApplication?.name,
      currentEnvironmentName,
      ENTITY_TYPE: ENTITY_TYPE.APPSMITH,
    } as AppsmithEntity;
    dataTree = { ...dataTree, ...metaWidgets.dataTree };
    configTree = { ...configTree, ...metaWidgets.configTree };

    // PackageModuleWidget 엔티티에 inputs/outputs 속성 추가
    // 이를 통해 PackageModule1.outputs.selectedMember 형식의 바인딩 지원
    const { widgetDataAugmentation } = customModuleInstances;

    Object.entries(dataTree).forEach(([entityName, entity]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entityAny = entity as any;

      // PackageModuleWidget 타입인 경우에만 처리
      if (
        entityAny?.type === PACKAGE_MODULE_WIDGET_TYPE &&
        entityAny?.widgetId
      ) {
        const augmentation = widgetDataAugmentation[entityAny.widgetId];

        if (augmentation) {
          // inputs와 outputs 속성 추가
          entityAny.inputs = augmentation.inputs;
          entityAny.outputs = augmentation.outputs;

          // configTree에도 binding paths 추가
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const configEntity = configTree[entityName] as any;

          if (configEntity) {
            // inputs의 각 key에 대해 binding path 추가
            Object.keys(augmentation.inputs).forEach((inputKey) => {
              const path = `inputs.${inputKey}`;

              configEntity.bindingPaths[path] =
                EvaluationSubstitutionType.TEMPLATE;
              configEntity.reactivePaths[path] =
                EvaluationSubstitutionType.TEMPLATE;
            });

            // outputs의 각 key에 대해 binding path 추가
            Object.keys(augmentation.outputs).forEach((outputKey) => {
              const path = `outputs.${outputKey}`;

              configEntity.bindingPaths[path] =
                EvaluationSubstitutionType.TEMPLATE;
              configEntity.reactivePaths[path] =
                EvaluationSubstitutionType.TEMPLATE;
            });
          }
        }
      }
    });

    return { unEvalTree: dataTree, configTree };
  },
);

export const getEvaluationInverseDependencyMap = (state: DefaultRootState) =>
  state.evaluations.dependencies.inverseDependencyMap;

export const getIsWidgetLoading = createSelector(
  [
    getLoadingEntities,
    (_state: DefaultRootState, widgetName: string) => widgetName,
  ],
  (loadingEntities: LoadingEntitiesState, widgetName: string) =>
    loadingEntities.has(widgetName),
);

/**
 * returns evaluation tree object
 *
 * @param state
 */
export const getDataTree = (state: DefaultRootState): DataTree =>
  state.evaluations.tree;

// TODO: Fix this the next time the file is edited
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getConfigTree = (): any => {
  return ConfigTreeActions.getConfigTree();
};

export const getWidgetEvalValues = createSelector(
  [getDataTree, (_state: DefaultRootState, widgetName: string) => widgetName],
  (tree: DataTree, widgetName: string) => tree[widgetName] as WidgetEntity,
);

// For autocomplete. Use actions cached responses if
// there isn't a response already
export const getDataTreeForAutocomplete = createSelector(
  getDataTree,
  (tree: DataTree) => {
    return _.omit(tree, objectKeys(DATATREE_INTERNAL_KEYWORDS));
  },
);

export const getPathEvalErrors = createSelector(
  [
    getDataTreeForAutocomplete,
    (_: unknown, dataTreePath: string) => dataTreePath,
  ],
  (dataTree: DataTree, dataTreePath: string) =>
    get(dataTree, getEvalErrorPath(dataTreePath), []) as EvaluationError[],
);
