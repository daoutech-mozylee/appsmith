import { reduxBatch } from "@manaflair/redux-batch";
import { createStore, applyMiddleware, compose } from "redux";
import type { DefaultRootState } from "react-redux";
import appReducer from "ee/reducers";
import createSagaMiddleware from "redux-saga";
import { rootSaga } from "ee/sagas";
import { composeWithDevTools } from "redux-devtools-extension/logOnlyInProduction";
import * as Sentry from "@sentry/react";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";
import routeParamsMiddleware from "ee/middlewares/RouteParamsMiddleware";
import packageMiddleware from "ee/middlewares/PackageMiddleware";

const sagaMiddleware = createSagaMiddleware();
const ignoredSentryActionTypes = [
  ReduxActionTypes.SET_EVALUATED_TREE,
  ReduxActionTypes.EXECUTE_PLUGIN_ACTION_SUCCESS,
  ReduxActionTypes.SET_LINT_ERRORS,
];
const sentryReduxEnhancer = Sentry.createReduxEnhancer({
  actionTransformer: (action) => {
    if (ignoredSentryActionTypes.includes(action.type)) {
      // Return null to not log the action to Sentry
      action.payload = null;
    }

    return action;
  },
});

const store = createStore(
  appReducer,
  composeWithDevTools(
    reduxBatch,
    applyMiddleware(packageMiddleware, sagaMiddleware, routeParamsMiddleware),
    reduxBatch,
    sentryReduxEnhancer,
  ),
);

// 개발 환경에서 window.store로 접근 가능하도록 노출
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).store = store;
}

export default store;

export const testStore = (initialState: Partial<DefaultRootState>) =>
  createStore(
    appReducer,
    initialState,
    compose(
      reduxBatch,
      applyMiddleware(sagaMiddleware, routeParamsMiddleware),
      reduxBatch,
    ),
  );

// We don't want to run the saga middleware in tests, so exporting it from here
// And running it only when the app runs
export const runSagaMiddleware = () => sagaMiddleware.run(rootSaga);
