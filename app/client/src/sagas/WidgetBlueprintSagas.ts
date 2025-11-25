import type { ActionData } from "ee/reducers/entityReducers/actionsReducer";
import {
  BlueprintOperationActionTypes,
  type WidgetBlueprint,
} from "WidgetProvider/types";
import type { FlattenedWidgetProps } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import type { WidgetProps } from "widgets/BaseWidget";
import { generateReactKey } from "utils/generators";
import { call, put, select, take } from "redux-saga/effects";
import { get } from "lodash";
import WidgetFactory from "WidgetProvider/factory";

import type { WidgetType } from "constants/WidgetConstants";
import { MAIN_CONTAINER_WIDGET_ID } from "constants/WidgetConstants";
import { BlueprintOperationTypes } from "WidgetProvider/types";
import * as log from "loglevel";
import { toast } from "@appsmith/ads";
import type { LayoutSystemTypes } from "layoutSystems/types";
import { getLayoutSystemType } from "selectors/layoutSystemSelectors";
import { PluginPackageName, type Plugin } from "entities/Plugin";
import type { Action } from "../entities/Action";
import { createOrUpdateDataSourceWithAction } from "../ee/sagas/DatasourcesSagas";
import { createJSCollectionRequest } from "actions/jsActionActions";
import type { JSAction, JSCollection, Variable } from "entities/JSCollection";
import type { CreateJSCollectionRequest } from "ee/api/JSActionAPI";
import { getCurrentWorkspaceId } from "ee/selectors/selectedWorkspaceSelectors";
import {
  getCurrentApplicationId,
  getCurrentPageId,
} from "selectors/editorSelectors";
import { getPluginByPackageName } from "ee/selectors/entitiesSelector";
import type { ReduxAction } from "actions/ReduxActionTypes";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";

function buildView(view: WidgetBlueprint["view"], widgetId: string) {
  const children = [];

  if (view) {
    for (const template of view) {
      //TODO(abhinav): Can we keep rows and size mandatory?
      try {
        const { widgetName, ...restProps } = template.props || {};
        children.push({
          widgetId,
          type: template.type,
          leftColumn: template.position.left || 0,
          topRow: template.position.top || 0,
          columns: template.size && template.size.cols,
          rows: template.size && template.size.rows,
          newWidgetId: generateReactKey(),
          widgetName,
          props: restProps,
        });
      } catch (e) {
        log.error(e);
      }
    }
  }

  return children;
}

export function* buildWidgetBlueprint(
  blueprint: WidgetBlueprint,
  widgetId: string,
) {
  const widgetProps: Record<string, unknown> = yield call(
    buildView,
    blueprint.view,
    widgetId,
  );

  return widgetProps;
}

export interface UpdatePropertyArgs {
  widgetId: string;
  propertyName: string;
  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  propertyValue: any;
}
export type BlueprintOperationAddActionFn = (
  widget: WidgetProps & { children?: WidgetProps[] },
) => Generator;
export type BlueprintOperationModifyPropsFn = (
  widget: WidgetProps & { children?: WidgetProps[] },
  widgets: { [widgetId: string]: FlattenedWidgetProps },
  parent?: WidgetProps,
  layoutSystemType?: LayoutSystemTypes,
  addActionResult?: ActionData,
) => UpdatePropertyArgs[] | undefined;

export interface ChildOperationFnResponse {
  widgets: Record<string, FlattenedWidgetProps>;
  message?: string;
}

export type BlueprintOperationChildOperationsFn = (
  widgets: { [widgetId: string]: FlattenedWidgetProps },
  widgetId: string,
  parentId: string,
  widgetPropertyMaps: {
    defaultPropertyMap: Record<string, string>;
  },
  layoutSystemType: LayoutSystemTypes,
) => ChildOperationFnResponse;

export type BlueprintBeforeOperationsFn = (
  widgets: { [widgetId: string]: FlattenedWidgetProps },
  widgetId: string,
  parentId: string,
  layoutSystemType: LayoutSystemTypes,
) => void;

export type BlueprintOperationFunction =
  | BlueprintOperationModifyPropsFn
  | BlueprintOperationAddActionFn
  | BlueprintOperationChildOperationsFn
  | BlueprintBeforeOperationsFn;

export type BlueprintOperationType = keyof typeof BlueprintOperationTypes;
export type BlueprintOperationActionType =
  keyof typeof BlueprintOperationActionTypes;

export interface BlueprintJSActionTemplate {
  name: string;
  body: string;
  actions?: Array<Partial<JSAction>>;
  variables?: Array<Variable>;
}

