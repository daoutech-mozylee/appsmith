/**
 * ModuleNotFoundFallback - 모듈 미발견 시 표시되는 폴백 UI
 *
 * 레지스트리에서 모듈을 찾을 수 없을 때 사용자에게 명확한 에러 상태를 표시합니다.
 * 편집 모드에서는 어떤 모듈이 필요한지 정보를 제공합니다.
 */

import React from "react";
import styled from "styled-components";

interface ModuleNotFoundFallbackProps {
  moduleName?: string;
  moduleUUID?: string;
  widgetId: string;
}

const FallbackContainer = styled.div`
  width: 100%;
  height: 100%;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #fef3f2;
  border: 2px dashed #f04438;
  border-radius: 8px;
  padding: 24px;
  box-sizing: border-box;
`;

const IconWrapper = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #fee4e2;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
`;

const ErrorIcon = styled.svg`
  width: 24px;
  height: 24px;
  color: #f04438;
`;

const Title = styled.h3`
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #b42318;
  text-align: center;
`;

const Description = styled.p`
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #d92d20;
  text-align: center;
  line-height: 1.5;
`;

const ModuleInfo = styled.div`
  background-color: #ffffff;
  border: 1px solid #fecdca;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  color: #7a271a;
  font-family: monospace;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

function ModuleNotFoundFallback({
  moduleName,
  moduleUUID,
  widgetId,
}: ModuleNotFoundFallbackProps) {
  return (
    <FallbackContainer data-testid={`module-not-found-${widgetId}`}>
      <IconWrapper>
        <ErrorIcon
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </ErrorIcon>
      </IconWrapper>
      <Title>모듈을 찾을 수 없습니다</Title>
      <Description>
        요청한 모듈이 레지스트리에 등록되어 있지 않습니다.
        <br />
        모듈 JSON 파일이 올바른 위치에 있는지 확인해주세요.
      </Description>
      {(moduleName || moduleUUID) && (
        <ModuleInfo>
          {moduleName && <>모듈: {moduleName}</>}
          {moduleName && moduleUUID && " | "}
          {moduleUUID && <>UUID: {moduleUUID.slice(0, 8)}...</>}
        </ModuleInfo>
      )}
    </FallbackContainer>
  );
}

export default ModuleNotFoundFallback;
