import type { SetDraggingStateActionPayload } from "utils/hooks/dragResizeHooks";
import type { BaseWidgetProps } from "widgets/BaseWidgetHOC/withBaseWidgetHOC";

export const generateDragStateForFixedLayout = (
  e: React.DragEvent<Element>,
  draggableRef: HTMLElement,
  {
    bottomRow,
    leftColumn,
    parentColumnSpace,
    parentId,
    parentRowSpace,
    rightColumn,
    topRow,
    widgetId,
  }: Omit<BaseWidgetProps, "widgetName" | "type" | "isLoading" | "version">,
): SetDraggingStateActionPayload => {
  const widgetHeight = bottomRow - topRow;
  const widgetWidth = rightColumn - leftColumn;
  const bounds = draggableRef.getBoundingClientRect();

  // Calculate offset in grid units (not pixels)
  const offsetX = e.clientX - bounds.left;
  const offsetY = e.clientY - bounds.top;

  const startPoints = {
    top: Math.min(Math.max(offsetY, 0), widgetHeight * parentRowSpace - 1) / parentRowSpace,
    left: Math.min(Math.max(offsetX, 0), widgetWidth * parentColumnSpace - 1) / parentColumnSpace,
  };

  return {
    isDragging: true,
    dragGroupActualParent: parentId || "",
    draggingGroupCenter: { widgetId: widgetId },
    startPoints,
    draggedOn: parentId,
  };
};
