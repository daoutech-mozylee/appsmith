import equal from "fast-deep-equal/es6";
import type { ReactNode } from "react";
import React, { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import type { DefaultRootState } from "react-redux";
import { getIsPropertyPaneVisible } from "selectors/propertyPaneSelectors";
import {
  getFocusedParentToOpen,
  isWidgetFocused,
  isResizingOrDragging,
  isWidgetSelected,
  shouldWidgetIgnoreClicksSelector,
} from "selectors/widgetSelectors";
import styled from "styled-components";
import { stopEventPropagation } from "utils/AppsmithUtils";
import { useWidgetSelection } from "./useWidgetSelection";
import { SelectionRequestType } from "sagas/WidgetSelectUtils";
import { NavigationMethod } from "../history";
import { getLayoutSystemType } from "selectors/layoutSystemSelectors";
import { PACKAGE_MODULE_WIDGET_TYPE } from "constants/PackageModuleConstants";
import type { CanvasWidgetsReduxState } from "ee/reducers/entityReducers/canvasWidgetsReducer";

const ContentWrapper = styled.div`
  width: 100%;
  height: 100%;
`;

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

export function ClickContentToOpenPropPane({
  children,
  widgetId,
}: {
  widgetId: string;
  children?: ReactNode;
}) {
  const { focusWidget } = useWidgetSelection();

  const clickToSelectWidget = useClickToSelectWidget(widgetId);

  const isCurrentWidgetFocused = useSelector(isWidgetFocused(widgetId));
  const resizingOrDragging = useSelector(isResizingOrDragging);

  // Check if widget is inside a module
  const canvasWidgets = useSelector(
    (state: DefaultRootState) => state.entities.canvasWidgets,
  );
  const isInsideModule = useMemo(
    () => checkIsWidgetInsideModule(widgetId, canvasWidgets),
    [widgetId, canvasWidgets],
  );

  // TODO: Fix this the next time the file is edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseOver = (e: any) => {
    // 모듈 내부 위젯은 focus 방지
    if (isInsideModule) {
      e.stopPropagation();

      return;
    }

    focusWidget &&
      !resizingOrDragging &&
      !isCurrentWidgetFocused &&
      focusWidget(widgetId);
    e.stopPropagation();
  };

  return (
    <ContentWrapper
      onClick={stopEventPropagation}
      onMouseDownCapture={clickToSelectWidget}
      onMouseOver={handleMouseOver}
    >
      {children}
    </ContentWrapper>
  );
}

export const useClickToSelectWidget = (widgetId: string) => {
  const { focusWidget, selectWidget } = useWidgetSelection();
  const isPropPaneVisible = useSelector(getIsPropertyPaneVisible);
  const isSelected = useSelector(isWidgetSelected(widgetId));
  const parentWidgetToOpen = useSelector(getFocusedParentToOpen, equal);
  const shouldIgnoreClicks = useSelector(
    shouldWidgetIgnoreClicksSelector(widgetId),
  );
  const layoutSystemType = useSelector(getLayoutSystemType);

  const clickToSelectWidget = useCallback(
    // TODO: Fix this the next time the file is edited
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      // Ignore click captures
      // 1. If the component is resizing or dragging because it is handled internally in draggable component.
      // 2. If table filter property pane is open.
      if (shouldIgnoreClicks) return;

      if ((!isPropPaneVisible && isSelected) || !isSelected) {
        let type: SelectionRequestType = SelectionRequestType.One;

        if (e.metaKey || e.ctrlKey || (layoutSystemType && e.shiftKey)) {
          type = SelectionRequestType.PushPop;
        } else if (e.shiftKey) {
          type = SelectionRequestType.ShiftSelect;
        }

        if (parentWidgetToOpen) {
          selectWidget(
            type,
            [parentWidgetToOpen.widgetId],
            NavigationMethod.CanvasClick,
          );
        } else {
          selectWidget(type, [widgetId], NavigationMethod.CanvasClick);
          focusWidget(widgetId);
        }

        if (
          type === SelectionRequestType.PushPop ||
          type === SelectionRequestType.ShiftSelect
        ) {
          e.stopPropagation();
        }
      }
    },
    [shouldIgnoreClicks, isPropPaneVisible, isSelected, parentWidgetToOpen],
  );

  return clickToSelectWidget;
};
