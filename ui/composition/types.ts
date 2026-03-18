import { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";
import { WorkflowService } from "../services/WorkflowService";
import { NodeService } from "../services/NodeService";
import { ModelService } from "../services/ModelService";
import { WorkflowStore } from "../state/WorkflowStore";
import { NodeStore } from "../state/NodeStore";
import { ModelStore } from "../state/ModelStore";
import { RuntimeConsoleStore } from "../state/RuntimeConsoleStore";
import { ToolService } from "../services/ToolService";
import { ToolStore } from "../state/ToolStore";
import { WorkflowProjectionService } from "../../application/projection/WorkflowProjectionService";
import type { UiSettingsStorage } from "../settings/UiSettingsStore";
import { UiSettingsStore } from "../settings/UiSettingsStore";

export interface UiDependencies {
  readonly config: AppRuntimeConfig;
  readonly workflowStore: WorkflowStore;
  readonly nodeStore: NodeStore;
  readonly modelStore: ModelStore;
  readonly workflowService: WorkflowService;
  readonly nodeService: NodeService;
  readonly modelService: ModelService;
  readonly runtimeConsoleStore: RuntimeConsoleStore;
  readonly toolService: ToolService;
  readonly toolStore: ToolStore;
  readonly workflowProjectionService: WorkflowProjectionService;
  readonly settingsStore: UiSettingsStore;
}

export interface CreateUiDependenciesOptions {
  readonly config?: AppRuntimeConfig;
  readonly settingsStorage?: UiSettingsStorage;
}
