import type { Action } from "entities/Action";
import { PaginationType } from "entities/Action";
import { PluginPackageName, PluginType } from "entities/Plugin";
import { ActionRunBehaviour } from "PluginActionEditor/types/PluginActionTypes";
import type { CanvasWidgetsReduxState } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import { Colors } from "constants/Colors";
import { WIDGET_TAGS } from "constants/WidgetConstants";
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
import boardTemplate from "../metadata.json";
import IconSVG from "../icon.svg";
import ThumbnailSVG from "../thumbnail.svg";

type BoardTemplateShape = {
  table: Record<string, any>;
  query: {
    name: string;
    actionConfiguration: Record<string, unknown>;
    runBehaviour?: ActionRunBehaviour;
  };
  datasource: {
    name: string;
  };
};

const template = boardTemplate as BoardTemplateShape;

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

const BOARD_TABLE_COLUMNS = buildPrimaryColumns();

const buildDynamicBindingList = () => {
  const bindings = Object.keys(BOARD_TABLE_COLUMNS).map((key) => ({
    key: `primaryColumns.${key}.computedValue`,
  }));

  return [{ key: "tableData" }, ...bindings];
};

const BOARD_TABLE_DYNAMIC_BINDINGS = buildDynamicBindingList();

const BOARD_TABLE_PROPS = {
  label: template.table.label || "Board table",
  version: template.table.version,
  animateLoading: true,
  accentColor: template.table.accentColor,
  borderRadius: template.table.borderRadius,
  borderColor: template.table.borderColor,
  boxShadow: template.table.boxShadow,
  borderWidth: template.table.borderWidth,
  isVisibleFilters: template.table.isVisibleFilters,
  isVisiblePagination: template.table.isVisiblePagination,
  isVisibleSearch: template.table.isVisibleSearch,
  defaultSelectedRowIndex: template.table.defaultSelectedRowIndex ?? 0,
  responsiveBehavior:
    template.table.responsiveBehavior ?? ResponsiveBehavior.Fill,
  minWidth: template.table.minWidth ?? 450,
  childStylesheet: template.table.childStylesheet,
  columnOrder: template.table.columnOrder,
  primaryColumns: BOARD_TABLE_COLUMNS,
  dynamicBindingPathList: BOARD_TABLE_DYNAMIC_BINDINGS,
  tableData: `{{${template.query.name}.data}}`,
};

const BOARD_DATASOURCE_NAME =
  template.datasource.name || "Board datasource template";

const BOARD_ACTION_TEMPLATE = {
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
      template.query.actionConfiguration.pluginSpecifiedTemplates ||
      template.table.pluginSpecifiedTemplates ||
      [],
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

const getBoardTable = (
  widget: WidgetProps & { children?: WidgetProps[] | string[] },
  widgets: CanvasWidgetsReduxState,
): WidgetProps | undefined => {
  if (!widget.children || widget.children.length === 0) {
    return undefined;
  }

  const canvas = getWidgetFromChild(
    widget.children[0] as WidgetProps | string,
    widgets,
  );

  if (!canvas || !canvas.children || canvas.children.length === 0) {
    return undefined;
  }

  const tableChildId = (canvas.children as string[]).find((childId) => {
    const child = widgets[childId];

    return child?.type === "TABLE_WIDGET_V2";
  });

  if (!tableChildId) {
    return undefined;
  }

  return widgets[tableChildId];
};

const boardBlueprint: WidgetBlueprint = {
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
          view: [
            {
              type: "TABLE_WIDGET_V2",
              size: {
                rows: 25,
                cols: 56,
              },
              position: { top: 2, left: 4 },
              props: BOARD_TABLE_PROPS,
            },
          ],
        },
      },
    },
  ],
  operations: [
    {
      type: BlueprintOperationTypes.ADD_ACTION,
      actionType:
        BlueprintOperationActionTypes.CREATE_OR_UPDATE_DATASOURCE_WITH_ACTION,
      payload: {
        pluginPackageName: PluginPackageName.POSTGRES,
        datasourceName: BOARD_DATASOURCE_NAME,
        actionConfig: BOARD_ACTION_TEMPLATE,
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
        const tableWidget = getBoardTable(widget, widgets);
        const newActionName = addActionResult?.config?.name;

        if (!tableWidget || !newActionName) {
          return [];
        }

        const updates: UpdatePropertyArgs[] = [
          {
            widgetId: tableWidget.widgetId,
            propertyName: "tableData",
            propertyValue: `{{${newActionName}.data}}`,
          },
        ];

        const dynamicBindings = tableWidget.dynamicBindingPathList || [];
        const hasTableDataBinding = dynamicBindings.some(
          (binding) => binding.key === "tableData",
        );

        if (!hasTableDataBinding) {
          updates.push({
            widgetId: tableWidget.widgetId,
            propertyName: "dynamicBindingPathList",
            propertyValue: [...dynamicBindings, { key: "tableData" }],
          });
        }

        return updates;
      },
    },
  ],
};

class BoardWidget extends ContainerWidget {
  static type = "BOARD_WIDGET";

  static getConfig() {
    return {
      name: "Board",
      iconSVG: IconSVG,
      thumbnailSVG: ThumbnailSVG,
      tags: [WIDGET_TAGS.SUGGESTED_WIDGETS, WIDGET_TAGS.DAOU_OFFICE],
      searchTags: ["table", "board", "data"],
      needsMeta: true,
      isCanvas: true,
    };
  }

  static getDefaults() {
    return {
      rows: 42,
      columns: 56,
      widgetName: "Board",
      version: 1,
      backgroundColor: Colors.WHITE,
      borderColor: template.table.borderColor,
      borderWidth: template.table.borderWidth || "1",
      animateLoading: true,
      children: [],
      positioning: Positioning.Fixed,
      responsiveBehavior: ResponsiveBehavior.Fill,
      blueprint: boardBlueprint,
    };
  }
}

export default BoardWidget;
