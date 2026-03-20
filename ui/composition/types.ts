import { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";
import { WorkflowService } from "../services/WorkflowService";
import { NodeService } from "../services/NodeService";
import { ModelService } from "../services/ModelService";
import { WorkflowStore } from "../state/WorkflowStore";
import { NodeStore } from "../state/NodeStore";
import { ModelStore } from "../state/ModelStore";
import { RuntimeConsoleStore } from "../state/RuntimeConsoleStore";
import type { IPythonRuntimeManager } from "../../application/ports/interfaces/IPythonRuntimeManager";
import { ToolService } from "../services/ToolService";
import { ToolStore } from "../state/ToolStore";
import { McpService } from "../services/McpService";
import { McpStore } from "../state/McpStore";
import { WorkflowProjectionService } from "../../application/projection/WorkflowProjectionService";
import { ContextService } from "../services/ContextService";
import { ContextStore } from "../state/ContextStore";
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
  readonly pythonRuntimeManager: IPythonRuntimeManager;
  readonly toolService: ToolService;
  readonly toolStore: ToolStore;
  readonly mcpService: McpService;
  readonly mcpStore: McpStore;
  readonly contextService: ContextService;
  readonly contextStore: ContextStore;
  readonly workflowProjectionService: WorkflowProjectionService;
  readonly settingsStore: UiSettingsStore;
}

export interface CreateUiDependenciesOptions {
  readonly config?: AppRuntimeConfig;
  readonly settingsStorage?: UiSettingsStorage;
}
