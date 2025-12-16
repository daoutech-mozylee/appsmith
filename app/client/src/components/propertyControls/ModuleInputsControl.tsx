import React from "react";
import styled from "styled-components";
import type { ControlProps } from "./BaseControl";
import BaseControl from "./BaseControl";
import { InputText } from "./InputTextControl";
import type {
  ModuleInputSection,
  ModuleInputDefinition,
} from "constants/PackageModuleConstants";
import { getInputsFormByModuleUUID } from "pages/Editor/widgetSidebar/usePackageModules";

const InputsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const InputLabel = styled.label`
  font-size: 12px;
  font-weight: 500;
  color: var(--ads-v2-color-fg);
`;

const HelpText = styled.span`
  font-size: 11px;
  color: var(--ads-v2-color-fg-muted);
`;

/**
 * ModuleInputsControl
 *
 * 패키지 모듈 위젯의 inputsForm을 기반으로 동적으로 입력 필드를 렌더링하는 커스텀 컨트롤
 * inputsForm의 각 child에 대해 INPUT_TEXT 컨트롤을 생성하여 표시
 */
export interface ModuleInputsControlProps extends ControlProps {
  // widgetProperties에서 inputsForm을 읽어옴
}

class ModuleInputsControl extends BaseControl<ModuleInputsControlProps> {
  /**
   * inputsForm에서 모든 input children을 플랫하게 추출
   */
  getAllInputChildren(): ModuleInputDefinition[] {
    const { widgetProperties } = this.props;
    let inputsForm: ModuleInputSection[] | undefined =
      widgetProperties?.inputsForm;

    // inputsForm이 없으면 moduleUUID로 조회
    if (
      (!inputsForm || !Array.isArray(inputsForm) || inputsForm.length === 0) &&
      widgetProperties?.moduleUUID
    ) {
      inputsForm = getInputsFormByModuleUUID(widgetProperties.moduleUUID);
    }

    if (!inputsForm || !Array.isArray(inputsForm)) {
      return [];
    }

    // 모든 섹션에서 children 추출
    const allChildren: ModuleInputDefinition[] = [];

    for (const section of inputsForm) {
      if (section.children && Array.isArray(section.children)) {
        allChildren.push(...section.children);
      }
    }

    return allChildren;
  }

  /**
   * 특정 input의 현재 값 가져오기
   */
  getInputValue(inputDef: ModuleInputDefinition): string {
    const { widgetProperties } = this.props;

    // propertyName이 "inputs.xxx" 형식인 경우
    if (inputDef.propertyName) {
      const parts = inputDef.propertyName.split(".");

      if (parts[0] === "inputs" && parts.length > 1) {
        const inputName = parts[1];
        const value = widgetProperties?.inputs?.[inputName];

        if (value !== undefined) {
          return typeof value === "string" ? value : JSON.stringify(value);
        }
      }
    }

    // label로 찾기
    const inputName = inputDef.label || inputDef.name;

    if (inputName) {
      const value = widgetProperties?.inputs?.[inputName];

      if (value !== undefined) {
        return typeof value === "string" ? value : JSON.stringify(value);
      }
    }

    // 기본값 반환
    return inputDef.defaultValue !== undefined
      ? String(inputDef.defaultValue)
      : "";
  }

  /**
   * input 값 변경 핸들러
   */
  handleInputChange = (inputDef: ModuleInputDefinition) => {
    return (event: React.ChangeEvent<HTMLTextAreaElement> | string) => {
      const value = typeof event === "string" ? event : event.target.value;
      const inputName = inputDef.label || inputDef.name || "";

      // "inputs.xxx" 형식의 propertyName 생성
      const propertyName = `inputs.${inputName}`;

      this.updateProperty(propertyName, value, true);
    };
  };

  render() {
    const inputChildren = this.getAllInputChildren();

    if (inputChildren.length === 0) {
      return null;
    }

    const { widgetProperties } = this.props;

    return (
      <InputsContainer>
        {inputChildren.map((inputDef, index) => {
          const inputName = inputDef.label || inputDef.name || `input_${index}`;
          const value = this.getInputValue(inputDef);
          const dataTreePath = widgetProperties?.widgetName
            ? `${widgetProperties.widgetName}.inputs.${inputName}`
            : undefined;

          return (
            <InputWrapper key={inputDef.id || index}>
              <InputLabel>{inputName}</InputLabel>
              <HelpText>모듈 내부에서 this.params.{inputName}로 접근</HelpText>
              <InputText
                dataTreePath={dataTreePath}
                label={inputName}
                onChange={this.handleInputChange(inputDef)}
                placeholder={
                  inputDef.defaultValue !== undefined
                    ? String(inputDef.defaultValue)
                    : ""
                }
                theme={this.props.theme}
                value={value}
              />
            </InputWrapper>
          );
        })}
      </InputsContainer>
    );
  }

  static getControlType() {
    return "MODULE_INPUTS_CONTROL";
  }
}

export default ModuleInputsControl;
