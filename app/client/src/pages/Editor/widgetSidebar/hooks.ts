import { FEATURE_FLAG } from "ee/entities/FeatureFlag";
import { getAllTemplates } from "actions/templateActions";
import type { WidgetTags } from "constants/WidgetConstants";
import { WIDGET_TAGS } from "constants/WidgetConstants";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getWidgetCards } from "selectors/editorSelectors";
import {
  getBuildingBlockExplorerCards,
  templatesCountSelector,
} from "selectors/templatesSelectors";
import { useFeatureFlag } from "utils/hooks/useFeatureFlag";
import { groupWidgetCardsByTags } from "../utils";
import { isFixedLayoutSelector } from "selectors/layoutSystemSelectors";
import ModuleApi from "api/ModuleApi";
import type { BoardUiModuleSummary } from "api/ModuleApi";
import { getCurrentWorkspaceId } from "ee/selectors/selectedWorkspaceSelectors";
import type { WidgetCardProps } from "widgets/BaseWidget";
import WidgetFactory from "WidgetProvider/factory";

/**
 * Custom hook for managing UI explorer items including widgets and building blocks.
 * @returns Object containing cards, grouped cards and entity loading states.
 */
export const useUIExplorerItems = () => {
  const releaseDragDropBuildingBlocks = useFeatureFlag(
    FEATURE_FLAG.release_drag_drop_building_blocks_enabled,
  );
  const isFixedLayout = useSelector(isFixedLayoutSelector);
  const workspaceId = useSelector(getCurrentWorkspaceId);
  const dispatch = useDispatch();
  // check if entities have loaded
  const isBuildingBlocksLoaded = useSelector(templatesCountSelector) > 0;

  const [entityLoading, setEntityLoading] = useState<
    Partial<Record<WidgetTags, boolean>>
  >({
    "Building Blocks": releaseDragDropBuildingBlocks
      ? !isBuildingBlocksLoaded
      : false,
    [WIDGET_TAGS.MODULES]: false,
  });
  const widgetCards = useSelector(getWidgetCards);
  const buildingBlockCards = useSelector(getBuildingBlockExplorerCards);
  const [modules, setModules] = useState<BoardUiModuleSummary[]>([]);

  // handle loading async entities
  useEffect(() => {
    if (
      !isBuildingBlocksLoaded &&
      releaseDragDropBuildingBlocks &&
      isFixedLayout
    ) {
      dispatch(getAllTemplates());
    } else {
      setEntityLoading((prev) => ({ ...prev, "Building Blocks": false }));
    }
  }, [isBuildingBlocksLoaded, releaseDragDropBuildingBlocks, isFixedLayout]);

  useEffect(() => {
    let isMounted = true;

    if (!workspaceId) {
      setModules([]);
      setEntityLoading((prev) => ({ ...prev, [WIDGET_TAGS.MODULES]: false }));
      return () => {
        isMounted = false;
      };
    }

    setEntityLoading((prev) => ({ ...prev, [WIDGET_TAGS.MODULES]: true }));

    ModuleApi.fetchWorkspaceModules(workspaceId)
      .then((response) => {
        console.log("response", response);

        if (!isMounted) {
          return;
        }

        if (response?.responseMeta?.success && Array.isArray(response.data)) {
          setModules(response.data);
        } else {
          setModules([]);
        }
      })
      .catch(() => {
        if (isMounted) {
          setModules([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setEntityLoading((prev) => ({
            ...prev,
            [WIDGET_TAGS.MODULES]: false,
          }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  const cards = useMemo(
    () => [
      ...widgetCards,
      ...(isFixedLayout && releaseDragDropBuildingBlocks
        ? buildingBlockCards
        : []),
    ],
    [
      widgetCards,
      buildingBlockCards,
      releaseDragDropBuildingBlocks,
      isFixedLayout,
    ],
  );

  const groupedCards = useMemo(() => groupWidgetCardsByTags(cards), [cards]);
  const boardWidgetCard = useMemo(
    () =>
      cards.find(
        (card) => card.type === WidgetFactory.widgetTypes.BOARD_MODAL_WIDGET,
      ),
    [cards],
  );

  const moduleWidgetCard: WidgetCardProps | undefined = useMemo(() => {
    const config = WidgetFactory.widgetConfigMap.get(
      WidgetFactory.widgetTypes.MODULE_INSTANCE_WIDGET,
    );
    if (!config) {
      return undefined;
    }
    return {
      key: config.key,
      type: config.type,
      rows: config.rows || 8,
      columns: config.columns || 16,
      displayName: config.displayName || "Module Instance",
      icon: config.iconSVG || "",
      thumbnail: config.thumbnailSVG,
      isBeta: false,
      tags: config.tags || [],
      isSearchWildcard: false,
    };
  }, []);

  return {
    groupedCards,
    cards,
    entityLoading,
    modules,
    boardWidgetCard,
    moduleWidgetCard,
  };
};
