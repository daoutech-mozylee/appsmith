import React from "react";
import type { BoardUiModuleSummary } from "api/ModuleApi";
import CardList from "pages/Applications/CardList";
import { PaddingWrapper } from "pages/Applications/CommonElements";
import styled from "styled-components";
import { Button, Icon, Text } from "@appsmith/ads";
import history from "utils/history";
import { moduleEditorURL } from "ee/RouteBuilder";

interface ModulesCardListProps {
  isMobile?: boolean;
  isLoading?: boolean;
  modules: BoardUiModuleSummary[];
  workspaceId: string;
}

const ModuleCardContainer = styled.div`
  border-radius: var(--ads-v2-border-radius);
  border: 1px solid var(--ads-v2-color-border);
  background: var(--ads-v2-color-bg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ModuleCardBody = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
`;

const ModuleCardContent = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
`;

const ModuleMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 40px 0;
`;

function ModuleCard({ module }: { module: BoardUiModuleSummary }) {
  const moduleId = module.id;
  const moduleName =
    module.unpublishedModule?.name ||
    module.name ||
    module.moduleUUID ||
    "Untitled module";

  const handleEdit = () => {
    if (!moduleId) {
      return;
    }

    history.push(moduleEditorURL({ moduleId }));
  };

  return (
    <ModuleCardContainer>
      <ModuleCardBody>
        <ModuleCardContent>
          <Icon name="widget" size="md" />
          <ModuleMeta>
            <Text className="!font-semibold" kind="heading-s">
              {moduleName}
            </Text>
            {module.packageId && (
              <Text kind="body-s" renderAs="p" $truncate>
                Package: {module.packageId}
              </Text>
            )}
            {module.moduleUUID && (
              <Text kind="body-s" renderAs="p" $truncate>
                UUID: {module.moduleUUID}
              </Text>
            )}
          </ModuleMeta>
        </ModuleCardContent>
        <Button
          className="t--module-edit-button"
          isDisabled={!moduleId}
          kind="secondary"
          onClick={handleEdit}
          size="md"
          startIcon="edit"
        >
          Edit
        </Button>
      </ModuleCardBody>
    </ModuleCardContainer>
  );
}

function ModulesCardList({
  isLoading,
  isMobile,
  modules,
  workspaceId,
}: ModulesCardListProps) {
  const hasModules = modules.length > 0;

  return (
    <CardList isLoading={isLoading} isMobile={isMobile} title="Modules">
      {modules.map((module) => (
        <PaddingWrapper isMobile={isMobile} key={module.id}>
          <ModuleCard module={module} />
        </PaddingWrapper>
      ))}
      {!hasModules && !isLoading && (
        <EmptyState className="t--modules-empty-state">
          <Icon name="widget" size="lg" />
          <Text kind="body-m" renderAs="p">
            No modules found in this workspace.
          </Text>
          <Text kind="body-s" renderAs="p">
            Use the create menu to add a new module to workspace {workspaceId}.
          </Text>
        </EmptyState>
      )}
    </CardList>
  );
}

export default ModulesCardList;
