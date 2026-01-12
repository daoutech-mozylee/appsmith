import type { WidgetTags } from "constants/WidgetConstants";
import {
  SUGGESTED_WIDGETS_ORDER,
  WIDGET_TAGS,
  initialEntityCountForExplorerTag,
} from "constants/WidgetConstants";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleHeader,
  Spinner,
  Text,
  Flex,
} from "@appsmith/ads";
import { sortBy } from "lodash";
import React, { useState, useCallback } from "react";
import type { WidgetCardProps } from "widgets/BaseWidget";
import SeeMoreButton from "./SeeMoreButton";
import styled from "styled-components";
import { EDITOR_PANE_TEXTS, createMessage } from "ee/constants/messages";
import WidgetCard from "./WidgetCard";
import { ModuleImportModal } from "components/ModuleImport";
import { ModuleRegistry } from "utils/ModuleRegistry";

const LoadingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 8px 0px;
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 30px 0px;
`;

interface Props {
  tag: string;
  cards: WidgetCardProps[];
  isLoading: boolean;
  onModulesUpdated?: () => void;
}

const UIEntityTagGroup = (props: Props) => {
  const { cards, isLoading, onModulesUpdated, tag } = props;
  const [showFullItems, setShowFullItems] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const toggleShowFullItems = useCallback(() => {
    setShowFullItems((prev) => !prev);
  }, []);

  // Import 버튼 클릭 핸들러
  const handleImportClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Collapsible 토글 방지
    setShowImportModal(true);
  }, []);

  // Import 모달 닫기 핸들러
  const handleCloseImportModal = useCallback(() => {
    setShowImportModal(false);
  }, []);

  // Import 성공 핸들러
  const handleImportSuccess = useCallback(() => {
    // 레지스트리 클리어 후 다시 로드
    ModuleRegistry.clear();
    ModuleRegistry.initFromApi().then(() => {
      onModulesUpdated?.();
      // 페이지 새로고침으로 모듈 목록 갱신
      window.location.reload();
    });
  }, [onModulesUpdated]);

  // Packages 탭인지 확인
  const isPackagesTag = tag === WIDGET_TAGS.PACKAGES;
  const noOfItemsToRender = showFullItems
    ? cards.length
    : initialEntityCountForExplorerTag[tag as WidgetTags] || cards.length;

  if (isLoading) {
    return (
      <LoadingWrapper key={tag}>
        <CollapsibleHeader arrowPosition="start">
          <Text
            className="select-none"
            color="var(--ads-v2-color-gray-600)"
            kind="heading-xs"
          >
            {tag}
          </Text>
        </CollapsibleHeader>
        <LoadingContainer>
          <Spinner size="md" />
          <Text
            className="select-none"
            color="var(--ads-v2-color-gray-600)"
            kind="body-m"
          >
            {createMessage(EDITOR_PANE_TEXTS.loading_building_blocks)}
          </Text>
        </LoadingContainer>
      </LoadingWrapper>
    );
  }

  return (
    <>
      <Collapsible
        className={`pb-2 widget-tag-collapsible widget-tag-collapsible-${tag
          .toLowerCase()
          .replace(/ /g, "-")}`}
        isOpen
        key={tag}
      >
        <CollapsibleHeader arrowPosition="start">
          <Flex
            alignItems="center"
            gap="spaces-2"
            justifyContent="space-between"
            width="100%"
          >
            <Text
              className="select-none"
              color="var(--ads-v2-color-gray-600)"
              kind="heading-xs"
            >
              {tag}
            </Text>
            {isPackagesTag && (
              <Button
                kind="tertiary"
                onClick={handleImportClick}
                size="sm"
                startIcon="upload-cloud"
              >
                Import
              </Button>
            )}
          </Flex>
        </CollapsibleHeader>
        <CollapsibleContent>
          <div
            className="grid items-stretch grid-cols-3 gap-x-1 gap-y-1 justify-items-stretch"
            data-testid="t--ui-entity-tag-group"
          >
            {tag === WIDGET_TAGS.SUGGESTED_WIDGETS
              ? sortBy(
                  cards,
                  (widget) => SUGGESTED_WIDGETS_ORDER[widget.type],
                ).map((card, index) => (
                  <WidgetCard details={card} key={`${card.key}${index}`} />
                ))
              : cards
                  .slice(0, noOfItemsToRender)
                  .map((card, index) => (
                    <WidgetCard details={card} key={`${card.key}${index}`} />
                  ))}
          </div>
          <SeeMoreButton
            hidden={noOfItemsToRender >= cards.length && !showFullItems}
            showSeeLess={showFullItems}
            toggleSeeMore={toggleShowFullItems}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Module Import Modal */}
      {isPackagesTag && (
        <ModuleImportModal
          isOpen={showImportModal}
          onClose={handleCloseImportModal}
          onSuccess={handleImportSuccess}
        />
      )}
    </>
  );
};

export default UIEntityTagGroup;
