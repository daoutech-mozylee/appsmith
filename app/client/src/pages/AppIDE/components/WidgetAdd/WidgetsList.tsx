import React from "react";

import { useUIExplorerItems } from "pages/Editor/widgetSidebar/hooks";
import UIEntitySidebar from "pages/Editor/widgetSidebar/UIEntitySidebar";
import {
  createMessage,
  UI_ELEMENT_PANEL_SEARCH_TEXT,
  WIDGET_PANEL_EMPTY_MESSAGE,
} from "ee/constants/messages";
import { WIDGET_TAGS } from "constants/WidgetConstants";

interface WidgetsListProps {
  focusSearchInput?: boolean;
}

function WidgetsList({ focusSearchInput }: WidgetsListProps) {
  const {
    boardWidgetCard,
    cards,
    entityLoading,
    groupedCards,
    moduleWidgetCard,
    modules,
  } = useUIExplorerItems();
  const modulesLoading = !!entityLoading[WIDGET_TAGS.MODULES];

  return (
    <UIEntitySidebar
      cards={cards}
      emptyMessage={createMessage(WIDGET_PANEL_EMPTY_MESSAGE)}
      entityLoading={entityLoading}
      focusSearchInput={focusSearchInput}
      groupedCards={groupedCards}
      isActive
      modules={modules}
      modulesLoading={modulesLoading}
      boardWidgetTemplate={boardWidgetCard}
      moduleWidgetTemplate={moduleWidgetCard}
      searchPlaceholderText={createMessage(UI_ELEMENT_PANEL_SEARCH_TEXT)}
    />
  );
}

export default WidgetsList;
