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
`;

const ContentWrapper = styled.div<{ $isReadOnly?: boolean }>`
  width: 100%;
  height: 100%;

  /* isReadOnly 모드에서 내부 위젯 선택/드래그/리사이즈만 방지 */
  ${(props) =>
    props.$isReadOnly &&
    `
    /*
     * 내부 위젯의 선택/드래그 관련 요소만 비활성화
     * 나머지는 모두 상호작용 가능하게 유지
     */

    /* 위젯 선택/드래그 담당 요소 비활성화 */
    & .positioned-widget > .widget-component-boundary-layer {
      pointer-events: none !important;
    }

    /* 위젯 이름 라벨 숨기기 */
    & .t--widget-name {
      display: none !important;
    }

    /* 리사이즈 핸들 숨기기 */
    & .t--resizable-handle,
    & .visibility-container {
      display: none !important;
      pointer-events: none !important;
    }

    /* 드래그 핸들 비활성화 */
    & [class*="drag-handle"],
    & [data-testid*="drag"] {
      pointer-events: none !important;
    }
  `}
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
      <ContentWrapper $isReadOnly={isReadOnly}>{children}</ContentWrapper>
    </StyledContainer>
  );
}

export default PackageModuleComponent;