export interface BlueprintOperationActionPayload {
  pluginPackageName?: PluginPackageName;
  actionConfig?: Action;
  datasourceName?: string;
  jsActionTemplate?: BlueprintJSActionTemplate;
}

export interface BlueprintOperation {
  type: BlueprintOperationType;
  fn: BlueprintOperationFunction;
  actionType?: BlueprintOperationActionType;
  payload?: BlueprintOperationActionPayload;
}

export function* executeWidgetBlueprintOperations(
  operations: BlueprintOperation[],
  widgets: { [widgetId: string]: FlattenedWidgetProps },
  widgetId: string,
) {
  const layoutSystemType: LayoutSystemTypes = yield select(getLayoutSystemType);
  let addActionResult: ActionData | JSCollection | undefined = undefined;

  for (const operation of operations) {
    const widget: WidgetProps & { children?: string[] | WidgetProps[] } = {
      ...widgets[widgetId],
    };

    switch (operation.type) {
      case BlueprintOperationTypes.ADD_ACTION:
        addActionResult =
          yield executeWidgetBlueprintAddActionOperations(operation);

        break;
      case BlueprintOperationTypes.MODIFY_PROPS:
        if (widget.children && widget.children.length > 0) {
          widget.children = (widget.children as string[]).map(
            (childId: string) => widgets[childId],
          ) as WidgetProps[];
        }

        const updatePropertyPayloads: UpdatePropertyArgs[] | undefined = (
          operation.fn as BlueprintOperationModifyPropsFn
        )(
          widget as WidgetProps & { children?: WidgetProps[] },
          widgets,
          get(widgets, widget.parentId || "", undefined),
          layoutSystemType,
          addActionResult,
        );

        updatePropertyPayloads &&
          updatePropertyPayloads.forEach((params: UpdatePropertyArgs) => {
            widgets[params.widgetId][params.propertyName] =
              params.propertyValue;
          });
        break;
    }
  }

  const result: { [widgetId: string]: FlattenedWidgetProps } = yield widgets;

  return result;
}

/**
 * this saga executes the blueprint add action operation
 * @param operation
 */
function* executeWidgetBlueprintAddActionOperations(
  operation: BlueprintOperation,
) {
  switch (operation.actionType) {
    case BlueprintOperationActionTypes.CREATE_OR_UPDATE_DATASOURCE_WITH_ACTION:
      if (
        !operation.payload?.pluginPackageName ||
        !operation.payload?.actionConfig
      )
        return;

      const { actionConfig, datasourceName, pluginPackageName } =
        operation.payload;

      // TODO Add the event to the watcher to avoid importing it and the associated cyclic dependencies.
      // https://github.com/appsmithorg/appsmith-ee/pull/5368#discussion_r1804419760
      const createdAction: ActionData =
        yield createOrUpdateDataSourceWithAction(
          pluginPackageName,
          actionConfig,
          datasourceName,
        );

      return createdAction;
    case BlueprintOperationActionTypes.CREATE_JS_ACTION:
      if (!operation.payload?.jsActionTemplate) {
        return;
      }

      const jsAction = yield createJSCollectionForBlueprint(
        operation.payload.jsActionTemplate,
      );

      return jsAction;
  }
}

function* createJSCollectionForBlueprint(
  jsTemplate: BlueprintJSActionTemplate,
) {
  if (!jsTemplate.name || !jsTemplate.body) {
    log.error("JS blueprint template is missing required fields");
    return;
  }

  const plugin: Plugin = yield select(
    getPluginByPackageName,
    PluginPackageName.JS,
  );

  if (!plugin) {
    log.error("JS plugin not available for blueprint creation");
    return;
  }

  const workspaceId: string = yield select(getCurrentWorkspaceId);
  const applicationId: string = yield select(getCurrentApplicationId);
  const pageId: string = yield select(getCurrentPageId);

  const sanitizedActions =
    jsTemplate.actions?.map((action) => {
      const {
        id: _id,
        baseId: _baseId,
        collectionId: _collectionId,
        pluginId: _pluginId,
        pluginType: _pluginType,
        workspaceId: _workspaceId,
        applicationId: _applicationId,
        pageId: _pageId,
        ...rest
      } = action;

      return {
        ...rest,
        pluginId: plugin.id,
        pluginType: plugin.type,
        workspaceId,
        applicationId,
        pageId,
      };
    }) || [];

  const request: CreateJSCollectionRequest = {
    name: jsTemplate.name,
    body: jsTemplate.body,
    variables: jsTemplate.variables || [],
    actions: sanitizedActions,
    workspaceId,
    applicationId,
    pageId,
    pluginId: plugin.id,
    pluginType: plugin.type,
  };

  yield put(
    createJSCollectionRequest({
      request,
      from: "ADD_PANE",
    }),
  );

  const result: ReduxAction<JSCollection> = yield take(
    ReduxActionTypes.CREATE_JS_ACTION_SUCCESS,
  );

  return result.payload;
}

