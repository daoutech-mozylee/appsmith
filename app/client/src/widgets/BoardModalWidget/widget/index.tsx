import type { Action } from "entities/Action";
import { PaginationType } from "entities/Action";
import { PluginPackageName, PluginType } from "entities/Plugin";
import { ActionRunBehaviour } from "PluginActionEditor/types/PluginActionTypes";
import type { CanvasWidgetsReduxState } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import { Colors } from "constants/Colors";
import {
  MAIN_CONTAINER_WIDGET_ID,
  WIDGET_TAGS,
} from "constants/WidgetConstants";
import {
  Positioning,
  ResponsiveBehavior,
} from "layoutSystems/common/utils/constants";
import type { WidgetProps } from "widgets/BaseWidget";
import { ContainerWidget } from "widgets/ContainerWidget/widget";
import type { WidgetBlueprint } from "WidgetProvider/types";
import {
  BlueprintOperationActionTypes,
  BlueprintOperationTypes,
} from "WidgetProvider/types";
import type { UpdatePropertyArgs } from "sagas/WidgetBlueprintSagas";
import boardModalTemplate from "../../BoardWidget/metadata.json";
import IconSVG from "../../BoardWidget/icon.svg";
import ThumbnailSVG from "../../BoardWidget/thumbnail.svg";

type TemplateWidget = {
  widgetName?: string;
  type: string;
  children?: TemplateWidget[];
  topRow?: number;
  bottomRow?: number;
  leftColumn?: number;
  rightColumn?: number;
  [key: string]: unknown;
};

type BoardModalTemplateShape = {
  modal: TemplateWidget;
  jsObject?: {
    name: string;
    body: string;
    variables?: Array<Record<string, unknown>>;
    actions?: Array<Record<string, unknown>>;
  };
  openButton?: TemplateWidget;
  table: TemplateWidget & {
    primaryColumns: Record<string, Record<string, unknown>>;
    dynamicBindingPathList?: Array<{ key: string }>;
    dynamicPropertyPathList?: Array<{ key: string }>;
  };
  query: {
    name: string;
    runBehaviour?: ActionRunBehaviour;
    actionConfiguration: {
      paginationType?: PaginationType;
      timeoutInMillisecond?: number;
      encodeParamsToggle?: boolean;
      body?: string;
      pluginSpecifiedTemplates?: unknown[];
    };
  };
  datasource: {
    name: string;
  };
};

const template = boardModalTemplate as BoardModalTemplateShape;
const ROOT_WIDGETS = [template.openButton, template.modal].filter(
  (widget) => !!widget,
) as TemplateWidget[];
const TEMPLATE_JS_OBJECT_NAME = template.jsObject?.name;
const BOARD_BUNDLE_WIDGET_NAMES = [
  "BoardBundleTriggerButton",
  "BoardBundleModal",
  "BoardBundleModalCanvas",
  "BoardBundleModalCloseIcon",
  "BoardBundleModalTitle",
  "BoardBundleModalDismissButton",
  "BoardBundleModalConfirmButton",
  "BoardBundleTable",
];

const JS_ACTION_TEMPLATE = template.jsObject
  ? {
      name: template.jsObject.name,
      body: template.jsObject.body,
      variables: template.jsObject.variables || [],
      actions:
        template.jsObject.actions?.map((action) => ({
          name: action.name,
          runBehaviour: action.runBehaviour,
          actionConfiguration: action.actionConfiguration,
          clientSideExecution: action.clientSideExecution,
          dynamicBindingPathList: action.dynamicBindingPathList,
          confirmBeforeExecute: action.confirmBeforeExecute,
        })) || [],
    }
  : undefined;

const buildPrimaryColumns = () => {
  const columns = template.table.primaryColumns || {};

  return Object.keys(columns).reduce<Record<string, Record<string, unknown>>>(
    (acc, key) => {
      const columnConfig = {
        ...columns[key],
        computedValue: `{{currentRow["${key}"]}}`,
      };

      acc[key] = columnConfig;

      return acc;
    },
    {},
  );
};

const BOARD_MODAL_TABLE_COLUMNS = buildPrimaryColumns();

const buildDynamicBindingList = () => {
  const bindings = Object.keys(BOARD_MODAL_TABLE_COLUMNS).map((key) => ({
    key: `primaryColumns.${key}.computedValue`,
  }));

  return [{ key: "tableData" }, ...bindings];
};

const BOARD_MODAL_TABLE_DYNAMIC_BINDINGS = buildDynamicBindingList();

const BASE_BINDINGS =
  template.table.dynamicBindingPathList?.filter(
    (binding) =>
      binding.key !== "tableData" && !binding.key.startsWith("primaryColumns."),
  ) || [];

