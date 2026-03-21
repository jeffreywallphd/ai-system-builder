import { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";
import { WorkflowService } from "../services/WorkflowService";
import { NodeService } from "../services/NodeService";
import { ModelService } from "../services/ModelService";
import { WorkflowStore } from "../state/WorkflowStore";
import { NodeStore } from "../state/NodeStore";
import { ModelStore } from "../state/ModelStore";
import { RuntimeConsoleStore } from "../state/RuntimeConsoleStore";
import { ManagedServicesStore } from "../state/ManagedServicesStore";
import type { IPythonRuntimeManager } from "../../application/ports/interfaces/IPythonRuntimeManager";
import { ToolService } from "../services/ToolService";
import { ToolStore } from "../state/ToolStore";
import { McpService } from "../services/McpService";
import { McpStore } from "../state/McpStore";
import { WorkflowProjectionService } from "../../application/projection/WorkflowProjectionService";
import { ContextService } from "../services/ContextService";
import { TuningDatasetService } from "../services/TuningDatasetService";
import { ContextStore } from "../state/ContextStore";
import { TuningDatasetStore } from "../state/TuningDatasetStore";
import type { UiSettingsStorage } from "../settings/UiSettingsStore";
import { UiSettingsStore } from "../settings/UiSettingsStore";
import { ManagedServicesService } from "../services/ManagedServicesService";

export interface OperationalModeStatus {
  readonly configuredMode: string;
  readonly effectiveMode: string;
  readonly isDegraded: boolean;
  readonly detail: string;
}

export interface WorkflowPersistenceStatus extends OperationalModeStatus {
  readonly workflowsDirectory?: string;
  readonly indexDatabasePath?: string;
}

export interface UiOperationalStatus {
  readonly workflowPersistence: WorkflowPersistenceStatus;
  readonly execution: OperationalModeStatus;
  readonly nodeCatalog: OperationalModeStatus;
}

export interface UiDependencies {
  readonly config: AppRuntimeConfig;
  readonly operationalStatus: UiOperationalStatus;
  readonly workflowStore: WorkflowStore;
  readonly nodeStore: NodeStore;
  readonly modelStore: ModelStore;
  readonly workflowService: WorkflowService;
  readonly nodeService: NodeService;
  readonly modelService: ModelService;
  readonly runtimeConsoleStore: RuntimeConsoleStore;
  readonly pythonRuntimeManager: IPythonRuntimeManager;
  readonly managedServicesService: ManagedServicesService;
  readonly managedServicesStore: ManagedServicesStore;
  readonly toolService: ToolService;
  readonly toolStore: ToolStore;
  readonly mcpService: McpService;
  readonly mcpStore: McpStore;
  readonly contextService: ContextService;
  readonly contextStore: ContextStore;
  readonly tuningDatasetService: TuningDatasetService;
  readonly tuningDatasetStore: TuningDatasetStore;
  readonly workflowProjectionService: WorkflowProjectionService;
  readonly settingsStore: UiSettingsStore;
}

export interface CreateUiDependenciesOptions {
  readonly config?: AppRuntimeConfig;
  readonly settingsStorage?: UiSettingsStorage;
}
