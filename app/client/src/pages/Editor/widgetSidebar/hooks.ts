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
import { usePackageModules } from "./usePackageModules";

/**
 * Custom hook for managing UI explorer items including widgets and building blocks.
 * @returns Object containing cards, grouped cards and entity loading states.
 */
export const useUIExplorerItems = () => {
  const releaseDragDropBuildingBlocks = useFeatureFlag(
    FEATURE_FLAG.release_drag_drop_building_blocks_enabled,
  );
  const isFixedLayout = useSelector(isFixedLayoutSelector);
  const dispatch = useDispatch();
  // check if entities have loaded
  const isBuildingBlocksLoaded = useSelector(templatesCountSelector) > 0;

  // Package 모듈 로드 (API에서 비동기 로드)
  const { isLoading: isModulesLoading, packageModules } = usePackageModules();

  const [entityLoading, setEntityLoading] = useState<
    Partial<Record<WidgetTags, boolean>>
  >({
    "Building Blocks": releaseDragDropBuildingBlocks
      ? !isBuildingBlocksLoaded
      : false,
    [WIDGET_TAGS.PACKAGES]: true, // API에서 로드 중
  });

  // Package 모듈 로딩 상태 업데이트
  useEffect(() => {
    setEntityLoading((prev) => ({
      ...prev,
      [WIDGET_TAGS.PACKAGES]: isModulesLoading,
    }));
  }, [isModulesLoading]);
  const widgetCards = useSelector(getWidgetCards);
  const buildingBlockCards = useSelector(getBuildingBlockExplorerCards);

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

  const cards = useMemo(
    () => [
      ...widgetCards,
      ...(isFixedLayout && releaseDragDropBuildingBlocks
        ? buildingBlockCards
        : []),
      ...packageModules,
    ],
    [
      widgetCards,
      buildingBlockCards,
      releaseDragDropBuildingBlocks,
      isFixedLayout,
      packageModules,
    ],
  );

  const groupedCards = useMemo(() => groupWidgetCardsByTags(cards), [cards]);

  return {
    groupedCards,
    cards,
    entityLoading,
  };
};
