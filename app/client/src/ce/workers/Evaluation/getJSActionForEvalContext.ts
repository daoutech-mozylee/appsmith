import type {
  JSActionEntity,
  JSActionEntityConfig,
} from "ee/entities/DataTree/types";
import type { DataTreeEntity } from "entities/DataTree/dataTreeTypes";
import JSObjectCollection from "workers/Evaluation/JSObject/Collection";
import { jsObjectFunctionFactory } from "workers/Evaluation/fns/utils/jsObjectFnFactory";
import { dataTreeEvaluator } from "workers/Evaluation/handlers/evalTree";

function getJSFunctionsForEntity({
  jsObject,
  jsObjectName,
}: {
  jsObjectName: string;
  jsObject: JSActionEntity;
}) {
  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsObjectFunction: Record<string, any> = {};
  const resolvedFunctions = JSObjectCollection.getResolvedFunctions();
  const resolvedObject = Object.assign({}, resolvedFunctions[jsObjectName]);

  for (const fnName of Object.keys(resolvedObject || {})) {
    const fn = resolvedObject[fnName];

    if (typeof fn !== "function") continue;

    const data = jsObject[fnName]?.data;

    jsObjectFunction[fnName] = jsObjectFunctionFactory(
      fn,
      jsObjectName + "." + fnName,
    );

    if (!!data) {
      jsObjectFunction[fnName]["data"] = data;
    }
  }

  return jsObjectFunction;
}

export function getJSActionForEvalContext(
  entityName: string,
  entity: DataTreeEntity,
) {
  const jsObjectName = entityName;
  const jsObject = entity as JSActionEntity;

  let jsObjectForEval = JSObjectCollection.getVariableState(entityName);

  const fns = getJSFunctionsForEntity({
    jsObjectName,
    jsObject,
  });

  // variableState가 없거나 빈 객체인 경우 초기화 필요
  const needsInit =
    !jsObjectForEval || Object.keys(jsObjectForEval).length === 0;

  if (needsInit) {
    // variableState가 없으면 configTree에서 변수 목록을 가져와서 초기화
    // 모듈 인스턴스 JSObject의 경우 이 초기화가 필요함
    const configTree = dataTreeEvaluator?.getConfigTree();

    if (configTree) {
      const entityConfig = configTree[entityName] as
        | JSActionEntityConfig
        | undefined;
      const variables = entityConfig?.variables || [];

      if (variables.length > 0) {
        // jsObject에서 변수 값을 가져와서 variableState에 등록
        // 초기화 시에는 setVariableValue 대신 직접 초기화하여 불필요한 이벤트 방지
        JSObjectCollection.initVariableState(
          entityName,
          variables.reduce(
            (acc: Record<string, unknown>, varName: string) => {
              acc[varName] = jsObject[varName];

              return acc;
            },
            {} as Record<string, unknown>,
          ),
        );

        // 초기화 후 다시 가져오기
        jsObjectForEval = JSObjectCollection.getVariableState(entityName);
      }
    }

    // 여전히 없으면 기본 동작 (getter/setter 없음)
    if (!jsObjectForEval || Object.keys(jsObjectForEval).length === 0) {
      return Object.assign({}, jsObject, fns);
    }
  }

  jsObjectForEval =
    JSObjectCollection.getVariablesForEvaluationContext(entityName);

  return Object.assign(jsObjectForEval, fns);
}
