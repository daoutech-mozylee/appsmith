import type {
  ModuleFormSection,
  ModuleLayoutPayload,
  UiModuleResponse,
} from "api/ModuleApi";
import type { CanvasWidgetsReduxState } from "ee/reducers/entityReducers/canvasWidgetsReducer";
import type { WidgetProps } from "widgets/BaseWidget";
import { nestDSL } from "@shared/dsl";
import type { DSLWidget } from "WidgetProvider/types";

export function buildModuleLayoutsFromCanvas(
  canvas: CanvasWidgetsReduxState,
  existingModule?: UiModuleResponse,
): ModuleLayoutPayload[] {
  const mainContainerId =
    existingModule?.unpublishedModule?.layouts?.[0]?.dsl?.widgetId ||
    Object.values(canvas)[0]?.widgetId;

  const rootWidget =
    mainContainerId && canvas[mainContainerId]
      ? (canvas[mainContainerId] as WidgetProps)
      : undefined;

  if (!rootWidget) {
    return existingModule?.unpublishedModule?.layouts || [];
  }

  const dsl: DSLWidget = nestDSL(rootWidget.widgetId, canvas);

  return [
    {
      ...(existingModule?.unpublishedModule?.layouts?.[0] || {}),
      dsl,
    },
  ];
}

export function extractModuleMetadata(
  moduleData?: UiModuleResponse,
): {
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  dependencyMap?: Record<string, string[]>;
  inputsForm?: ModuleFormSection[];
  outputsForm?: ModuleFormSection[];
} {
  const version = moduleData?.unpublishedModule || {};

  return {
    name: version.name,
    icon: version.icon,
    color: version.color,
    description: version.description,
    dependencyMap: version.dependencyMap,
    inputsForm: version.inputsForm,
    outputsForm: version.outputsForm,
  };
}
