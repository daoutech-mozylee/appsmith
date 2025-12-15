import React, { useMemo, useState } from "react";
import styled from "styled-components";

import { useUIExplorerItems } from "pages/Editor/widgetSidebar/hooks";
import UIEntitySidebar from "pages/Editor/widgetSidebar/UIEntitySidebar";
import {
  createMessage,
  UI_ELEMENT_PANEL_SEARCH_TEXT,
  WIDGET_PANEL_EMPTY_MESSAGE,
} from "ee/constants/messages";
import { Tabs, TabsList, Tab, TabPanel } from "@appsmith/ads";
import { WIDGET_TAGS } from "constants/WidgetConstants";
import { groupWidgetCardsByTags } from "pages/Editor/utils";

interface WidgetsListProps {
  focusSearchInput?: boolean;
}

const StyledTabs = styled(Tabs)`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; /* flex 자식 요소가 축소될 수 있도록 */

  > [role="tablist"] {
    flex-shrink: 0;
    padding: 0 var(--ads-v2-spaces-3);
    margin-bottom: var(--ads-v2-spaces-2);
    overflow: visible;
  }

  > [role="tabpanel"] {
    flex: 1;
    min-height: 0; /* 중요: 스크롤이 작동하려면 필요 */
    overflow: hidden;
    margin-top: 0;

    /* UIEntitySidebar 컨테이너가 전체 높이를 차지하도록 */
    > .t--widget-sidebar {
      height: 100%;
    }
  }
`;

const TAB_WIDGETS = "widgets";
const TAB_MODULES = "modules";

function WidgetsList({ focusSearchInput }: WidgetsListProps) {
  const { cards, entityLoading } = useUIExplorerItems();
  const [activeTab, setActiveTab] = useState(TAB_WIDGETS);

  // Widgets 탭용: PACKAGES 태그가 없는 카드만
  const widgetCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          !(card.tags as string[] | undefined)?.includes(WIDGET_TAGS.PACKAGES),
      ),
    [cards],
  );
  const groupedWidgetCards = useMemo(
    () => groupWidgetCardsByTags(widgetCards),
    [widgetCards],
  );

  // Modules 탭용: PACKAGES 태그가 있는 카드만
  const moduleCards = useMemo(
    () =>
      cards.filter((card) =>
        (card.tags as string[] | undefined)?.includes(WIDGET_TAGS.PACKAGES),
      ),
    [cards],
  );
  const groupedModuleCards = useMemo(
    () => groupWidgetCardsByTags(moduleCards),
    [moduleCards],
  );

  // 모듈이 없으면 탭 없이 기존 방식으로 렌더링
  if (moduleCards.length === 0) {
    return (
      <UIEntitySidebar
        cards={widgetCards}
        emptyMessage={createMessage(WIDGET_PANEL_EMPTY_MESSAGE)}
        entityLoading={entityLoading}
        focusSearchInput={focusSearchInput}
        groupedCards={groupedWidgetCards}
        isActive
        searchPlaceholderText={createMessage(UI_ELEMENT_PANEL_SEARCH_TEXT)}
      />
    );
  }

  return (
    <StyledTabs onValueChange={setActiveTab} value={activeTab}>
      <TabsList>
        <Tab value={TAB_WIDGETS}>Widgets</Tab>
        <Tab value={TAB_MODULES}>Modules</Tab>
      </TabsList>
      <TabPanel value={TAB_WIDGETS}>
        <UIEntitySidebar
          cards={widgetCards}
          emptyMessage={createMessage(WIDGET_PANEL_EMPTY_MESSAGE)}
          entityLoading={entityLoading}
          focusSearchInput={focusSearchInput && activeTab === TAB_WIDGETS}
          groupedCards={groupedWidgetCards}
          isActive={activeTab === TAB_WIDGETS}
          searchPlaceholderText={createMessage(UI_ELEMENT_PANEL_SEARCH_TEXT)}
        />
      </TabPanel>
      <TabPanel value={TAB_MODULES}>
        <UIEntitySidebar
          cards={moduleCards}
          emptyMessage="No modules found for"
          entityLoading={entityLoading}
          focusSearchInput={focusSearchInput && activeTab === TAB_MODULES}
          groupedCards={groupedModuleCards}
          isActive={activeTab === TAB_MODULES}
          searchPlaceholderText="Search modules"
        />
      </TabPanel>
    </StyledTabs>
  );
}

export default WidgetsList;
