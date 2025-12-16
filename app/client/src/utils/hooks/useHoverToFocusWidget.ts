import { useWidgetSelection } from "./useWidgetSelection";
import { useSelector } from "react-redux";
import { isWidgetFocused } from "selectors/widgetSelectors";
import { getAnvilSpaceDistributionStatus } from "layoutSystems/anvil/integrations/selectors";
import { selectCombinedPreviewMode } from "selectors/gitModSelectors";
import type { DefaultRootState } from "react-redux";
import type React from "react";
import { useCurrentAppState } from "IDE/hooks/useCurrentAppState";
import { EditorState } from "IDE/enums";
import { PACKAGE_MODULE_WIDGET_TYPE } from "constants/PackageModuleConstants";
import type { CanvasWidgetsReduxState } from "ee/reducers/entityReducers/canvasWidgetsReducer";

/**
 * 위젯이 Package Module 내부에 있는지 확인
 */
const checkIsWidgetInsideModule = (
  widgetId: string,
  widgets: CanvasWidgetsReduxState,
): boolean => {
  let currentWidget = widgets[widgetId];

  while (currentWidget) {
    const parentId = currentWidget.parentId;

    if (!parentId) break;

    const parentWidget = widgets[parentId];

    if (!parentWidget) break;

    if (parentWidget.type === PACKAGE_MODULE_WIDGET_TYPE) {
      return true;
    }

    currentWidget = parentWidget;
  }

  return false;
};

export const useHoverToFocusWidget = (
  widgetId: string,
  resizeDisabled?: boolean,
) => {
  const { focusWidget } = useWidgetSelection();

  // This state tels us which widget is focused
  // The value is the widgetId of the focused widget.
  const isFocused = useSelector(isWidgetFocused(widgetId));

  // This state tells the current IDE state
  const ideState = useCurrentAppState();
  // Check if in the editor state
  const isEditor = ideState === EditorState.EDITOR;

  // This state tells us whether a `ResizableComponent` is resizing
  const isResizing = useSelector(
    (state: DefaultRootState) => state.ui.widgetDragResize.isResizing,
  );
  // This state tells us whether a `DraggableComponent` is dragging
  const isDragging = useSelector(
    (state: DefaultRootState) => state.ui.widgetDragResize.isDragging,
  );

  const isResizingOrDragging = isResizing || isDragging;
  // This state tells us whether space redistribution is in process
  const isDistributingSpace = useSelector(getAnvilSpaceDistributionStatus);
  const isPreviewMode = useSelector(selectCombinedPreviewMode);

  // Check if widget is inside a module (should prevent focus/selection)
  const canvasWidgets = useSelector(
    (state: DefaultRootState) => state.entities.canvasWidgets,
  );
  const isInsideModule = checkIsWidgetInsideModule(widgetId, canvasWidgets);

  // When mouse is over this draggable
  const handleMouseOver = (e: React.MouseEvent) => {
    // 모듈 내부 위젯은 focus 방지
    if (isInsideModule) {
      e.stopPropagation();

      return;
    }

    focusWidget &&
      !isResizingOrDragging &&
      !isFocused &&
      isEditor &&
      !isDistributingSpace &&
      !resizeDisabled &&
      !isPreviewMode &&
      focusWidget(widgetId, e.metaKey);
    e.stopPropagation();
  };

  const handleMouseLeave = () => {
    // on leaving a widget, we reset the focused widget
    focusWidget && focusWidget();
  };

  return [handleMouseOver, handleMouseLeave];
};
