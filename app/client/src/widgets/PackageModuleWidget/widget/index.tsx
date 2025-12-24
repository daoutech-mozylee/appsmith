import React from "react";
import { compact, map, sortBy } from "lodash";
import type { DerivedPropertiesMap } from "WidgetProvider/factory/types";
import PackageModuleComponent from "../component";
import type { WidgetProps, WidgetState } from "widgets/BaseWidget";
import BaseWidget from "widgets/BaseWidget";
import { ValidationTypes } from "constants/WidgetValidation";
import type { SetterConfig, Stylesheet } from "entities/AppTheming";
import { DefaultAutocompleteDefinitions } from "widgets/WidgetUtils";
import {
  type AnvilConfig,
  type AutocompletionDefinitions,
  type AutoLayoutConfig,
  type DSLWidget,
  type WidgetBaseConfiguration,
  type WidgetDefaultProps,
} from "WidgetProvider/types";
import { WIDGET_TAGS } from "constants/WidgetConstants";
import IconSVG from "../icon.svg";
import ThumbnailSVG from "../thumbnail.svg";
import { ButtonBoxShadowTypes } from "components/constants";
import { Colors } from "constants/Colors";
import { FILL_WIDGET_MIN_WIDTH } from "constants/minWidthConstants";
import {
  FlexVerticalAlignment,
  Positioning,
  ResponsiveBehavior,
} from "layoutSystems/common/utils/constants";
import {
  PACKAGE_MODULE_WIDGET_TYPE,
  type ModuleInputSection,
  type ModuleOutputSection,
  type ModuleInstanceInputs,
} from "constants/PackageModuleConstants";
import { getInputsFormByModuleUUID } from "pages/Editor/widgetSidebar/usePackageModules";
import { DynamicHeight } from "utils/WidgetFeatures";
import { RenderModes } from "constants/WidgetConstants";
import type { PackageModuleContainerStyle } from "../component";
import { renderAppsmithCanvas } from "layoutSystems/CanvasFactory";
import WidgetsMultiSelectBox from "layoutSystems/fixedlayout/common/widgetGrouping/WidgetsMultiSelectBox";
import { getSnappedGrid } from "sagas/WidgetOperationUtils";

export class PackageModuleWidget extends BaseWidget<
  PackageModuleWidgetProps,
  WidgetState
