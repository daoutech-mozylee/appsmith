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

export const getLoadingEntities = (state: DefaultRootState) =>
  state.evaluations.loadingEntities;

/**
 * 커스텀 모듈 인스턴스의 Action/JSObject 데이터를 DataTree 형식으로 변환
 * - Action: mod_xxx_Query1.data, mod_xxx_Query1.isLoading 등의 바인딩 지원
 * - JSObject: mod_xxx_JSObject1.functionName.data 등의 바인딩 지원
 */
const getCustomModuleInstancesDataTree = createSelector(
  getCustomModuleInstances,
  (moduleInstances: ModuleInstancesState) => {
    const dataTree: UnEvalTree = {};
    const configTree: ConfigTree = {};

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
            variableList[variable.name] = variable.value;
            listVariables.push(variable.name);
            bindingPaths[variable.name] =
              EvaluationSubstitutionType.SMART_SUBSTITUTE;
            reactivePaths[variable.name] =
              EvaluationSubstitutionType.SMART_SUBSTITUTE;
            dynamicBindingPathList.push({ key: variable.name });
          },
        );

        // this. 참조를 JSObject 이름으로 변환
        const transformedBody = jsObject.body.replace(
          /this\./g,
          `${jsObjectName}.`,
        );

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
    });

    return { dataTree, configTree };
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
