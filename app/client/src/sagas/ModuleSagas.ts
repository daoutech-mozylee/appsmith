import { all, call, put, select, takeLatest } from "redux-saga/effects";
import ModuleApi from "api/ModuleApi";
import { validateResponse } from "sagas/ErrorSagas";
import type { AnyReduxAction, ReduxAction } from "actions/ReduxActionTypes";
import type {
  FetchModulePayload,
  FetchWorkspaceModulesPayload,
  SaveModulePayload,
} from "ee/actions/moduleActions";
import {
  fetchModuleError,
  fetchModuleSuccess,
  fetchWorkspaceModulesError,
  fetchWorkspaceModulesSuccess,
  saveModuleError,
  saveModuleSuccess,
} from "ee/actions/moduleActions";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";
import { generateModuleCanvasPayload } from "pages/ModuleEditor/moduleCanvasUtils";
import {
  initCanvasLayout,
  updateCurrentPage,
  setUrlData,
} from "actions/pageActions";
import {
  fetchPageSuccess,
  fetchAllPageEntityCompletion,
} from "actions/pageActions";
import { executePageLoadActions } from "actions/pluginActionActions";
import { generateAutoHeightLayoutTreeAction } from "actions/autoHeightActions";
import { clearEvalCache } from "sagas/EvaluationsSaga";
import { waitForWidgetConfigBuild } from "sagas/InitSagas";
import {
  buildModuleLayoutsFromCanvas,
  extractModuleMetadata,
} from "utils/moduleHelpers";
import { getCanvasWidgets } from "ee/selectors/entitiesSelector";
import { getModuleEditorModule } from "ee/selectors/modulesSelector";
import { getIsWidgetConfigBuilt } from "selectors/editorSelectors";
import type { ModuleUpdateRequest } from "api/ModuleApi";
import log from "loglevel";
import { APP_MODE } from "entities/App";

function* fetchWorkspaceModulesSaga(
  action: ReduxAction<FetchWorkspaceModulesPayload>,
) {
  const { workspaceId } = action.payload;

  if (!workspaceId) {
    return;
  }

  try {
    const response = yield call(
      ModuleApi.fetchWorkspaceModules,
      workspaceId,
    );
    const isValid: boolean = yield validateResponse(response);

    if (isValid) {
      yield put(fetchWorkspaceModulesSuccess(workspaceId, response.data || []));
    } else {
      yield put(fetchWorkspaceModulesError(workspaceId));
    }
  } catch (error) {
    yield put(fetchWorkspaceModulesError(workspaceId));
  }
}