> {
  static type = PACKAGE_MODULE_WIDGET_TYPE;

  constructor(props: PackageModuleWidgetProps) {
    super(props);
    this.renderChildWidget = this.renderChildWidget.bind(this);
  }

  // inputs 동기화는 ModuleInstanceSagas의 handleWidgetPropertyRequestForModuleInputs에서 처리
  // componentDidUpdate는 더 이상 필요하지 않음 - selector가 위젯 props에서 직접 읽음

  static getConfig(): WidgetBaseConfiguration {
    return {
      name: "Package Module",
      iconSVG: IconSVG,
      thumbnailSVG: ThumbnailSVG,
      tags: [WIDGET_TAGS.PACKAGES],
      isCanvas: true, // isCanvas를 true로 변경 - 내부 위젯 렌더링 필요
      hideCard: true, // 사이드바 기본 목록에서 숨김 (Package 섹션에서만 노출)
      searchTags: ["module", "package", "component"],
    };
  }

  static getFeatures() {
    return {
      dynamicHeight: {
        sectionIndex: 0,
        active: true, // Auto Height 활성화 - 내부 위젯에 맞게 조절
        defaultValue: DynamicHeight.AUTO_HEIGHT,
      },
    };
  }

  static getDefaults(): WidgetDefaultProps {
    return {
      backgroundColor: "#FFFFFF",
      rows: 40, // 40 rows = 약 400px 높이
      columns: 24,
      widgetName: "PackageModule",
      containerStyle: "card",
      borderColor: Colors.GREY_5,
      borderWidth: "1",
      boxShadow: ButtonBoxShadowTypes.NONE,
      animateLoading: true,
      children: [],
      // Blueprint: 내부 CANVAS_WIDGET 생성
      blueprint: {
        view: [
          {
            type: "CANVAS_WIDGET",
            position: { top: 0, left: 0 },
            props: {
              containerStyle: "none",
              canExtend: false,
              detachFromLayout: true,
              children: [],
            },
          },
        ],
      },
      version: 1,
      flexVerticalAlignment: FlexVerticalAlignment.Stretch,
      responsiveBehavior: ResponsiveBehavior.Fill,
      minWidth: FILL_WIDGET_MIN_WIDTH,
      // 모듈 전용 속성
      isModuleWidget: true,
      // isReadOnly는 renderMode에 따라 동적으로 결정됨 (getWidgetView 참조)
      moduleUUID: "",
      packageUUID: "",
      moduleName: "",
      packageName: "",
      // 모듈 DSL 데이터 (드래그 시 전달됨)
      moduleDSL: null,
      // 모듈 인스턴스 정보 (페이지 로드 시 복원용)
      moduleInstanceId: "",
      moduleInstanceData: null,
      // Input 값 (페이지에서 모듈로 전달하는 파라미터)
      inputs: {},
      // Input/Output 폼 정의 (모듈 JSON에서 가져옴)
      inputsForm: [],
      outputsForm: [],
    };
  }

  static getAutoLayoutConfig(): AutoLayoutConfig {
    return {
      widgetSize: [
        {
          viewportMinWidth: 0,
          configuration: () => {
            return {
              minWidth: "280px",
              minHeight: "100px",
            };
          },
        },
      ],
      disableResizeHandles: () => ({
        vertical: false, // 세로 크기 조절 허용
        horizontal: false, // 가로 크기 조절 허용
      }),
    };
  }

  static getAnvilConfig(): AnvilConfig | null {
    return {
      isLargeWidget: false,
      widgetSize: {
        maxHeight: {},
        maxWidth: {},
        minHeight: { base: "100px" },
        minWidth: { base: "280px" },
      },
    };
  }

  static getAutocompleteDefinitions(): AutocompletionDefinitions {
    return {
      "!doc": "Package Module Widget - A reusable UI component from a package",
      "!url": "https://docs.appsmith.com/widget-reference/package-module",
      isVisible: DefaultAutocompleteDefinitions.isVisible,
      moduleName: {
        "!type": "string",
        "!doc": "The name of the module",
      },
      packageName: {
        "!type": "string",
        "!doc": "The name of the package",
      },
      inputs: {
        "!type": "object",
        "!doc":
          "Input values passed to the module. Access inside module via this.params.inputName",
      },
      outputs: {
        "!type": "object",
        "!doc":
          "Output values exposed from the module. Access from parent page via ModuleWidget.outputs.outputName",
      },
    };
  }

  static getSetterConfig(): SetterConfig | null {
    return {
      __setters: {
        setVisibility: {
          path: "isVisible",
          type: "boolean",
        },
      },
    };
  }

  static getPropertyPaneContentConfig() {
    /**
     * inputsForm에 하나라도 input이 있는지 확인
     */
    const hasAnyInputs = (props: PackageModuleWidgetProps): boolean => {
      let inputsForm = props.inputsForm;

      // inputsForm이 없거나 빈 배열이면 moduleUUID로 조회
      if (
        (!inputsForm ||
          !Array.isArray(inputsForm) ||
          inputsForm.length === 0) &&
        props.moduleUUID
      ) {
        inputsForm = getInputsFormByModuleUUID(props.moduleUUID);
      }

      if (!inputsForm || !Array.isArray(inputsForm)) {
        return false;
      }

      // 섹션 내의 children 수 확인
      for (const section of inputsForm) {
        if (
          section.children &&
          Array.isArray(section.children) &&
          section.children.length > 0
        ) {
          return true;
        }
      }

      return false;
    };

    return [
      {
        sectionName: "Module Info",
        children: [
          {
            propertyName: "moduleName",
            label: "Module name",
            controlType: "INPUT_TEXT",
            isBindProperty: false,
            isTriggerProperty: false,
            isDisabled: true, // 읽기 전용
          },
          {
            propertyName: "packageName",
            label: "Package name",
            controlType: "INPUT_TEXT",
            isBindProperty: false,
            isTriggerProperty: false,
            isDisabled: true, // 읽기 전용
          },
        ],
      },
      {
        sectionName: "Module Inputs",
        // 섹션 전체를 inputsForm이 있는 모듈에만 표시
        hidden: (props: PackageModuleWidgetProps) => !hasAnyInputs(props),
        children: [
          {
            // MODULE_INPUTS_CONTROL: inputsForm을 읽어 동적으로 입력 필드 렌더링
            propertyName: "inputs",
            label: "",
            controlType: "MODULE_INPUTS_CONTROL",
            isBindProperty: false,
            isTriggerProperty: false,
            // widgetProperties에 inputsForm, moduleUUID, dynamicPropertyPathList를 포함시키기 위해 dependencies 추가
            dependencies: [
              "inputsForm",
              "moduleUUID",
              "inputs",
              "dynamicPropertyPathList",
            ],
          },
        ],
      },
      {
        sectionName: "General",
        children: [
          {
            helpText: "Controls the visibility of the widget",
            propertyName: "isVisible",
            label: "Visible",
            controlType: "SWITCH",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            helpText: "Enables scrolling for content inside the widget",
            propertyName: "shouldScrollContents",
            label: "Scroll contents",
            controlType: "SWITCH",
            isBindProperty: false,
            isTriggerProperty: false,
          },
          {
            propertyName: "animateLoading",
            label: "Animate loading",
            controlType: "SWITCH",
            helpText: "Controls the loading of the widget",
            defaultValue: true,
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
        ],
      },
    ];
  }

  static getPropertyPaneStyleConfig() {
    return [
      {
        sectionName: "Color",
        children: [
          {
            helpText: "Use a html color name, HEX, RGB or RGBA value",
            placeholderText: "#FFFFFF / Gray / rgb(255, 99, 71)",
            propertyName: "backgroundColor",
            label: "Background color",
            controlType: "COLOR_PICKER",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
          },
          {
            helpText: "Use a html color name, HEX, RGB or RGBA value",
            placeholderText: "#FFFFFF / Gray / rgb(255, 99, 71)",
            propertyName: "borderColor",
            label: "Border color",
            controlType: "COLOR_PICKER",
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
          },
        ],
      },
      {
        sectionName: "Border and shadow",
        children: [
          {
            helpText: "Enter value for border width",
            propertyName: "borderWidth",
            label: "Border width",
            placeholderText: "Enter value in px",
            controlType: "INPUT_TEXT",
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.NUMBER },
          },
          {
            propertyName: "borderRadius",
            label: "Border radius",
            helpText: "Rounds the corners of the widget's outer border edge",
            controlType: "BORDER_RADIUS_OPTIONS",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
          },
          {
            propertyName: "boxShadow",
            label: "Box shadow",
            helpText:
              "Enables you to cast a drop shadow from the frame of the widget",
            controlType: "BOX_SHADOW_OPTIONS",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
          },
        ],
      },
    ];
  }

  static getDerivedPropertiesMap(): DerivedPropertiesMap {
    return {};
  }

  static getDefaultPropertiesMap(): Record<string, string> {
    return {};
  }

  static getMetaPropertiesMap(): Record<string, unknown> {
    return {};
  }

  static getStylesheetConfig(): Stylesheet {
    return {
      borderRadius: "{{appsmith.theme.borderRadius.appBorderRadius}}",
      boxShadow: "{{appsmith.theme.boxShadow.appBoxShadow}}",
    };
  }

  getSnapSpaces = () => {
    const { componentWidth } = this.props;
    const { snapGrid } = getSnappedGrid(this.props, componentWidth);

    return snapGrid;
  };

  // ContainerWidget과 동일한 방식으로 자식 위젯 렌더링
  renderChildWidget(childWidgetData: WidgetProps): React.ReactNode {
    const childWidget = { ...childWidgetData };

    const { componentHeight, componentWidth } = this.props;

    childWidget.rightColumn = componentWidth;
    childWidget.bottomRow = this.props.shouldScrollContents
      ? childWidget.bottomRow
      : componentHeight;
    childWidget.minHeight = componentHeight;
    childWidget.shouldScrollContents = false;
    childWidget.canExtend = this.props.shouldScrollContents;

    childWidget.parentId = this.props.widgetId;
    // Pass layout controls to children
    childWidget.positioning =
      childWidget?.positioning || this.props.positioning;
    childWidget.useAutoLayout = this.props.positioning
      ? this.props.positioning === Positioning.Vertical
      : false;

    return renderAppsmithCanvas(childWidget as WidgetProps);
  }

  renderChildren = () => {
    return map(
      // sort by row so stacking context is correct
      this.props.positioning !== Positioning.Fixed
        ? this.props.children
        : sortBy(compact(this.props.children), (child) => child.topRow),
      this.renderChildWidget,
    );
  };

  getWidgetView() {
    const {
      backgroundColor,
      borderColor,
      borderRadius,
      borderWidth,
      boxShadow,
      containerStyle,
      renderMode,
      widgetId,
    } = this.props;

    // Deploy 모드(PAGE)에서는 isReadOnly를 false로 설정하여 상호작용 활성화
    // 에디터 모드(CANVAS)에서만 isReadOnly를 true로 설정하여 내부 편집 차단
    const isReadOnly = renderMode === RenderModes.CANVAS;

    return (
      <PackageModuleComponent
        backgroundColor={backgroundColor}
        borderColor={borderColor}
        borderRadius={borderRadius}
        borderWidth={borderWidth}
        boxShadow={boxShadow}
        containerStyle={containerStyle}
        isReadOnly={isReadOnly}
        widgetId={widgetId}
      >
        <WidgetsMultiSelectBox
          {...this.getSnapSpaces()}
          noContainerOffset={false}
          widgetId={this.props.widgetId}
          widgetType={this.props.type}
        />
        {this.renderChildren()}
      </PackageModuleComponent>
    );
  }
}

