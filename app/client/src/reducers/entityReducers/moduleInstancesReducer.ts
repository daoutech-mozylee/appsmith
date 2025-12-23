/**
 * Module Instances Reducer
 *
 * 모듈 인스턴스의 독립적인 상태를 관리합니다.
 * - 각 모듈 인스턴스는 자체 Actions, JSObjects, 실행 데이터를 가짐
 * - 페이지의 일반 Actions와 분리되어 캡슐화 유지
 */
import { createImmerReducer } from "utils/ReducerUtils";
import type { ReduxAction } from "actions/ReduxActionTypes";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";
import type {
  ModuleInputSection,
  ModuleOutputSection,
  ModuleInstanceInputs,
  ModuleInstanceOutputs,
} from "constants/PackageModuleConstants";

// 모듈 Action 정의
export interface ModuleInstanceAction {
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
  // 런타임 체크를 위해 원본 runBehaviour 저장
  runBehaviour?: string;
}

// 모듈 JSObject 정의
export interface ModuleInstanceJSObject {
  name: string;
  originalName: string;
  body: string;
  variables?: unknown[];
  // 개별 함수의 runBehaviour 정보
  functions?: {
    [functionName: string]: {
      name: string;
      originalName: string;
      runBehaviour?: string;
    };
  };
}

// Action 실행 데이터
export interface ModuleActionData {
  isLoading: boolean;
  data?: unknown;
  error?: string;
}

// 모듈 인스턴스 상태
export interface ModuleInstance {
  instanceId: string;
  moduleId: string;
  moduleName: string;
  packageName: string;
  widgetId: string;
  pageId: string;
  // 모듈 내부 Actions (DB 쿼리 등)
  actions: {
    [actionName: string]: ModuleInstanceAction;
  };
  // 모듈 내부 JSObjects
  jsObjects: {
    [jsObjectName: string]: ModuleInstanceJSObject;
  };
  // Action 실행 결과 데이터
  actionData: {
    [actionName: string]: ModuleActionData;
  };
  // JSObject 실행 결과 데이터
  jsData: {
    [jsObjectName: string]: {
      [functionName: string]: {
        isLoading: boolean;
        data?: unknown;
        error?: string;
      };
    };
  };
  // Input/Output 정의 (모듈 설정에서 가져옴)
  inputsForm?: ModuleInputSection[];
  outputsForm?: ModuleOutputSection[];
  // 런타임 Input/Output 값
  inputs: ModuleInstanceInputs;
  outputs: ModuleInstanceOutputs;
}

// 전체 상태 타입
export interface ModuleInstancesState {
  [instanceId: string]: ModuleInstance;
}

const initialState: ModuleInstancesState = {};

// 모듈 인스턴스 등록 페이로드
export interface RegisterModuleInstancePayload {
  instanceId: string;
  moduleId: string;
  moduleName: string;
  packageName: string;
  widgetId: string;
  pageId: string;
  actions: ModuleInstanceAction[];
  jsObjects: ModuleInstanceJSObject[];
  // Input/Output 정의
  inputsForm?: ModuleInputSection[];
  outputsForm?: ModuleOutputSection[];
  // 초기 Input 값 (위젯 props에서 전달)
  initialInputs?: ModuleInstanceInputs;
}

// Input 업데이트 페이로드
export interface UpdateModuleInstanceInputPayload {
  instanceId: string;
  inputName: string;
  value: unknown;
}

// Output 업데이트 페이로드
export interface UpdateModuleInstanceOutputPayload {
  instanceId: string;
  outputs: ModuleInstanceOutputs;
}

// Action 실행 페이로드
export interface ExecuteModuleActionPayload {
  instanceId: string;
  actionName: string;
  params?: Record<string, unknown>;
}

// Action 실행 성공 페이로드
export interface ExecuteModuleActionSuccessPayload {
  instanceId: string;
  actionName: string;
  data: unknown;
}