function* fetchModuleSaga(action: ReduxAction<FetchModulePayload>) {
  const { moduleId } = action.payload;

  if (!moduleId) {
    return;
  }

  try {
    const response = yield call(ModuleApi.fetchModule, moduleId);
    const isValid: boolean = yield validateResponse(response);

    if (isValid) {
      log.debug("ModuleSaga: fetched module", {
        moduleId,
        name:
          response.data.unpublishedModule?.name ||
          response.data.publishedModule?.name,
      });

      try {
        yield put({ type: ReduxActionTypes.SET_APP_MODE, payload: APP_MODE.EDIT });

        const isWidgetConfigBuilt: boolean = yield select(
          getIsWidgetConfigBuilt,
        );
        log.debug("ModuleSaga: widget config built state", {
          isWidgetConfigBuilt,
        });

        const canvasPayload = yield call(
          generateModuleCanvasPayload,
          response.data,
        );
        log.debug("ModuleSaga: generated canvas payload", {
          widgetCount: Object.keys(canvasPayload.widgets || {}).length,
          widgetKeys: Object.keys(canvasPayload.widgets || {}),
          rootId: canvasPayload.pageWidgetId,
        });

        yield put(initCanvasLayout(canvasPayload));
        log.debug("ModuleSaga: initCanvasLayout dispatched");

        yield put({
          type: ReduxActionTypes.FETCH_PAGE_DSL_SUCCESS,
          payload: {
            pageId: moduleId,
            dsl: canvasPayload.dsl,
            layoutId: canvasPayload.currentLayoutId,
          },
        });
        log.debug("ModuleSaga: FETCH_PAGE_DSL_SUCCESS dispatched");

        // Update canvas structure for widget explorer/rendering
        yield put({
          type: ReduxActionTypes.UPDATE_CANVAS_STRUCTURE,
          payload: canvasPayload.dsl,
        });
        log.debug("ModuleSaga: UPDATE_CANVAS_STRUCTURE dispatched");

        // Ensure eval pipeline sees empty action/js lists and proceeds
        yield put({
          type: ReduxActionTypes.FETCH_ACTIONS_FOR_PAGE_SUCCESS,
          payload: [],
        });
        yield put({
          type: ReduxActionTypes.FETCH_JS_ACTIONS_FOR_PAGE_SUCCESS,
          payload: [],
        });

        const moduleName =
          response.data.unpublishedModule?.name ||
          response.data.publishedModule?.name ||
          "Untitled module";

        // Set URL data similar to page load, so evaluation has URL context
        const { location } = window;
        yield put(
          setUrlData({
            fullPath: location.href,
            host: location.host,
            hostname: location.hostname,
            queryParams: {},
            protocol: location.protocol,
            pathname: location.pathname,
            port: location.port,
            hash: location.hash,
          }),
        );

        // Populate a minimal page list entry so editor selectors work
        yield put({
          type: ReduxActionTypes.FETCH_PAGE_LIST_SUCCESS,
          payload: {
            pages: [
              {
                pageId: moduleId,
                basePageId: moduleId,
                name: moduleName,
                slug: moduleId,
                isDefault: true,
                isHidden: false,
                layouts: [
                  {
                    id: canvasPayload.currentLayoutId,
                    dsl: canvasPayload.dsl,
                    layoutOnLoadActions: canvasPayload.pageActions,
                    layoutActions: [],
                    layoutOnLoadActionErrors:
                      canvasPayload.layoutOnLoadActionErrors,
                  },
                ],
                userPermissions: [],
              },
            ],
            applicationId: response.data.packageId || "",
            baseApplicationId: response.data.packageId || "",
          },
        });

        yield put(updateCurrentPage(moduleId, moduleName));

        yield put(fetchModuleSuccess(moduleId, response.data, canvasPayload));
        log.debug("ModuleSaga: fetchModuleSuccess dispatched");

        yield put(generateAutoHeightLayoutTreeAction(true, true));
        yield put(fetchPageSuccess());
        // Seed meta after FETCH_PAGE_SUCCESS (meta reducer resets on fetchPageSuccess)
        const widgetIds = Object.keys(canvasPayload.widgets || {});
        if (widgetIds.length) {
          yield put({
            type: ReduxActionTypes.RESET_WIDGETS_META_STATE,
            payload: { widgetIdsToClear: widgetIds },
          });

          const batchMetaUpdates = widgetIds
            .map((id) => {
              const widget = canvasPayload.widgets[id];
              if (!widget) return undefined;

              if (widget.type === "BUTTON_WIDGET") {
                return {
                  widgetId: id,
                  propertyName: "isLoading",
                  propertyValue: false,
                };
              }
              if (widget.type === "MODAL_WIDGET") {
                return {
                  widgetId: id,
                  propertyName: "isVisible",
                  propertyValue: false,
                };
              }

              return undefined;
            })
            .filter(Boolean);

          if (batchMetaUpdates.length) {
            yield put({
              type: ReduxActionTypes.BATCH_UPDATE_META_PROPS,
              payload: { batchMetaUpdates },
            });
          }
          log.debug("ModuleSaga: seeded widget meta", {
            metaUpdates: batchMetaUpdates,
          });
        }

        yield put(
          fetchAllPageEntityCompletion([
            executePageLoadActions(),
          ] as AnyReduxAction[]),
        );
        yield put({ type: ReduxActionTypes.INITIALIZE_EDITOR_SUCCESS });
      } catch (processingError) {
        log.error("ModuleSaga: processing failed", processingError);
        yield put(fetchModuleError(moduleId));
      }
    } else {
      log.error("ModuleSaga: module fetch invalid response", { moduleId });
      yield put(fetchModuleError(moduleId));
    }
  } catch (error) {
    log.error("ModuleSaga: module fetch failed", { moduleId, error });
    yield put(fetchModuleError(moduleId));
  }
}

function* saveModuleSaga(action: ReduxAction<SaveModulePayload>) {
  const { data, moduleId, onError, onSuccess } = action.payload;

  const moduleData = yield select(getModuleEditorModule);
  const canvasWidgets = yield select(getCanvasWidgets);

  if (!moduleData || !canvasWidgets) {
    if (onError) {
      onError("MODULE_DATA_UNAVAILABLE");
    }
    yield put(saveModuleError(moduleId));
    return;
  }

  const layouts = buildModuleLayoutsFromCanvas(canvasWidgets, moduleData);
  const metadata = extractModuleMetadata(moduleData);

  const overrides = data?.unpublishedModule || {};

  const updatePayload: ModuleUpdateRequest = {
    unpublishedModule: {
      ...metadata,
      ...overrides,
      layouts,
    },
  };

  try {
    const response = yield call(ModuleApi.updateModule, moduleId, updatePayload);
    const isValid: boolean = yield validateResponse(response);

    if (isValid) {
      yield put(saveModuleSuccess(moduleId, response.data));
      if (onSuccess) {
        onSuccess();
      }
    } else {
      yield put(saveModuleError(moduleId));
      if (onError) {
        onError();
      }
    }
  } catch (error) {
    yield put(saveModuleError(moduleId));
    if (onError) {
      onError();
    }
  }
}

export default function* moduleSagas() {
  yield all([
    takeLatest(
      ReduxActionTypes.FETCH_WORKSPACE_MODULES_INIT,
      fetchWorkspaceModulesSaga,
    ),
    takeLatest(ReduxActionTypes.FETCH_MODULE_INIT, fetchModuleSaga),
    takeLatest(ReduxActionTypes.SAVE_MODULE_INIT, saveModuleSaga),
  ]);
}
