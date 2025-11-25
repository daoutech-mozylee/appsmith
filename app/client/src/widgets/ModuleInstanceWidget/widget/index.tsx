import React from "react";
import type { WidgetProps, WidgetState } from "widgets/BaseWidget";
import BaseWidget from "widgets/BaseWidget";
import { WIDGET_TAGS } from "constants/WidgetConstants";
import type { AutocompletionDefinitions } from "WidgetProvider/types";
import { DefaultAutocompleteDefinitions } from "widgets/WidgetUtils";
import { ValidationTypes } from "constants/WidgetValidation";
import IconSVG from "../icon.svg";
import ThumbnailSVG from "../thumbnail.svg";

export interface ModuleInstanceWidgetProps extends WidgetProps {
  moduleId?: string;
  modulePackageId?: string;
  moduleInstanceId?: string;
  moduleName?: string;
  moduleDescription?: string;
}

class ModuleInstanceWidget extends BaseWidget<
  ModuleInstanceWidgetProps,
  WidgetState
> {
  static type = "MODULE_INSTANCE_WIDGET";

  static getConfig() {
    return {
      name: "Module Instance",
      iconSVG: IconSVG,
      thumbnailSVG: ThumbnailSVG,
      tags: [WIDGET_TAGS.MODULES],
      hideCard: true,
      searchTags: ["module"],
    };
  }

  static getDefaults() {
    return {
      rows: 10,
      columns: 24,
      widgetName: "ModuleInstance",
      version: 1,
      isVisible: true,
      animateLoading: true,
    };
  }

  static getAutocompleteDefinitions(): AutocompletionDefinitions {
    return {
      "!doc": "Represents a UI module instance placeholder",
      "!url": "https://docs.appsmith.com",
      moduleId: "string",
      modulePackageId: "string",
      moduleInstanceId: "string",
      moduleName: "string",
      moduleDescription: "string",
      isVisible: DefaultAutocompleteDefinitions.isVisible,
    };
  }

  static getPropertyPaneContentConfig() {
    return [
      {
        sectionName: "Module",
        children: [
          {
            propertyName: "moduleName",
            label: "Name",
            helpText: "Display name of the module instance",
            controlType: "INPUT_TEXT",
            isBindProperty: false,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
          },
          {
            propertyName: "moduleDescription",
            label: "Description",
            helpText: "Optional description for reference",
            controlType: "INPUT_TEXT",
            isBindProperty: false,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
          },
          {
            propertyName: "moduleInstanceId",
            label: "Instance ID",
            controlType: "INPUT_TEXT",
            isBindProperty: false,
            isTriggerProperty: false,
            isDisabled: true,
          },
        ],
      },
    ];
  }

  getWidgetView() {
    return (
      <div
        className="t--module-instance-widget"
        style={{
          border: "1px dashed var(--ads-v2-color-border)",
          borderRadius: "6px",
          padding: "12px",
          background: "var(--ads-v2-color-bg-subtle)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: this.props.moduleDescription ? "4px" : 0,
          }}
        >
          {this.props.moduleName || this.props.widgetName || "Module Instance"}
        </div>
        {this.props.moduleDescription ? (
          <div
            style={{
              fontSize: "12px",
              color: "var(--ads-v2-color-fg-muted)",
              marginBottom: "6px",
            }}
          >
            {this.props.moduleDescription}
          </div>
        ) : null}
        <div
          style={{
            fontSize: "12px",
            color: "var(--ads-v2-color-fg-muted)",
          }}
        >
          {this.props.moduleInstanceId
            ? `Instance: ${this.props.moduleInstanceId}`
            : "Module instance placeholder"}
        </div>
      </div>
    );
  }
}

export default ModuleInstanceWidget;
