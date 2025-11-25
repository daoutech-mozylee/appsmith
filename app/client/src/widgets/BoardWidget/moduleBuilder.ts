import cloneDeep from "lodash/cloneDeep";
import { v4 as uuidv4 } from "uuid";
import { MAIN_CONTAINER_WIDGET_ID } from "constants/WidgetConstants";
import { generateReactKey } from "utils/generators";
import type {
  ModuleCreateRequest,
  ModuleInstanceCreateRequest,
  ModulePackageCreateRequest,
} from "api/ModuleApi";
import boardModalTemplate from "./metadata.json";

interface BuildBoardModulePayloadOptions {
  workspaceId: string;
  pageId: string;
  widgetId: string;
  widgetName?: string;
}

export interface BoardModuleApiPayload {
  packagePayload: ModulePackageCreateRequest;
  modulePayload: ModuleCreateRequest;
  instancePayload: ModuleInstanceCreateRequest;
}

const getBoardModuleNames = (widgetName?: string) => {
  const sanitizedBase =
    widgetName?.replace(/[^a-zA-Z0-9]/g, "") || "BoardModule";
  const suffix = generateReactKey({ prefix: "module" }).slice(-5);
  const moduleName = `${sanitizedBase}_${suffix}`;

  return {
    moduleName,
    packageName: `${moduleName}_Package`,
    instanceName: `${moduleName}_Instance`,
  };
};

const buildModuleDsl = () => {
  const modal = boardModalTemplate.modal
    ? cloneDeep(boardModalTemplate.modal)
    : undefined;
  const triggerButton = boardModalTemplate.openButton
    ? cloneDeep(boardModalTemplate.openButton)
    : undefined;

  const children = [];

  if (triggerButton) {
    triggerButton.parentId = MAIN_CONTAINER_WIDGET_ID;
    children.push(triggerButton);
  }

  if (modal) {
    modal.parentId = MAIN_CONTAINER_WIDGET_ID;
    children.push(modal);
  }

  return {
    widgetName: "MainContainer",
    backgroundColor: "none",
    rightColumn: 64,
    snapColumns: 64,
    detachFromLayout: true,
    widgetId: MAIN_CONTAINER_WIDGET_ID,
    topRow: 0,
    bottomRow: 84,
    parentRowSpace: 1,
    type: "CANVAS_WIDGET",
    canExtend: true,
    version: 1,
    minHeight: 84,
    children,
  };
};

export const buildBoardModuleApiPayload = (
  options: BuildBoardModulePayloadOptions,
): BoardModuleApiPayload => {
  const names = getBoardModuleNames(options.widgetName);
  const moduleUUID = uuidv4();
  const moduleDsl = buildModuleDsl();

  const packagePayload: ModulePackageCreateRequest = {
    name: names.packageName,
    workspaceId: options.workspaceId,
    icon: "package",
    color: "#9747FF1A",
  };

  const modulePayload: ModuleCreateRequest = {
    packageId: "",
    workspaceId: options.workspaceId,
    unpublishedModule: {
      name: names.moduleName,
      moduleUUID,
      layouts: [
        {
          dsl: moduleDsl,
          layoutOnLoadActions: [],
          layoutOnLoadActionErrors: [],
        },
      ],
      inputsForm: [
        {
          id: generateReactKey({ prefix: "module-input" }),
          sectionName: "",
          children: [],
        },
      ],
      outputsForm: [
        {
          id: generateReactKey({ prefix: "module-output" }),
          sectionName: "",
          children: [],
        },
      ],
    },
  };

  const instancePayload: ModuleInstanceCreateRequest = {
    sourceModuleId: "",
    contextId: options.pageId,
    contextType: "PAGE",
    name: names.instanceName,
    widgetId: options.widgetId,
    inputBindings: {},
    outputBindings: {},
  };

  return {
    packagePayload,
    modulePayload,
    instancePayload,
  };
};
