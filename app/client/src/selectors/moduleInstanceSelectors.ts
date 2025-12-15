/**
 * Module Instance Selectors
 *
 * 모듈 인스턴스 상태를 조회하기 위한 selector들
 */
import type { DefaultRootState } from "react-redux";
import type {
  ModuleInstancesState,
  ModuleInstance,
  ModuleInstanceAction,
  ModuleActionData,
} from "reducers/entityReducers/moduleInstancesReducer";

// 전체 모듈 인스턴스 상태 조회
export const getModuleInstances = (
  state: DefaultRootState,
): ModuleInstancesState => {
  return state.entities.moduleInstances || {};
};

// 특정 인스턴스 조회
export const getModuleInstanceById = (
  state: DefaultRootState,
  instanceId: string,
): ModuleInstance | undefined => {
  return getModuleInstances(state)[instanceId];
};

// 위젯 ID로 모듈 인스턴스 조회
export const getModuleInstanceByWidgetId = (
  state: DefaultRootState,
  widgetId: string,
): ModuleInstance | undefined => {
  const instances = getModuleInstances(state);

  return Object.values(instances).find(
    (instance) => instance.widgetId === widgetId,
  );
};

// 특정 인스턴스의 Action 조회
export const getModuleInstanceAction = (
  state: DefaultRootState,
  instanceId: string,
  actionName: string,
): ModuleInstanceAction | undefined => {
  const instance = getModuleInstanceById(state, instanceId);

  return instance?.actions[actionName];
};

// 특정 인스턴스의 Action 실행 데이터 조회
export const getModuleInstanceActionData = (
  state: DefaultRootState,
  instanceId: string,
  actionName: string,
): ModuleActionData | undefined => {
  const instance = getModuleInstanceById(state, instanceId);

  return instance?.actionData[actionName];
};

// 특정 인스턴스의 executeOnLoad Action들 조회
export const getModuleInstanceExecuteOnLoadActions = (
  state: DefaultRootState,
  instanceId: string,
): ModuleInstanceAction[] => {
  const instance = getModuleInstanceById(state, instanceId);

  if (!instance) return [];

  return Object.values(instance.actions).filter(
    (action) => action.executeOnLoad,
  );
};

// 현재 페이지의 모든 모듈 인스턴스 조회
export const getModuleInstancesByPageId = (
  state: DefaultRootState,
  pageId: string,
): ModuleInstance[] => {
  const instances = getModuleInstances(state);

  return Object.values(instances).filter(
    (instance) => instance.pageId === pageId,
  );
};