// Action 실행 에러 페이로드
export interface ExecuteModuleActionErrorPayload {
  instanceId: string;
  actionName: string;
  error: string;
}

export const handlers = {
  // 모듈 인스턴스 등록
  [ReduxActionTypes.REGISTER_MODULE_INSTANCE]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<RegisterModuleInstancePayload>,
  ) => {
    const {
      actions,
      initialInputs,
      inputsForm,
      instanceId,
      jsObjects,
      moduleId,
      moduleName,
      outputsForm,
      packageName,
      pageId,
      widgetId,
    } = action.payload;

    // actions 배열을 객체로 변환
    const actionsMap: { [actionName: string]: ModuleInstanceAction } = {};

    for (const act of actions) {
      actionsMap[act.name] = act;
    }

    // jsObjects 배열을 객체로 변환
    const jsObjectsMap: { [jsObjectName: string]: ModuleInstanceJSObject } = {};

    for (const jsObj of jsObjects) {
      jsObjectsMap[jsObj.name] = jsObj;
    }

    // inputsForm에서 defaultValue로 초기 inputs 설정
    const inputs: ModuleInstanceInputs = {};

    if (inputsForm) {
      for (const section of inputsForm) {
        for (const input of section.children) {
          // input 이름은 label 또는 name 필드 사용 (JSON 구조에 따라 다름)
          const inputName = input.label || input.name;

          if (inputName) {
            // initialInputs에 값이 있으면 사용, 없으면 defaultValue
            inputs[inputName] =
              initialInputs?.[inputName] ?? input.defaultValue;
          }
        }
      }
    }

    // initialInputs가 있으면 merge (정의되지 않은 input도 처리)
    if (initialInputs) {
      Object.assign(inputs, initialInputs);
    }

    draftState[instanceId] = {
      instanceId,
      moduleId,
      moduleName,
      packageName,
      widgetId,
      pageId,
      actions: actionsMap,
      jsObjects: jsObjectsMap,
      actionData: {},
      jsData: {},
      inputsForm,
      outputsForm,
      inputs,
      outputs: {},
    };
  },

  // 모듈 인스턴스 해제 (위젯 삭제 시)
  [ReduxActionTypes.UNREGISTER_MODULE_INSTANCE]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<{ instanceId: string }>,
  ) => {
    const { instanceId } = action.payload;

    delete draftState[instanceId];
  },

  // 모듈 Action 실행 시작
  [ReduxActionTypes.EXECUTE_MODULE_ACTION_INIT]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<ExecuteModuleActionPayload>,
  ) => {
    const { actionName, instanceId } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      if (!instance.actionData[actionName]) {
        instance.actionData[actionName] = { isLoading: false };
      }

      instance.actionData[actionName].isLoading = true;
      instance.actionData[actionName].error = undefined;
    }
  },

  // 모듈 Action 실행 성공
  [ReduxActionTypes.EXECUTE_MODULE_ACTION_SUCCESS]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<ExecuteModuleActionSuccessPayload>,
  ) => {
    const { actionName, data, instanceId } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      instance.actionData[actionName] = {
        isLoading: false,
        data,
        error: undefined,
      };
    }
  },

  // 모듈 Action 실행 에러
  [ReduxActionTypes.EXECUTE_MODULE_ACTION_ERROR]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<ExecuteModuleActionErrorPayload>,
  ) => {
    const { actionName, error, instanceId } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      instance.actionData[actionName] = {
        isLoading: false,
        data: undefined,
        error,
      };
    }
  },

  // JS 함수 실행 시작
  [ReduxActionTypes.EXECUTE_MODULE_JS_FUNCTION_INIT]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<{
      instanceId: string;
      jsObjectName: string;
      functionName: string;
    }>,
  ) => {
    const { functionName, instanceId, jsObjectName } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      if (!instance.jsData[jsObjectName]) {
        instance.jsData[jsObjectName] = {};
      }

      instance.jsData[jsObjectName][functionName] = {
        isLoading: true,
        data: undefined,
        error: undefined,
      };
    }
  },

  // JS 함수 실행 성공
  [ReduxActionTypes.EXECUTE_MODULE_JS_FUNCTION_SUCCESS]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<{
      instanceId: string;
      jsObjectName: string;
      functionName: string;
      data: unknown;
    }>,
  ) => {
    const { data, functionName, instanceId, jsObjectName } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      if (!instance.jsData[jsObjectName]) {
        instance.jsData[jsObjectName] = {};
      }

      instance.jsData[jsObjectName][functionName] = {
        isLoading: false,
        data,
        error: undefined,
      };
    }
  },

  // JS 함수 실행 에러
  [ReduxActionTypes.EXECUTE_MODULE_JS_FUNCTION_ERROR]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<{
      instanceId: string;
      jsObjectName: string;
      functionName: string;
      error: string;
    }>,
  ) => {
    const { error, functionName, instanceId, jsObjectName } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      if (!instance.jsData[jsObjectName]) {
        instance.jsData[jsObjectName] = {};
      }

      instance.jsData[jsObjectName][functionName] = {
        isLoading: false,
        data: undefined,
        error,
      };
    }
  },

  // 모듈 인스턴스 데이터 업데이트 (수동)
  [ReduxActionTypes.UPDATE_MODULE_INSTANCE_DATA]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<{
      instanceId: string;
      actionName: string;
      data: unknown;
    }>,
  ) => {
    const { actionName, data, instanceId } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      instance.actionData[actionName] = {
        isLoading: false,
        data,
      };
    }
  },

  // 모듈 인스턴스 데이터 클리어
  [ReduxActionTypes.CLEAR_MODULE_INSTANCE_DATA]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<{ instanceId: string }>,
  ) => {
    const { instanceId } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      instance.actionData = {};
      instance.jsData = {};
    }
  },

  // 페이지 전환 시 모든 모듈 인스턴스 클리어
  [ReduxActionTypes.SWITCH_CURRENT_PAGE_ID]: (
    draftState: ModuleInstancesState,
  ) => {
    // 현재 페이지의 모듈 인스턴스들의 실행 데이터만 클리어
    // 인스턴스 자체는 유지 (위젯이 다시 렌더링될 때 복구)
    for (const instanceId in draftState) {
      draftState[instanceId].actionData = {};
      draftState[instanceId].jsData = {};
    }
  },

  // 에디터 리셋 시 모든 모듈 인스턴스 제거
  [ReduxActionTypes.RESET_EDITOR_REQUEST]: () => {
    return {};
  },

  // 모듈 인스턴스 Input 업데이트
  [ReduxActionTypes.UPDATE_MODULE_INSTANCE_INPUT]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<UpdateModuleInstanceInputPayload>,
  ) => {
    const { inputName, instanceId, value } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      instance.inputs[inputName] = value;
    }
  },

  // 모듈 인스턴스 Inputs 일괄 업데이트
  [ReduxActionTypes.UPDATE_MODULE_INSTANCE_INPUTS]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<{
      instanceId: string;
      inputs: ModuleInstanceInputs;
    }>,
  ) => {
    const { inputs, instanceId } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      instance.inputs = {
        ...instance.inputs,
        ...inputs,
      };
    }
  },

  // 모듈 인스턴스 Outputs 업데이트 (평가 사이클에서 호출)
  [ReduxActionTypes.UPDATE_MODULE_INSTANCE_OUTPUTS]: (
    draftState: ModuleInstancesState,
    action: ReduxAction<UpdateModuleInstanceOutputPayload>,
  ) => {
    const { instanceId, outputs } = action.payload;
    const instance = draftState[instanceId];

    if (instance) {
      instance.outputs = outputs;
    }
  },
};

const moduleInstancesReducer = createImmerReducer(initialState, handlers);

export default moduleInstancesReducer;
