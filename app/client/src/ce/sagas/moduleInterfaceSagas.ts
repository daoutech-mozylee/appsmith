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
import ModuleApi from "api/ModuleApi";
import type {
  ModuleInstanceResponse,
  ModulePackageResponse,
  UiModuleResponse,
} from "api/ModuleApi";
import type { ApiResponse } from "api/ApiResponses";
import type { CanvasWidgetsReduxState } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import { getCurrentPageId } from "selectors/editorSelectors";
import { getCurrentWorkspaceId } from "ee/selectors/selectedWorkspaceSelectors";
import { call, select } from "redux-saga/effects";
import { validateResponse } from "sagas/ErrorSagas";
import { getLogToSentryFromResponse } from "utils/helpers";
import WidgetFactory from "WidgetProvider/factory";
import log from "loglevel";
import { buildBoardModuleApiPayload } from "widgets/BoardWidget/moduleBuilder";
import type { Saga } from "redux-saga";

export interface HandleModuleWidgetCreationSagaPayload {
  addChildPayload: WidgetAddChild;
  widgets: CanvasWidgetsReduxState;
}

const WidgetTypes = WidgetFactory.widgetTypes;

export function* handleModuleWidgetCreationSaga(
  props: HandleModuleWidgetCreationSagaPayload,
) {
  const widget = props.widgets[props.addChildPayload.newWidgetId];

  if (
    !widget ||
    (widget.type !== WidgetTypes.BOARD_MODAL_WIDGET &&
      widget.type !== WidgetTypes.MODULE_INSTANCE_WIDGET)
  ) {
    return props.widgets;
  }

  const dropProps = props.addChildPayload.props || {};

  const workspaceId: string = yield select(getCurrentWorkspaceId);
  const pageId: string = yield select(getCurrentPageId);

  if (!workspaceId || !pageId) {
    return props.widgets;
  }

  const existingModuleId: string | undefined = dropProps.moduleId;
  const existingModulePackageId: string | undefined = dropProps.modulePackageId;
  const isModulePlaceholder =
    widget.type === WidgetTypes.MODULE_INSTANCE_WIDGET;

  try {
    if (isModulePlaceholder) {
      if (!existingModuleId) {
        return props.widgets;
      }

      const instanceResponse: ApiResponse<ModuleInstanceResponse> =
        yield ModuleApi.createModuleInstance({
          sourceModuleId: existingModuleId,
          contextId: pageId,
          contextType: "PAGE",
          name:
            dropProps.moduleInstanceName ||
            dropProps.moduleName ||
            widget.widgetName,
          widgetId: widget.widgetId,
        });

      const instanceValid: boolean = yield validateResponse(
        instanceResponse,
        false,
        getLogToSentryFromResponse(instanceResponse),
      );

      if (!instanceValid || !instanceResponse.data?.id) {
        return props.widgets;
      }

      props.widgets[widget.widgetId] = {
        ...props.widgets[widget.widgetId],
        modulePackageId:
          existingModulePackageId || props.widgets[widget.widgetId].modulePackageId,
        moduleId: existingModuleId,
        moduleInstanceId: instanceResponse.data.id,
        moduleName: dropProps.moduleName || widget.widgetName,
        moduleDescription: dropProps.moduleDescription,
      };

      return props.widgets;
    }

    const apiPayloads = buildBoardModuleApiPayload({
      workspaceId,
      pageId,
      widgetId: widget.widgetId,
      widgetName: widget.widgetName,
    });

    const packageResponse: ApiResponse<ModulePackageResponse> =
      yield ModuleApi.createModulePackage(apiPayloads.packagePayload);

    const packageValid: boolean = yield validateResponse(
      packageResponse,
      false,
      getLogToSentryFromResponse(packageResponse),
    );

    if (!packageValid || !packageResponse.data?.id) {
      return props.widgets;
    }

    const moduleResponse: ApiResponse<UiModuleResponse> =
      yield ModuleApi.createModule({
        ...apiPayloads.modulePayload,
        packageId: packageResponse.data.id,
      });

    const moduleValid: boolean = yield validateResponse(
      moduleResponse,
      false,
      getLogToSentryFromResponse(moduleResponse),
    );

    if (!moduleValid || !moduleResponse.data?.id) {
      return props.widgets;
    }

    const instanceResponse: ApiResponse<ModuleInstanceResponse> =
      yield ModuleApi.createModuleInstance({
        ...apiPayloads.instancePayload,
        sourceModuleId: moduleResponse.data.id,
      });

    const instanceValid: boolean = yield validateResponse(
      instanceResponse,
      false,
      getLogToSentryFromResponse(instanceResponse),
    );

    if (!instanceValid || !instanceResponse.data?.id) {
      return props.widgets;
    }

    props.widgets[widget.widgetId] = {
      ...props.widgets[widget.widgetId],
      modulePackageId: packageResponse.data.id,
      moduleId: moduleResponse.data.id,
      moduleInstanceId: instanceResponse.data.id,
    };
  } catch (error) {
    log.error("Failed to create Board module bundle", error);
  }

  return props.widgets;
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