const TABLE_DYNAMIC_BINDINGS = [
  ...BASE_BINDINGS,
  ...BOARD_MODAL_TABLE_DYNAMIC_BINDINGS,
];

const TABLE_DYNAMIC_PROPERTY_PATHS = [
  ...(template.table.dynamicPropertyPathList?.filter(
    (binding) => binding.key !== "tableData",
  ) || []),
  { key: "tableData" },
];

const TABLE_WIDGET_NAME = template.table.widgetName || "Table";

const WIDGET_PROP_OMIT_LIST = new Set([
  "children",
  "widgetId",
  "parentId",
  "renderMode",
  "key",
  "topRow",
  "bottomRow",
  "leftColumn",
  "rightColumn",
  "mobileTopRow",
  "mobileBottomRow",
  "mobileLeftColumn",
  "mobileRightColumn",
  "parentRowSpace",
  "parentColumnSpace",
  "flexLayers",
  "type",
]);

const sanitizeWidgetProps = (
  config: TemplateWidget,
): Record<string, unknown> => {
  return Object.entries(config).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (!WIDGET_PROP_OMIT_LIST.has(key)) {
        acc[key] = value;
      }

      return acc;
    },
    {},
  );
};

const getWidgetPosition = (config: TemplateWidget) => ({
  top: typeof config.topRow === "number" ? config.topRow : 0,
  left: typeof config.leftColumn === "number" ? config.leftColumn : 0,
});

const getWidgetSize = (config: TemplateWidget) => {
  const rows =
    typeof config.topRow === "number" && typeof config.bottomRow === "number"
      ? config.bottomRow - config.topRow
      : undefined;
  const cols =
    typeof config.leftColumn === "number" &&
    typeof config.rightColumn === "number"
      ? config.rightColumn - config.leftColumn
      : undefined;

  if (!rows || !cols) {
    return undefined;
  }

  return { rows, cols };
};

const buildBlueprintViewFromTemplate = (
  config: TemplateWidget,
  overrides: Record<string, Record<string, unknown>>,
): WidgetBlueprint["view"][number] => {
  const children = (config.children as TemplateWidget[]) || [];
  const sanitizedProps = sanitizeWidgetProps(config);
  const overrideProps =
    (config.widgetName && overrides[config.widgetName]) || undefined;
  const props = {
    ...sanitizedProps,
    ...(overrideProps || {}),
  };
  const view: WidgetBlueprint["view"][number] = {
    type: config.type,
    position: getWidgetPosition(config),
    props,
  };

  if (config.type !== "CANVAS_WIDGET") {
    const size = getWidgetSize(config);

    if (size) {
      view.size = size;
    }
  }

  if (children.length > 0) {
    view.props = {
      ...view.props,
      blueprint: {
        view: children.map((child) =>
          buildBlueprintViewFromTemplate(child, overrides),
        ),
      },
    };
  }

  return view;
};

const widgetOverrides: Record<string, Record<string, unknown>> = {
  [TABLE_WIDGET_NAME]: {
    primaryColumns: BOARD_MODAL_TABLE_COLUMNS,
    dynamicBindingPathList: TABLE_DYNAMIC_BINDINGS,
    dynamicPropertyPathList: TABLE_DYNAMIC_PROPERTY_PATHS,
    tableData: `{{${template.query.name}.data}}`,
  },
};

const BOARD_MODAL_DATASOURCE_NAME =
  template.datasource.name || "Board modal datasource";

const BOARD_MODAL_ACTION_TEMPLATE = {
  name: template.query.name,
  pluginType: PluginType.DB,
  runBehaviour: template.query.runBehaviour || ActionRunBehaviour.ON_PAGE_LOAD,
  actionConfiguration: {
    paginationType:
      template.query.actionConfiguration.paginationType || PaginationType.NONE,
    timeoutInMillisecond:
      template.query.actionConfiguration.timeoutInMillisecond || 10000,
    encodeParamsToggle:
      template.query.actionConfiguration.encodeParamsToggle ?? true,
    body: template.query.actionConfiguration.body,
    pluginSpecifiedTemplates:
      template.query.actionConfiguration.pluginSpecifiedTemplates || [],
  },
} as unknown as Action;

const getWidgetFromChild = (
  child: WidgetProps | string | undefined,
  widgets: CanvasWidgetsReduxState,
): WidgetProps | undefined => {
  if (!child) {
    return undefined;
  }

  if (typeof child === "string") {
    return widgets[child];
  }

  return widgets[child.widgetId];
};