/**
 * this saga executes the blueprint child operation
 *
 * @param parent
 * @param newWidgetId
 * @param widgets
 *
 * @returns { [widgetId: string]: FlattenedWidgetProps }
 */
export function* executeWidgetBlueprintChildOperations(
  operation: BlueprintOperation,
  canvasWidgets: { [widgetId: string]: FlattenedWidgetProps },
  widgetIds: string[],
  parentId: string,
) {
  // TODO(abhinav): Special handling for child operaionts
  // This needs to be deprecated soon

  let widgets = canvasWidgets,
    message;
  const layoutSystemType: LayoutSystemTypes = yield select(getLayoutSystemType);

  for (const widgetId of widgetIds) {
    // Get the default properties map of the current widget
    // The operation can handle things based on this map
    // Little abstraction leak, but will be deprecated soon
    const widgetPropertyMaps = {
      defaultPropertyMap: WidgetFactory.getWidgetDefaultPropertiesMap(
        canvasWidgets[widgetId].type as WidgetType,
      ),
    };

    let currMessage;

    ({ message: currMessage, widgets } = (
      operation.fn as BlueprintOperationChildOperationsFn
    )(widgets, widgetId, parentId, widgetPropertyMaps, layoutSystemType));

    //set message if one of the widget has any message to show
    if (currMessage) message = currMessage;
  }

  // If something odd happens show the message related to the odd scenario
  if (message) {
    toast.show(message, {
      kind: "info",
    });
  }

  // Flow returns to the usual from here.
  return widgets;
}

/**
 * this saga traverse the tree till we get
 * to MAIN_CONTAINER_WIDGET_ID while travesring, if we find
 * any widget which has CHILD_OPERATION, we will call the fn in it
 *
 * @param parent
 * @param newWidgetId
 * @param widgets
 *
 * @returns { [widgetId: string]: FlattenedWidgetProps }
 */
export function* traverseTreeAndExecuteBlueprintChildOperations(
  parent: FlattenedWidgetProps,
  newWidgetIds: string[],
  widgets: { [widgetId: string]: FlattenedWidgetProps },
) {
  let root = parent;

  while (root.parentId && root.widgetId !== MAIN_CONTAINER_WIDGET_ID) {
    const parentConfig = WidgetFactory.widgetConfigMap.get(root.type);

    // find the blueprint with type CHILD_OPERATIONS
    const blueprintChildOperation = get(
      parentConfig,
      "blueprint.operations",
      [],
    ).find(
      (operation: BlueprintOperation) =>
        operation.type === BlueprintOperationTypes.CHILD_OPERATIONS,
    );

    // if there is blueprint operation with CHILD_OPERATION type, call the fn in it
    if (blueprintChildOperation) {
      const updatedWidgets:
        | { [widgetId: string]: FlattenedWidgetProps }
        | undefined = yield call(
        executeWidgetBlueprintChildOperations,
        blueprintChildOperation,
        widgets,
        newWidgetIds,
        root.widgetId,
      );

      if (updatedWidgets) {
        widgets = updatedWidgets;
      }
    }

    root = widgets[root.parentId];
  }

  return widgets;
}

interface ExecuteWidgetBlueprintBeforeOperationsParams {
  parentId: string;
  widgetId: string;
  widgets: { [widgetId: string]: FlattenedWidgetProps };
  widgetType: WidgetType;
}

export function* executeWidgetBlueprintBeforeOperations(
  blueprintOperation: Extract<
    BlueprintOperationTypes,
    | BlueprintOperationTypes.BEFORE_ADD
    | BlueprintOperationTypes.BEFORE_DROP
    | BlueprintOperationTypes.BEFORE_PASTE
    | BlueprintOperationTypes.UPDATE_CREATE_PARAMS_BEFORE_ADD
  >,
  params: ExecuteWidgetBlueprintBeforeOperationsParams,
) {
  const { parentId, widgetId, widgets, widgetType } = params;
  const layoutSystemType: LayoutSystemTypes = yield select(getLayoutSystemType);
  const blueprintOperations: BlueprintOperation[] =
    WidgetFactory.widgetConfigMap.get(widgetType)?.blueprint?.operations ?? [];

  const beforeAddOperation = blueprintOperations.find(
    (operation) => operation.type === blueprintOperation,
  );

  if (beforeAddOperation)
    return (beforeAddOperation.fn as BlueprintBeforeOperationsFn)(
      widgets,
      widgetId,
      parentId,
      layoutSystemType,
    );
}
