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
import { getEvalErrorPath, isDynamicValue } from "utils/DynamicBindingUtils";
import ConfigTreeActions from "utils/configTree";
import {
  transformBindingReferences,
  transformThisParamsBindings,
} from "utils/moduleTransformUtils";
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
    // instanceId -> entityNameMapping 매핑 (위젯 바인딩 변환용)
    const entityNameMappings: Record<string, Map<string, string>> = {};

    // 각 모듈 인스턴스 순회
    Object.values(moduleInstances).forEach((instance) => {
      // 전체 엔티티 이름 매핑 (Actions + JSObjects + Widgets)
      const entityNameMapping = new Map<string, string>();

      // 모듈 내 위젯 이름 매핑 생성 (위젯 참조 변환용)
      // instance.instanceId로 시작하는 위젯들을 찾아서 원본 이름 -> 변환된 이름 매핑 생성
      // 예: "Modal1" -> "mod_xxx_Modal1", "Chip" -> "mod_xxx_Chip"
      const widgetNameMapping: Record<string, string> = {};

      Object.entries(widgets).forEach(([, widget]) => {
        const widgetName = widget.widgetName;

        // 인스턴스 접두사로 시작하는 위젯 찾기
        if (widgetName && widgetName.startsWith(`${instance.instanceId}_`)) {
          // 원본 이름 추출: mod_xxx_Modal1 -> Modal1
          const originalName = widgetName.replace(
            `${instance.instanceId}_`,
            "",
          );

          widgetNameMapping[originalName] = widgetName;
          // entityNameMapping에도 추가 (위젯 바인딩 변환용)
          entityNameMapping.set(originalName, widgetName);
        }
      });

      // Action 이름 매핑 추가 (엔티티 바인딩 변환용)
      Object.entries(instance.actions).forEach(([actionName, action]) => {
        entityNameMapping.set(action.originalName, actionName);
      });

      // JSObject 이름 매핑 추가 (엔티티 바인딩 변환용)
      Object.entries(instance.jsObjects).forEach(([jsObjectName, jsObject]) => {
        entityNameMapping.set(jsObject.originalName, jsObjectName);
      });

      // entityNameMappings에 저장 (위젯 바인딩 변환 시 사용)
      entityNameMappings[instance.instanceId] = entityNameMapping;

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
        // 바인딩 표현식을 가진 변수들 (body 교체 시 별도 처리 필요)
        const bindingVariables: Record<string, string> = {};
        const listVariables: string[] = [];

        (variables as Array<{ name: string; value: unknown }>).forEach(
          (variable) => {
            // 변수 값이 문자열인 경우 처리
            let parsedValue = variable.value;
            // body 교체 시 사용할 값 (바인딩이면 기본값)
            let bodyReplacementValue = variable.value;

            if (typeof variable.value === "string") {
              // 바인딩 표현식 체크 ({{...}} 형식)
              if (isDynamicValue(variable.value)) {
                // 바인딩 표현식인 경우: {{inputs?.defaultSelected || []}}
                // inputs를 __mod_xxx_params__로 변환하여 eval worker가 평가할 수 있도록 함
                const paramsEntityName = `__${instance.instanceId}_params__`;
                const transformedBinding = variable.value.replace(
                  /\binputs\b/g,
                  paramsEntityName,
                );

                // variableList에는 변환된 바인딩 표현식 저장 (eval worker가 평가)
                parsedValue = transformedBinding;
                bindingVariables[variable.name] = transformedBinding;

                // body 교체용 기본값 추출: {{expr || defaultValue}}에서 defaultValue 추출
                const bindingContent = variable.value.slice(2, -2).trim(); // {{ }} 제거
                const orMatch = bindingContent.match(
                  /\|\|\s*(\[.*?\]|\{.*?\}|null|undefined|true|false|\d+|".*?"|'.*?')$/,
                );

                if (orMatch) {
                  try {
                    bodyReplacementValue = JSON.parse(orMatch[1]);
                  } catch {
                    bodyReplacementValue = [];
                  }
                } else {
                  bodyReplacementValue = undefined;
                }
              } else {
                // 일반 문자열: JSON.parse 시도
                // 예: "[]" -> [], "null" -> null, "123" -> 123
                try {
                  parsedValue = JSON.parse(variable.value);
                  bodyReplacementValue = parsedValue;
                } catch {
                  // JSON 파싱 실패 시 원래 문자열 값 유지
                  parsedValue = variable.value;
                  bodyReplacementValue = variable.value;
                }
              }
            }

            variableList[variable.name] = parsedValue;
            // body 교체용 값 저장 (바인딩 변수는 기본값 사용)
            bindingVariables[variable.name] = bindingVariables[variable.name]
              ? (bodyReplacementValue as string)
              : (parsedValue as string);
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

        // inputs 참조를 __mod_xxx_params__로 변환
        // 모듈 내부에서 inputs.xxx는 페이지에서 전달한 값에 접근
        const paramsEntityName = `__${instance.instanceId}_params__`;

        transformedBody = transformedBody.replace(
          /\binputs\b/g,
          paramsEntityName,
        );

        // 다른 모듈 내부 엔티티 참조 변환
        // OrgChartJS.xxx -> mod_xxx_OrgChartJS.xxx
        // Member.run() -> mod_xxx_Member.run()
        // Modal1.name -> mod_xxx_Modal1.name
        // 같은 모듈 내의 Actions (Query)
        Object.entries(instance.actions).forEach(([actionName, action]) => {
          const originalName = action.originalName;

          // 이미 변환된 이름(mod_xxx_)은 제외
          const pattern = new RegExp(
            `(?<!mod_[a-zA-Z0-9]+_)\\b${originalName}\\b(?=[.\\[])`,
            "g",
          );

          transformedBody = transformedBody.replace(pattern, actionName);
        });

        // 같은 모듈 내의 다른 JSObjects
        Object.entries(instance.jsObjects).forEach(
          ([otherJsObjName, otherJsObj]) => {
            // 자기 자신은 이미 변환됨 (this. -> jsObjectName.)
            if (otherJsObj.originalName === jsObject.originalName) return;

            const originalName = otherJsObj.originalName;
            const pattern = new RegExp(
              `(?<!mod_[a-zA-Z0-9]+_)\\b${originalName}\\b(?=[.\\[])`,
              "g",
            );

            transformedBody = transformedBody.replace(pattern, otherJsObjName);
          },
        );

        // 모듈 내 위젯 참조 변환
        // Modal1.name -> mod_xxx_Modal1.name
        // Chip.model -> mod_xxx_Chip.model
        Object.entries(widgetNameMapping).forEach(
          ([originalName, transformedName]) => {
            const pattern = new RegExp(
              `(?<!mod_[a-zA-Z0-9]+_)\\b${originalName}\\b(?=[.\\[])`,
              "g",
            );

            transformedBody = transformedBody.replace(pattern, transformedName);
          },
        );

        // 모듈 인스턴스 JSObject의 변수 초기화 표현식을 실제 값으로 교체
        // eval worker가 body를 파싱할 때 바인딩으로 래핑하는 것을 방지
        // 예: "selectedMembers: inputs?.defaultSelected || []" -> "selectedMembers: []"
        // 바인딩 표현식이 있는 변수는 바인딩으로 교체
        for (const [varName, varValue] of Object.entries(variableList)) {
          // 변수 선언 패턴: varName: <expression> (뒤에 , 또는 } 또는 줄바꿈이 올 수 있음)
          const varPattern = new RegExp(
            `(${varName}\\s*:\\s*)([^,}\\n]+)(?=[,}\\n])`,
            "g",
          );

          // 바인딩 변수인 경우 바인딩 표현식 사용, 아니면 JSON.stringify
          const replacement = bindingVariables[varName]
            ? `$1${JSON.stringify(bindingVariables[varName])}`
            : `$1${JSON.stringify(varValue)}`;

          transformedBody = transformedBody.replace(varPattern, replacement);
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
          // {{...}} 형태의 바인딩 문자열 확인 ([\s\S]는 's' 플래그 대체)
          const bindingMatch = value.match(/^\{\{([\s\S]+)\}\}$/);

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
      // ACTION 타입으로 설정하여 바인딩 평가 지원
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataTree as any)[paramsEntityName] = {
        ...parsedInputs,
        ENTITY_TYPE: ENTITY_TYPE.ACTION,
        __moduleInstanceId__: instance.instanceId,
        // ACTION 타입에 필요한 기본 속성
        actionId: `${instance.instanceId}_params`,
        data: undefined,
        isLoading: false,
        run: {},
        clear: {},
        config: {},
        responseMeta: {
          isExecutionSuccess: true,
        },
      };

      // 바인딩 문자열이 있는 input만 dynamicBindingPathList에 추가
      const paramsDynamicBindingPathList: Array<{ key: string }> = [];

      Object.entries(parsedInputs).forEach(([key, value]) => {
        if (
          typeof value === "string" &&
          value.includes("{{") &&
          value.includes("}}")
        ) {
          paramsDynamicBindingPathList.push({ key });
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (configTree as any)[paramsEntityName] = {
        name: paramsEntityName,
        actionId: `${instance.instanceId}_params`,
        pluginType: "MODULE_PARAMS",
        ENTITY_TYPE: ENTITY_TYPE.ACTION,
        bindingPaths: paramsBindingPaths,
        reactivePaths: paramsReactivePaths,
        dependencyMap: {},
        logBlackList: {},
        dynamicBindingPathList: paramsDynamicBindingPathList,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataTree as any)[outputsEntityName] = {
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

    return { dataTree, configTree, widgetDataAugmentation, entityNameMappings };
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
    const { entityNameMappings, widgetDataAugmentation } =
      customModuleInstances;

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
          // 원본 객체를 변경하지 않고 새 객체 생성 (mutation 방지)
          dataTree[entityName] = {
            ...entityAny,
            inputs: augmentation.inputs,
            outputs: augmentation.outputs,
          };

          // configTree에도 binding paths 추가 (새 객체로 생성)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const configEntity = configTree[entityName] as any;

          if (configEntity) {
            const newBindingPaths = { ...configEntity.bindingPaths };
            const newReactivePaths = { ...configEntity.reactivePaths };
            const newDynamicBindingPathList = [
              ...(configEntity.dynamicBindingPathList || []),
            ];

            // inputs의 각 key에 대해 binding path 추가
            Object.entries(augmentation.inputs).forEach(
              ([inputKey, inputValue]) => {
                const path = `inputs.${inputKey}`;

                newBindingPaths[path] = EvaluationSubstitutionType.TEMPLATE;
                newReactivePaths[path] = EvaluationSubstitutionType.TEMPLATE;

                // 바인딩 문자열인 경우 dynamicBindingPathList에 추가
                if (
                  typeof inputValue === "string" &&
                  inputValue.includes("{{") &&
                  inputValue.includes("}}")
                ) {
                  newDynamicBindingPathList.push({ key: path });
                }
              },
            );

            // outputs의 각 key에 대해 binding path 추가
            Object.keys(augmentation.outputs).forEach((outputKey) => {
              const path = `outputs.${outputKey}`;

              newBindingPaths[path] = EvaluationSubstitutionType.TEMPLATE;
              newReactivePaths[path] = EvaluationSubstitutionType.TEMPLATE;
            });

            // 새 configTree 엔티티 생성
            configTree[entityName] = {
              ...configEntity,
              bindingPaths: newBindingPaths,
              reactivePaths: newReactivePaths,
              dynamicBindingPathList: newDynamicBindingPathList,
            };
          }
        }
      }
    });

    // 모듈 내부 위젯의 바인딩 변환 (Deploy 모드에서 위젯 로드 시 필요)
    // 위젯 이름이 mod_xxx_로 시작하면 해당 모듈의 entityNameMapping을 사용해 바인딩 변환
    Object.entries(dataTree).forEach(([entityName, entity]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entityAny = entity as any;

      // 위젯 엔티티가 아니면 건너뛰기
      if (entityAny?.ENTITY_TYPE !== ENTITY_TYPE.WIDGET) return;

      // 모듈 내부 위젯인지 확인 (이름이 mod_로 시작)
      const moduleMatch = entityName.match(/^(mod_[a-zA-Z0-9]+)_/);

      if (!moduleMatch) return;

      const instanceId = moduleMatch[1];
      const entityNameMapping = entityNameMappings[instanceId];

      if (!entityNameMapping || entityNameMapping.size === 0) {
        return;
      }

      // 원본 객체를 변경하지 않고 새 객체 생성 (mutation 방지)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newEntity: any = { ...entityAny };
      let hasChanges = false;

      // Modal 위젯의 name 파생 속성 직접 설정
      // Modal.name은 "{{this.widgetName}}"으로 정의되어 있으나,
      // 모듈 인스턴스에서는 이 바인딩이 평가되기 전에 JS 코드가 접근할 수 있음
      // 따라서 name을 widgetName 값으로 직접 설정하여 showModal() 함수가 올바르게 작동하도록 함
      if (entityAny.type === "MODAL_WIDGET" && entityAny.widgetName) {
        newEntity.name = entityAny.widgetName;
        hasChanges = true;
      }

      // 위젯의 모든 속성을 순회하면서 바인딩 변환
      Object.keys(entityAny).forEach((key) => {
        const value = entityAny[key];

        if (typeof value === "string" && value.includes("{{")) {
          // 바인딩 참조 변환
          let transformed = transformBindingReferences(
            value,
            entityNameMapping,
          ) as string;

          // inputs 참조 변환
          transformed = transformThisParamsBindings(
            transformed,
            instanceId,
          ) as string;

          if (transformed !== value) {
            newEntity[key] = transformed;
            hasChanges = true;
          }
        } else if (typeof value === "object" && value !== null) {
          // 중첩 객체도 처리 (예: primaryColumns, defaultModel 등)
          try {
            const jsonStr = JSON.stringify(value);

            if (jsonStr.includes("{{")) {
              const transformedObj = JSON.parse(
                JSON.stringify(value, (k, v) => {
                  if (typeof v === "string" && v.includes("{{")) {
                    let transformed = transformBindingReferences(
                      v,
                      entityNameMapping,
                    ) as string;

                    transformed = transformThisParamsBindings(
                      transformed,
                      instanceId,
                    ) as string;

                    return transformed;
                  }

                  return v;
                }),
              );

              newEntity[key] = transformedObj;
              hasChanges = true;
            }
          } catch {
            // JSON 변환 실패 시 무시
          }
        }
      });

      // 변경 사항이 있으면 새 엔티티로 교체
      if (hasChanges) {
        dataTree[entityName] = newEntity;
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
