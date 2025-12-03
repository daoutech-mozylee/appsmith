import React from "react";
import styled from "styled-components";

export type PackageModuleContainerStyle = "card" | "none";

interface PackageModuleComponentProps {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  boxShadow?: string;
  containerStyle?: PackageModuleContainerStyle;
  children?: React.ReactNode;
  widgetId: string;
  moduleName?: string;
  packageName?: string;
  isReadOnly?: boolean;
}

const StyledContainer = styled.div<{
  $backgroundColor?: string;
  $borderColor?: string;
  $borderWidth?: string;
  $borderRadius?: string;
  $boxShadow?: string;
  $isReadOnly?: boolean;
}>`
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: ${(props) => props.$backgroundColor || "#FFFFFF"};
  border: ${(props) => props.$borderWidth || "1"}px solid
    ${(props) => props.$borderColor || "#E0DEDE"};
  border-radius: ${(props) => props.$borderRadius || "4px"};
  box-shadow: ${(props) => props.$boxShadow || "none"};

  ${(props) =>
    props.$isReadOnly &&
    `
    &::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: all;
      z-index: 1;
    }
  `}
`;

const ModuleHeader = styled.div`
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(151, 71, 255, 0.1);
  color: #9747ff;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 2;
  pointer-events: none;
`;

const ContentWrapper = styled.div<{ $isReadOnly?: boolean }>`
  width: 100%;
  height: 100%;
  pointer-events: ${(props) => (props.$isReadOnly ? "none" : "auto")};
`;

function PackageModuleComponent(props: PackageModuleComponentProps) {
  const {
    backgroundColor,
    borderColor,
    borderRadius,
    borderWidth,
    boxShadow,
    children,
    isReadOnly = true,
    moduleName,
    packageName,
    widgetId,
  } = props;

  return (
    <StyledContainer
      $backgroundColor={backgroundColor}
      $borderColor={borderColor}
      $borderRadius={borderRadius}
      $borderWidth={borderWidth}
      $boxShadow={boxShadow}
      $isReadOnly={isReadOnly}
      data-testid={`package-module-${widgetId}`}
      id={`package-module-${widgetId}`}
    >
      {moduleName && (
        <ModuleHeader>
          {packageName ? `${packageName} / ${moduleName}` : moduleName}
        </ModuleHeader>
      )}
      <ContentWrapper $isReadOnly={isReadOnly}>{children}</ContentWrapper>
    </StyledContainer>
  );
}

export default PackageModuleComponent;