// 모듈 인스턴스 데이터 타입
export interface ModuleInstanceData {
  actions: Array<{
    name: string;
    originalName: string;
    pluginType: string;
    pluginId: string;
    datasource: {
      name: string;
      pluginId: string;
      id?: string;
    };
    actionConfiguration: {
      body?: string;
      timeoutInMillisecond?: number;
      [key: string]: unknown;
    };
    executeOnLoad?: boolean;
  }>;
  jsObjects: Array<{
    name: string;
    originalName: string;
    body: string;
    variables?: unknown[];
  }>;
  // Input/Output 정의 (모듈 설정)
  inputsForm?: ModuleInputSection[];
  outputsForm?: ModuleOutputSection[];
}

export interface PackageModuleWidgetProps extends WidgetProps {
  children?: WidgetProps[];
  containerStyle?: PackageModuleContainerStyle;
  shouldScrollContents?: boolean;
  positioning?: Positioning;
  // 모듈 전용 속성
  isModuleWidget?: boolean;
  // isReadOnly는 renderMode에 따라 동적으로 결정됨 (getWidgetView 참조)
  moduleUUID?: string;
  packageUUID?: string;
  moduleName?: string;
  packageName?: string;
  // 모듈 DSL 데이터
  moduleDSL?: DSLWidget | null;
  // 모듈 인스턴스 정보 (페이지 로드 시 복원용)
  moduleInstanceId?: string;
  moduleInstanceData?: ModuleInstanceData | null;
  // Input/Output 정의 (Property Pane에서 직접 접근용)
  inputsForm?: ModuleInputSection[];
  outputsForm?: ModuleOutputSection[];
  // Input 값 (페이지에서 모듈로 전달하는 파라미터)
  inputs?: ModuleInstanceInputs;
}

export default PackageModuleWidget;