const resolveWidgetFromNode = (
  node: WidgetProps | string | undefined,
  widgets: CanvasWidgetsReduxState,
): WidgetProps | undefined => {
  if (!node) {
    return undefined;
  }

  if (typeof node === "string") {
    return widgets[node];
  }

  return node;
};

const findWidgetByName = (
  node: WidgetProps | string | undefined,
  widgets: CanvasWidgetsReduxState,
  targetName: string,
): WidgetProps | undefined => {
  const resolved = resolveWidgetFromNode(node, widgets);

  if (!resolved) {
    return undefined;
  }

  if (resolved.widgetName === targetName) {
    return resolved;
  }

  if (!resolved.children || resolved.children.length === 0) {
    return undefined;
  }

  for (const child of resolved.children as Array<WidgetProps | string>) {
    const found = findWidgetByName(child, widgets, targetName);

    if (found) {
      return found;
    }
  }

  return undefined;
};

const findTableWidget = (
  widget: WidgetProps | undefined,
  widgets: CanvasWidgetsReduxState,
): WidgetProps | undefined => {
  if (!widget) {
    return undefined;
  }

  if (widget.type === "TABLE_WIDGET_V2") {
    return widget;
  }

  if (!widget.children || widget.children.length === 0) {
    return undefined;
  }

  for (const child of widget.children as Array<WidgetProps | string>) {
    const nextWidget = getWidgetFromChild(child, widgets);

    if (!nextWidget) {
      continue;
    }

    const table = findTableWidget(nextWidget, widgets);

    if (table) {
      return table;
    }
  }

  return undefined;
};

const tagBoardBundleWidgets = (
  widget: WidgetProps & { children?: WidgetProps[] },
  widgets: CanvasWidgetsReduxState,
) => {
  const updates: UpdatePropertyArgs[] = [];

  BOARD_BUNDLE_WIDGET_NAMES.forEach((name) => {
    const matchedWidget = findWidgetByName(widget, widgets, name);

    if (matchedWidget) {
      updates.push({
        widgetId: matchedWidget.widgetId,
        propertyName: "boardWidgetId",
        propertyValue: widget.widgetId,
      });
      updates.push({
        widgetId: matchedWidget.widgetId,
        propertyName: "isBoardBundleChild",
        propertyValue: true,
      });
    }
  });

  return updates;
};

const updateBoardTableJSBindings = (
  widget: WidgetProps & { children?: WidgetProps[] },
  widgets: CanvasWidgetsReduxState,
  parent?: WidgetProps,
  layoutSystemType?: unknown,
  addActionResult?: { config?: { name: string } } | { name?: string },
) => {
  if (!TEMPLATE_JS_OBJECT_NAME) {
    return [];
  }

  const boardTable = findTableWidget(widget, widgets);
  const jsCollectionName =
    (addActionResult as { name?: string } | undefined)?.name ||
    addActionResult?.config?.name;

  if (!boardTable || !jsCollectionName) {
    return [];
  }

  const onRowSelected = boardTable.onRowSelected;

  if (typeof onRowSelected !== "string") {
    return [];
  }

  if (!onRowSelected.includes(TEMPLATE_JS_OBJECT_NAME)) {
    return [];
  }

  const updatedHandler = onRowSelected
    .split(TEMPLATE_JS_OBJECT_NAME)
    .join(jsCollectionName);

  return [
    {
      widgetId: boardTable.widgetId,
      propertyName: "onRowSelected",
      propertyValue: updatedHandler,
    },
  ];
};

const moveModalToMainCanvas = (
  widget: WidgetProps & { children?: WidgetProps[] },
  widgets: CanvasWidgetsReduxState,
) => {
  if (!widget.children || widget.children.length === 0) {
    return [];
  }

  const boardCanvas = getWidgetFromChild(
    widget.children[0] as WidgetProps | string,
    widgets,
  );

  if (!boardCanvas || !boardCanvas.children) {
    return [];
  }

  const canvasChildren = boardCanvas.children as string[];
  const modalChildId = canvasChildren.find(
    (childId) => widgets[childId]?.type === "MODAL_WIDGET",
  );

  if (!modalChildId) {
    return [];
  }

  const updates: UpdatePropertyArgs[] = [];
  const updatedCanvasChildren = canvasChildren.filter(
    (childId) => childId !== modalChildId,
  );

  updates.push({
    widgetId: boardCanvas.widgetId,
    propertyName: "children",
    propertyValue: updatedCanvasChildren,
  });

  const modalWidget = widgets[modalChildId];

  if (!modalWidget) {
    return updates;
  }

  updates.push({
    widgetId: modalChildId,
    propertyName: "parentId",
    propertyValue: MAIN_CONTAINER_WIDGET_ID,
  });

  const mainContainer = widgets[MAIN_CONTAINER_WIDGET_ID];

  if (mainContainer) {
    const mainChildren = [
      ...((mainContainer.children as string[] | undefined) || []),
      modalChildId,
    ];

    updates.push({
      widgetId: MAIN_CONTAINER_WIDGET_ID,
      propertyName: "children",
      propertyValue: mainChildren,
    });
  }

  return updates;
};

