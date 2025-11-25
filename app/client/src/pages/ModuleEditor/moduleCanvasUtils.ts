import type { UiModuleResponse } from "api/ModuleApi";
import type { UpdateCanvasPayload } from "actions/pageActions";
import { MAIN_CONTAINER_WIDGET_ID } from "constants/WidgetConstants";
import { flattenDSL, migrateDSL } from "@shared/dsl";
import defaultTemplate from "templates/default";
import type { ContainerWidgetProps } from "widgets/ContainerWidget/widget";
import type { WidgetProps } from "widgets/BaseWidget";
import type { DSLWidget } from "WidgetProvider/types";
import type { PageAction } from "constants/AppsmithActionConstants/ActionConstants";
import log from "loglevel";

export async function generateModuleCanvasPayload(
  moduleData: UiModuleResponse,
): Promise<UpdateCanvasPayload> {
  const version =
    moduleData.unpublishedModule || moduleData.publishedModule || {};
  const layout = version.layouts?.[0];
  const layoutId = layout?.id || moduleData.id;
  const rawDSL = (layout?.dsl ||
    defaultTemplate) as ContainerWidgetProps<WidgetProps>;
  const migratedDSL = (await migrateDSL(
    rawDSL,
    false,
  )) as DSLWidget;

  // Debug: surface DSL shape when running in editor
  log.debug("ModuleCanvasUtils: building canvas payload", {
    rootId: migratedDSL.widgetId,
    type: migratedDSL.type,
    childrenCount: Array.isArray(migratedDSL.children)
      ? migratedDSL.children.length
      : 0,
  });

  const flattenedDSL = flattenDSL(migratedDSL);

  // Ensure root widget is marked as MainContainer so explorer shows children
  if (flattenedDSL[migratedDSL.widgetId]) {
    flattenedDSL[migratedDSL.widgetId].widgetName = "MainContainer";
    flattenedDSL[migratedDSL.widgetId].type = "CANVAS_WIDGET";
  }

  // 강제로 parent-child 링크를 재구축해서 children 누락으로 캔버스가 비는 문제를 방지
  const rebuildRelationships = (node: DSLWidget, parentId?: string) => {
    const currentId = node.widgetId || MAIN_CONTAINER_WIDGET_ID;
    const flattened = flattenedDSL[currentId];

    if (flattened) {
      flattened.parentId = parentId;
      if (Array.isArray(node.children)) {
        flattened.children = node.children
          .map((child) => child?.widgetId)
          .filter(Boolean) as string[];
        node.children.forEach((child) =>
          rebuildRelationships(child as DSLWidget, currentId),
        );
      } else {
        flattened.children = [];
      }

      // 모듈 에디터에서는 편집 가능하도록 drag/rename 잠금 해제 및 드롭 허용
      flattened.dragDisabled = false;
      flattened.isRenameDisabled = false;
      flattened.dropDisabled = false;
      flattened.isDropTarget = true;

      // Canvas 위젯은 특히 drop target으로 명시적 설정
      if (flattened.type === "CANVAS_WIDGET") {
        flattened.dropDisabled = false;
        flattened.canExtend = true;
        flattened.shouldScrollContents = false;
      }
    }
  };

  rebuildRelationships(migratedDSL);
  log.debug("ModuleCanvasUtils: relationships rebuilt", {
    rootId: migratedDSL.widgetId,
    rootChildren: flattenedDSL[migratedDSL.widgetId]?.children,
  });

  return {
    pageWidgetId: migratedDSL.widgetId || MAIN_CONTAINER_WIDGET_ID,
    currentPageId: moduleData.id,
    currentPageName: version.name || "Untitled module",
    currentLayoutId: layoutId,
    currentApplicationId: moduleData.packageId,
    widgets: flattenedDSL,
    dsl: migratedDSL,
    pageActions: (layout?.layoutOnLoadActions as PageAction[][]) || [],
    layoutOnLoadActionErrors: layout?.layoutOnLoadActionErrors || [],
  };
}
