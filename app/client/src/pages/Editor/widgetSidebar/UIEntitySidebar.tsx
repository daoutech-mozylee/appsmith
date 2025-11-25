import AnalyticsUtil from "ee/utils/AnalyticsUtil";
import { ENTITY_EXPLORER_SEARCH_ID } from "constants/Explorer";
import type {
  WidgetCardsGroupedByTags,
  WidgetTags,
} from "constants/WidgetConstants";
import { WIDGET_TAGS } from "constants/WidgetConstants";
import { Flex, SearchInput, Spinner, Text } from "@appsmith/ads";
import Fuse from "fuse.js";
import { debounce } from "lodash";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { groupWidgetCardsByTags } from "../utils";
import UIEntityTagGroup from "./UIEntityTagGroup";
import type { WidgetCardProps } from "widgets/BaseWidget";
import type { BoardUiModuleSummary } from "api/ModuleApi";
import { useWidgetDragResize } from "utils/hooks/dragResizeHooks";
import { generateReactKey } from "utils/generators";

const BoardModuleList = ({
  boardWidgetTemplate,
  moduleWidgetTemplate,
  modules,
  modulesLoading,
}: {
  boardWidgetTemplate?: WidgetCardProps;
  moduleWidgetTemplate?: WidgetCardProps;
  modules: BoardUiModuleSummary[];
  modulesLoading?: boolean;
}) => {
  const { setDraggingNewWidget } = useWidgetDragResize();
  const canDragModules = !!moduleWidgetTemplate;

  const handleModuleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    module: BoardUiModuleSummary,
  ) => {
    if (!moduleWidgetTemplate) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const moduleName = module.unpublishedModule?.name || module.id;

    const dragPayload = {
      ...moduleWidgetTemplate,
      widgetId: generateReactKey(),
      widgetCardName: moduleName,
      props: {
        moduleId: module.id,
        modulePackageId: module.packageId,
        moduleName,
        moduleDescription: module.unpublishedModule?.description,
      },
    } as WidgetCardProps & {
      widgetCardName?: string;
      props?: Record<string, unknown>;
    };

    setDraggingNewWidget(true, dragPayload);
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      <Text kind="heading-m">{WIDGET_TAGS.MODULES}</Text>
      <Text color="#6A7585" kind="body-s">
        Board UI modules available in this workspace. Drag a module below onto
        the canvas to reuse it. You can still drop the Board Modal widget to
        create a brand new module bundle.
      </Text>
      {!canDragModules && (
        <Text color="#F22B2B" kind="body-s">
          Unable to detect the Board Modal widget in this editor build, so
          module dragging is disabled.
        </Text>
      )}
      {modulesLoading ? (
        <Flex alignItems="center" justifyContent="center" p="spaces-3">
          <Spinner size="md" />
        </Flex>
      ) : modules.length === 0 ? (
        <Text color="#6A7585" kind="body-s">
          No modules yet. Create a module to see it listed here.
        </Text>
      ) : (
        <div className="flex flex-col gap-1">
          {modules.map((module) => (
            <div
              className="rounded-md p-2"
              draggable={canDragModules}
              key={module.id}
              onDragStart={(event) => handleModuleDragStart(event, module)}
              style={{
                border: "1px solid var(--ads-v2-color-border)",
                cursor: canDragModules ? "grab" : "not-allowed",
              }}
            >
              <Text kind="body-m">
                {module.unpublishedModule?.name || module.id}
              </Text>
              {module.workspaceId && (
                <Text color="#6A7585" kind="body-s">
                  {module.workspaceId}
                </Text>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
interface UIEntitySidebarProps {
  focusSearchInput?: boolean;
  isActive: boolean;
  cards: WidgetCardProps[];
  entityLoading?: Partial<Record<WidgetTags, boolean>>;
  groupedCards: WidgetCardsGroupedByTags;
  searchPlaceholderText?: string;
  emptyMessage?: string;
  modules?: BoardUiModuleSummary[];
  modulesLoading?: boolean;
  boardWidgetTemplate?: WidgetCardProps;
  moduleWidgetTemplate?: WidgetCardProps;
}

function UIEntitySidebar({
  cards,
  emptyMessage,
  entityLoading,
  focusSearchInput,
  groupedCards,
  isActive,
  modules = [],
  modulesLoading,
  boardWidgetTemplate,
  moduleWidgetTemplate,
  searchPlaceholderText,
}: UIEntitySidebarProps) {
  const [filteredCards, setFilteredCards] =
    useState<WidgetCardsGroupedByTags>(groupedCards);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [areSearchResultsEmpty, setAreSearchResultsEmpty] = useState(false);
  const hideSuggestedWidgets = useMemo(
    () => isSearching && !areSearchResultsEmpty,
    [isSearching, areSearchResultsEmpty],
  );

  const searchWildcards = useMemo(
    () =>
      cards
        .filter((card) => card.isSearchWildcard)
        .map((card) => ({ ...card, tags: [WIDGET_TAGS.SUGGESTED_WIDGETS] })),
    [cards],
  );

  const fuse = useMemo(
    () =>
      new Fuse(cards, {
        keys: [
          { name: "displayName", weight: 0.8 },
          { name: "searchTags", weight: 0.1 },
          { name: "tags", weight: 0.1 },
        ],
        threshold: 0.2,
        distance: 100,
      }),
    [cards],
  );

  const sendWidgetSearchAnalytics = debounce((value: string) => {
    if (value !== "") {
      AnalyticsUtil.logEvent("WIDGET_SEARCH", { value });
    }
  }, 1000);

  const filterCards = (keyword: string) => {
    setIsSearching(true);
    sendWidgetSearchAnalytics(keyword);

    if (keyword.trim().length > 0) {
      const searchResult = fuse.search(keyword);

      setFilteredCards(
        groupWidgetCardsByTags(
          searchResult.length > 0 ? searchResult : searchWildcards,
        ),
      );
      setAreSearchResultsEmpty(searchResult.length === 0);
    } else {
      setFilteredCards(groupedCards);
      setIsSearching(false);
      setAreSearchResultsEmpty(false);
    }
  };

  const search = debounce((value: string) => {
    filterCards(value.toLowerCase());
  }, 300);

  // update widgets list after building blocks have been fetched async
  useEffect(() => {
    setFilteredCards(groupedCards);
  }, [entityLoading?.[WIDGET_TAGS.BUILDING_BLOCKS]]);

  useEffect(() => {
    if (focusSearchInput) searchInputRef.current?.focus();
  }, [focusSearchInput]);

  return (
    <div
      className={`flex flex-col t--widget-sidebar overflow-hidden ${
        isActive ? "" : "hidden"
      }`}
    >
      <div className="sticky top-0 px-3 mt-0.5">
        <SearchInput
          // @ts-expect-error fix this the next time the file is edited
          autoComplete="off"
          id={ENTITY_EXPLORER_SEARCH_ID}
          onChange={search}
          placeholder={searchPlaceholderText}
          ref={searchInputRef}
          type="text"
        />
      </div>
      <Flex
        className="flex-grow px-3 overflow-y-scroll flex-col"
        data-testid="t--widget-sidebar-scrollable-wrapper"
        pt="spaces-2"
      >
        <BoardModuleList
          boardWidgetTemplate={boardWidgetTemplate}
          moduleWidgetTemplate={moduleWidgetTemplate}
          modules={modules}
          modulesLoading={modulesLoading}
        />
        {areSearchResultsEmpty && (
          <Text
            color="#6A7585"
            kind="body-m"
            renderAs="p"
            style={{ marginBottom: "15px" }}
          >
            {emptyMessage} `{searchInputRef.current?.value}`
          </Text>
        )}
        <div>
          {Object.entries(filteredCards).map(([tag, cardsForThisTag]) => {
            if (
              !cardsForThisTag?.length &&
              !entityLoading?.[tag as WidgetTags]
            ) {
              return null;
            }

            if (tag === WIDGET_TAGS.SUGGESTED_WIDGETS && hideSuggestedWidgets) {
              return null;
            }

            return (
              <UIEntityTagGroup
                cards={cardsForThisTag}
                isLoading={!!entityLoading?.[tag as WidgetTags]}
                key={tag}
                tag={tag}
              />
            );
          })}
        </div>
      </Flex>
    </div>
  );
}

UIEntitySidebar.displayName = "UIEntitySidebar";

export default UIEntitySidebar;