const boardModalBlueprintOperations: WidgetBlueprint["operations"] = [
  {
    type: BlueprintOperationTypes.ADD_ACTION,
    actionType:
      BlueprintOperationActionTypes.CREATE_OR_UPDATE_DATASOURCE_WITH_ACTION,
    payload: {
      pluginPackageName: PluginPackageName.POSTGRES,
      datasourceName: BOARD_MODAL_DATASOURCE_NAME,
      actionConfig: BOARD_MODAL_ACTION_TEMPLATE,
    },
  },
  {
    type: BlueprintOperationTypes.MODIFY_PROPS,
    fn: (
      widget: WidgetProps & { children?: WidgetProps[] },
      widgets: CanvasWidgetsReduxState,
      parent?: WidgetProps,
      layoutSystemType?: unknown,
      addActionResult?: { config?: { name: string } },
    ) => {
      const boardTable = findTableWidget(widget, widgets);
      const newActionName = addActionResult?.config?.name;

      if (!boardTable || !newActionName) {
        return [];
      }

      const updates: UpdatePropertyArgs[] = [
        {
          widgetId: boardTable.widgetId,
          propertyName: "tableData",
          propertyValue: `{{${newActionName}.data}}`,
        },
      ];

      const dynamicBindings = boardTable.dynamicBindingPathList || [];
      const hasTableDataBinding = dynamicBindings.some(
        (binding) => binding.key === "tableData",
      );

      if (!hasTableDataBinding) {
        updates.push({
          widgetId: boardTable.widgetId,
          propertyName: "dynamicBindingPathList",
          propertyValue: [...dynamicBindings, { key: "tableData" }],
        });
      }

      return updates;
    },
  },
] as WidgetBlueprint["operations"];

if (JS_ACTION_TEMPLATE) {
  boardModalBlueprintOperations.push(
    {
      type: BlueprintOperationTypes.ADD_ACTION,
      actionType: BlueprintOperationActionTypes.CREATE_JS_ACTION,
      payload: {
        jsActionTemplate: JS_ACTION_TEMPLATE,
      },
    },
    {
      type: BlueprintOperationTypes.MODIFY_PROPS,
      fn: updateBoardTableJSBindings,
    },
  );
}

boardModalBlueprintOperations.push({
  type: BlueprintOperationTypes.MODIFY_PROPS,
  fn: (
    widget: WidgetProps & { children?: WidgetProps[] },
    widgets: CanvasWidgetsReduxState,
  ) => tagBoardBundleWidgets(widget, widgets),
});

boardModalBlueprintOperations.push({
  type: BlueprintOperationTypes.MODIFY_PROPS,
  fn: moveModalToMainCanvas,
});

const boardModalBlueprint: WidgetBlueprint = {
  view: [
    {
      type: "CANVAS_WIDGET",
      position: { top: 0, left: 0 },
      props: {
        detachFromLayout: true,
        canExtend: true,
        shouldScrollContents: false,
        children: [],
        version: 1,
        blueprint: {
          view: ROOT_WIDGETS.map((config) =>
            buildBlueprintViewFromTemplate(config, widgetOverrides),
          ),
        },
      },
    },
  ],
  operations: boardModalBlueprintOperations,
};

class BoardModalWidget extends ContainerWidget {
  static type = "BOARD_MODAL_WIDGET";

  static getConfig() {
    return {
      name: "Board modal",
      iconSVG: IconSVG,
      thumbnailSVG: ThumbnailSVG,
      tags: [WIDGET_TAGS.SUGGESTED_WIDGETS, WIDGET_TAGS.DAOU_OFFICE],
      searchTags: ["table", "board", "modal"],
      needsMeta: true,
      isCanvas: true,
    };
  }

  static getDefaults() {
    return {
      rows: 42,
      columns: 56,
      widgetName: "Board Modal",
      version: 1,
      backgroundColor: Colors.WHITE,
      borderColor: template.table?.borderColor,
      borderWidth: template.table?.borderWidth || "1",
      animateLoading: true,
      children: [],
      positioning: Positioning.Fixed,
      responsiveBehavior: ResponsiveBehavior.Fill,
      blueprint: boardModalBlueprint,
    };
  }
}

export default BoardModalWidget;
