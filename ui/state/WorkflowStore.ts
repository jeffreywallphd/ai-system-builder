import type { IWorkflowExecutionEvent } from "../../application/ports/interfaces/IWorkflowExecutor";
import type { ICreateNodeRequest } from "../../application/nodes/CreateNodeUseCase";
import type { IConnectNodesRequest } from "../../application/nodes/ConnectNodesUseCase";
import type { ICreateWorkflowRequest } from "../../application/workflows/CreateWorkflowUseCase";
import type { IExecuteWorkflowRequest } from "../../application/workflows/ExecuteWorkflowUseCase";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
} from "../../domain/services/interfaces/IWorkflowValidator";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import { NodeService } from "../services/NodeService";
import { McpToolCallAuthoringService } from "../services/McpToolCallAuthoringService";
import { WorkflowService } from "../services/WorkflowService";
import { WorkflowProjectionService } from "../../application/projection/WorkflowProjectionService";
import {
  WorkflowExecutionStore,
  type IWorkflowExecutionState,
} from "./WorkflowExecutionStore";
import { AutoSaveController } from "./AutoSaveController";
import {
  PageActionTracker,
  type PageActionTrackerState,
  type PageActionRecord,
} from "./PageActionTracker";

export interface WorkflowActionMetadata {
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly connectionId?: string;
  readonly propertyId?: string;
}

export type WorkflowActionRecord = PageActionRecord<WorkflowActionMetadata>;

export interface IWorkflowEditorState {
  readonly workflows: ReadonlyArray<IWorkflow>;
  readonly currentWorkflow?: IWorkflow;
  readonly validation?: IWorkflowValidationResult;
  readonly selectedNodeId?: string;
  readonly selectedConnectionId?: string;
  readonly isDirty: boolean;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly lastSavedAt?: string;
  readonly saveError?: string;
  readonly actionHistory: PageActionTrackerState<WorkflowActionMetadata>;
  readonly error?: string;
}

export type IWorkflowStoreState = IWorkflowEditorState & IWorkflowExecutionState;

export type WorkflowStoreListener = (state: IWorkflowStoreState) => void;

export interface IWorkflowStoreOptions {
  readonly workflowService: WorkflowService;
  readonly nodeService: NodeService;
  readonly mcpToolCallAuthoringService?: McpToolCallAuthoringService;
  readonly initialState?: Partial<IWorkflowStoreState>;
  readonly executionStore?: WorkflowExecutionStore;
  readonly workflowProjectionService?: WorkflowProjectionService;
}

const defaultEditorState: IWorkflowEditorState = Object.freeze({
  workflows: Object.freeze([]),
  currentWorkflow: undefined,
  validation: undefined,
  selectedNodeId: undefined,
  selectedConnectionId: undefined,
  isDirty: false,
  isLoading: false,
  isSaving: false,
  lastSavedAt: undefined,
  saveError: undefined,
  actionHistory: Object.freeze({
    entries: Object.freeze([]),
    canUndo: false,
    canRedo: false,
  }),
  error: undefined,
});

const defaultWorkflowActionHistory: PageActionTrackerState<WorkflowActionMetadata> = Object.freeze({
  entries: Object.freeze([]),
  canUndo: false,
  canRedo: false,
});

export class WorkflowStore {
  private readonly workflowService: WorkflowService;
  private readonly nodeService: NodeService;
  private readonly mcpToolCallAuthoringService?: McpToolCallAuthoringService;
  private readonly executionStore: WorkflowExecutionStore;
  private readonly workflowProjectionService: WorkflowProjectionService;
  private readonly autoSaveController: AutoSaveController;
  private readonly actionTracker: PageActionTracker<WorkflowActionMetadata>;
  private readonly listeners = new Set<WorkflowStoreListener>();
  private editorState: IWorkflowEditorState;
  private state: IWorkflowStoreState;

  constructor(options: IWorkflowStoreOptions) {
    this.workflowService = options.workflowService;
    this.nodeService = options.nodeService;
    this.mcpToolCallAuthoringService = options.mcpToolCallAuthoringService;

    const initialState = options.initialState ?? {};
    this.executionStore =
      options.executionStore ?? new WorkflowExecutionStore({ initialState });
    this.workflowProjectionService =
      options.workflowProjectionService ?? new WorkflowProjectionService();
    this.autoSaveController = new AutoSaveController({
      delayMs: 1000,
      onSave: async () => {
        if (!this.canAutoSave() || !this.state.currentWorkflow || !this.state.isDirty || this.state.isSaving) {
          return;
        }

        await this.saveCurrentWorkflow();
      },
    });
    this.actionTracker = new PageActionTracker<WorkflowActionMetadata>({
      pageId: "workflow-editor",
    });
    this.editorState = freezeEditorState({
      ...defaultEditorState,
      ...toEditorState(initialState),
    });
    this.state = composeWorkflowState(this.editorState, this.executionStore.getState());

    let skipInitialExecutionEmission = true;
    this.executionStore.subscribe(() => {
      if (skipInitialExecutionEmission) {
        skipInitialExecutionEmission = false;
        return;
      }

      this.emitState();
    });
  }

  public getState(): IWorkflowStoreState {
    return this.state;
  }

  public subscribe(listener: WorkflowStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public async refreshWorkflows(): Promise<void> {
    this.setEditorState({
      isLoading: true,
      error: undefined,
    });

    try {
      const workflows = await this.workflowService.listWorkflows();

      this.setEditorState({
        workflows,
        isLoading: false,
      });
    } catch (error: unknown) {
      this.setEditorState({
        isLoading: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async createWorkflow(request: ICreateWorkflowRequest): Promise<IWorkflow> {
    this.setEditorState({
      isLoading: true,
      error: undefined,
    });

    try {
      const result = await this.workflowService.createWorkflow(request);

      this.executionStore.clearSession();
      this.setEditorState({
        currentWorkflow: result.workflow,
        selectedNodeId: undefined,
        selectedConnectionId: undefined,
        validation: undefined,
        isDirty: true,
        isLoading: false,
        saveError: undefined,
      });
      this.recordAction("workflow-created", "Created a new workflow draft.", {
        workflowId: result.workflow.id,
      });
      this.scheduleAutoSave();

      return result.workflow;
    } catch (error: unknown) {
      this.setEditorState({
        isLoading: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async loadWorkflow(id: string): Promise<IWorkflow | undefined> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("WorkflowStore.loadWorkflow requires an id.");
    }

    this.setEditorState({
      isLoading: true,
      error: undefined,
    });

    try {
      const workflow = await this.workflowService.loadWorkflow(normalizedId);
      const currentWorkflow = this.state.currentWorkflow;
      const hasConcurrentEdits =
        currentWorkflow?.id === normalizedId && this.state.isDirty;

      if (hasConcurrentEdits) {
        this.setEditorState({ isLoading: false });
        return currentWorkflow;
      }

      this.executionStore.clearSession();
      this.autoSaveController.cancel();
      this.setEditorState({
        currentWorkflow: workflow ? await this.hydrateMcpToolCallNodes(workflow) : undefined,
        selectedNodeId: undefined,
        selectedConnectionId: undefined,
        validation: undefined,
        isDirty: false,
        isLoading: false,
        saveError: undefined,
      });
      this.actionTracker.clear();

      return workflow;
    } catch (error: unknown) {
      this.setEditorState({
        isLoading: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async saveCurrentWorkflow(): Promise<IWorkflow> {
    const workflow = this.requireCurrentWorkflow();

    this.setEditorState({
      isSaving: true,
      error: undefined,
    });

    try {
      const saved = await this.workflowService.saveWorkflow(workflow);

      this.setEditorState({
        currentWorkflow: saved,
        workflows: upsertWorkflowSummary(this.editorState.workflows, saved),
        isDirty: false,
        isSaving: false,
        saveError: undefined,
        lastSavedAt: new Date().toISOString(),
      });

      return saved;
    } catch (error: unknown) {
      this.setEditorState({
        isSaving: false,
        saveError: toErrorMessage(error),
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async deleteWorkflow(id: string): Promise<boolean> {
    this.setEditorState({
      isLoading: true,
      error: undefined,
    });

    try {
      const deleted = await this.workflowService.deleteWorkflow(id);
      const currentWorkflow =
        this.state.currentWorkflow?.id === id ? undefined : this.state.currentWorkflow;

      await this.refreshWorkflows();

      if (!currentWorkflow) {
        this.executionStore.clearSession();
      }

      this.autoSaveController.cancel();
      this.setEditorState({
        currentWorkflow,
        isLoading: false,
      });

      return deleted;
    } catch (error: unknown) {
      this.setEditorState({
        isLoading: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public validateCurrentWorkflow(
    options?: IWorkflowValidationOptions
  ): IWorkflowValidationResult {
    const workflow = this.requireCurrentWorkflow();
    const validation = this.workflowService.validateWorkflow(workflow, options);

    this.setEditorState({
      validation,
      error: undefined,
    });

    return validation;
  }

  public async executeCurrentWorkflow(
    request?: Omit<IExecuteWorkflowRequest, "workflow">,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<void> {
    const workflow = this.requireCurrentWorkflow();

    this.setEditorState({
      error: undefined,
    });
    this.executionStore.beginExecution();

    try {
      const result = await this.workflowService.executeWorkflow(
        {
          workflow,
          ...request,
        },
        (event) => {
          this.executionStore.recordEvent(event);
          onEvent?.(event);
        }
      );

      this.setEditorState({
        currentWorkflow: result.effectiveWorkflow,
      });
      this.executionStore.completeExecution(result.result.outputAssets);
    } catch (error: unknown) {
      this.executionStore.failExecution();
      this.setEditorState({
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async createNode(request: Omit<ICreateNodeRequest, "workflow">): Promise<void> {
    const workflow = this.requireCurrentWorkflow();

    try {
      const resolvedPosition = request.position
        ? this.nodeService.resolveNodePlacement(workflow, request.position)
        : request.position;
      const result = await this.nodeService.createNode({
        workflow,
        ...request,
        position: resolvedPosition,
      });

      this.setEditorState({
        currentWorkflow: await this.hydrateMcpToolCallNodes(result.workflow),
        selectedNodeId: result.node.id,
        selectedConnectionId: undefined,
        isDirty: true,
        validation: undefined,
        saveError: undefined,
        error: undefined,
      });
      this.recordAction("node-added", `Added node "${result.node.id}".`, {
        workflowId: result.workflow.id,
        nodeId: result.node.id,
      });
      this.scheduleAutoSave();
    } catch (error: unknown) {
      this.setEditorState({
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public connectNodes(request: Omit<IConnectNodesRequest, "workflow">): void {
    const workflow = this.requireCurrentWorkflow();

    try {
      const result = this.nodeService.connectNodes({
        workflow,
        ...request,
      });

      this.setEditorState({
        currentWorkflow: result.workflow,
        selectedConnectionId: result.connection.id,
        selectedNodeId: undefined,
        isDirty: true,
        validation: undefined,
        saveError: undefined,
        error: undefined,
      });
      this.recordAction("connection-added", `Connected nodes with "${result.connection.id}".`, {
        workflowId: result.workflow.id,
        connectionId: result.connection.id,
      });
      this.scheduleAutoSave();
    } catch (error: unknown) {
      this.setEditorState({
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public applyFormInput(values: Readonly<Record<string, unknown>>): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.workflowProjectionService.applyFormInput(workflow, values);

    this.setEditorState({
      currentWorkflow: updatedWorkflow,
      isDirty: true,
      validation: undefined,
      saveError: undefined,
      error: undefined,
    });
    this.recordAction("workflow-form-updated", "Updated workflow form values.", {
      workflowId: updatedWorkflow.id,
    });
    this.scheduleAutoSave();
  }

  public updateNodeProperty(
    nodeId: string,
    propertyId: string,
    value: unknown
  ): Promise<void> {
    const workflow = this.requireCurrentWorkflow();
    const nextWorkflow = this.mcpToolCallAuthoringService
      ? this.mcpToolCallAuthoringService.applyPropertyChange(
        workflow,
        nodeId,
        propertyId,
        value
      )
      : Promise.resolve(
        this.workflowService.updateNodeProperty(
          workflow,
          nodeId,
          propertyId,
          value
        )
      );

    return nextWorkflow
      .then((updatedWorkflow) => {
        this.setEditorState({
          currentWorkflow: updatedWorkflow,
          selectedNodeId: nodeId.trim(),
          isDirty: true,
          validation: undefined,
          saveError: undefined,
          error: undefined,
        });
        this.recordAction("node-property-updated", `Updated node property "${propertyId.trim()}".`, {
          workflowId: updatedWorkflow.id,
          nodeId: nodeId.trim(),
          propertyId: propertyId.trim(),
        });
        this.scheduleAutoSave();
      })
      .catch((error: unknown) => {
        this.setEditorState({
          error: toErrorMessage(error),
        });
        throw error;
      });
  }

  public moveNode(
    nodeId: string,
    position: { readonly x: number; readonly y: number }
  ): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.nodeService.moveNode(workflow, nodeId, position);

    this.setEditorState({
      currentWorkflow: updatedWorkflow,
      selectedNodeId: nodeId.trim(),
      isDirty: true,
      validation: undefined,
      saveError: undefined,
      error: undefined,
    });
    this.recordAction("node-moved", `Moved node "${nodeId.trim()}".`, {
      workflowId: updatedWorkflow.id,
      nodeId: nodeId.trim(),
    });
    this.scheduleAutoSave();
  }

  public previewNodeMovePlacement(
    nodeId: string,
    position: { readonly x: number; readonly y: number }
  ): { readonly x: number; readonly y: number } {
    const workflow = this.requireCurrentWorkflow();
    const node = this.nodeService.getNode(workflow, nodeId);

    if (!node) {
      throw new Error(`Node '${nodeId.trim()}' was not found.`);
    }

    return this.nodeService.resolveNodePlacement(
      workflow,
      position,
      nodeId,
      node.size,
      "settle"
    );
  }

  public removeNode(nodeId: string): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.nodeService.removeNode(workflow, nodeId);

    this.setEditorState({
      currentWorkflow: updatedWorkflow,
      selectedNodeId: undefined,
      isDirty: true,
      validation: undefined,
      saveError: undefined,
      error: undefined,
    });
    this.recordAction("node-removed", `Removed node "${nodeId.trim()}".`, {
      workflowId: updatedWorkflow.id,
      nodeId: nodeId.trim(),
    });
    this.scheduleAutoSave();
  }

  public removeConnection(connectionId: string): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.nodeService.removeConnection(
      workflow,
      connectionId
    );

    this.setEditorState({
      currentWorkflow: updatedWorkflow,
      selectedConnectionId: undefined,
      isDirty: true,
      validation: undefined,
      saveError: undefined,
      error: undefined,
    });
    this.recordAction("connection-removed", `Removed connection "${connectionId.trim()}".`, {
      workflowId: updatedWorkflow.id,
      connectionId: connectionId.trim(),
    });
    this.scheduleAutoSave();
  }

  public selectNode(nodeId: string | undefined): void {
    this.setEditorState({
      selectedNodeId: nodeId?.trim() || undefined,
      selectedConnectionId: undefined,
    });
  }

  public selectConnection(connectionId: string | undefined): void {
    this.setEditorState({
      selectedConnectionId: connectionId?.trim() || undefined,
      selectedNodeId: undefined,
    });
  }

  public clearSelection(): void {
    this.setEditorState({
      selectedNodeId: undefined,
      selectedConnectionId: undefined,
    });
  }

  public clearEditorSession(): void {
    this.autoSaveController.cancel();
    this.executionStore.clearSession();
    this.actionTracker.clear();
    this.setEditorState({
      currentWorkflow: undefined,
      validation: undefined,
      selectedNodeId: undefined,
      selectedConnectionId: undefined,
      isDirty: false,
      isLoading: false,
      isSaving: false,
      lastSavedAt: undefined,
      saveError: undefined,
      actionHistory: this.actionTracker.getState(),
      error: undefined,
    });
  }

  public setCurrentWorkflow(workflow: IWorkflow | undefined): void {
    this.autoSaveController.cancel();
    this.executionStore.clearSession();
    this.actionTracker.clear();
    this.setEditorState({
      currentWorkflow: workflow,
      selectedNodeId: undefined,
      selectedConnectionId: undefined,
      validation: undefined,
      isDirty: false,
      saveError: undefined,
      actionHistory: this.actionTracker.getState(),
    });
  }

  public renameCurrentWorkflow(name: string): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.workflowService.renameWorkflow(workflow, name);

    this.setEditorState({
      currentWorkflow: updatedWorkflow,
      isDirty: true,
      saveError: undefined,
      error: undefined,
    });
    this.recordAction("workflow-renamed", "Renamed the workflow.", {
      workflowId: updatedWorkflow.id,
    });
    this.scheduleAutoSave();
  }

  public updateCurrentWorkflowDescription(description: string | undefined): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.workflowService.setWorkflowDescription(
      workflow,
      description
    );

    this.setEditorState({
      currentWorkflow: updatedWorkflow,
      isDirty: true,
      saveError: undefined,
      error: undefined,
    });
    this.recordAction("workflow-description-updated", "Updated the workflow description.", {
      workflowId: updatedWorkflow.id,
    });
    this.scheduleAutoSave();
  }

  public async refreshCurrentWorkflowMcpTooling(): Promise<void> {
    const currentWorkflow = this.state.currentWorkflow;
    if (!currentWorkflow) {
      return;
    }

    const hydratedWorkflow = await this.hydrateMcpToolCallNodes(currentWorkflow);
    this.setEditorState({
      currentWorkflow: hydratedWorkflow,
    });
  }

  private requireCurrentWorkflow(): IWorkflow {
    const workflow = this.state.currentWorkflow;

    if (!workflow) {
      throw new Error("WorkflowStore does not have a current workflow.");
    }

    return workflow;
  }

  private async hydrateMcpToolCallNodes(workflow: IWorkflow): Promise<IWorkflow> {
    if (!this.mcpToolCallAuthoringService) {
      return workflow;
    }

    return this.mcpToolCallAuthoringService.hydrateWorkflow(workflow);
  }

  private setEditorState(patch: Partial<IWorkflowEditorState>): void {
    this.editorState = freezeEditorState({
      ...this.editorState,
      ...patch,
    });
    this.emitState();
  }

  private emitState(): void {
    this.state = composeWorkflowState(this.editorState, this.executionStore.getState());

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private scheduleAutoSave(): void {
    if (!this.canAutoSave()) {
      return;
    }

    this.autoSaveController.schedule();
  }

  private recordAction(
    type: string,
    description: string,
    metadata?: WorkflowActionMetadata
  ): void {
    this.setEditorState({
      actionHistory: this.actionTracker.record({
        type,
        description,
        metadata,
      }),
    });
  }

  private canAutoSave(): boolean {
    return typeof this.workflowService.saveWorkflow === "function";
  }
}

function toEditorState(state: Partial<IWorkflowStoreState>): Partial<IWorkflowEditorState> {
  const {
    workflows,
    currentWorkflow,
    validation,
    selectedNodeId,
    selectedConnectionId,
    isDirty,
    isLoading,
    isSaving,
    lastSavedAt,
    saveError,
    actionHistory,
    error,
  } = state;

  return {
    workflows,
    currentWorkflow,
    validation,
    selectedNodeId,
    selectedConnectionId,
    isDirty,
    isLoading,
    isSaving,
    lastSavedAt,
    saveError,
    actionHistory,
    error,
  };
}

function composeWorkflowState(
  editorState: IWorkflowEditorState,
  executionState: IWorkflowExecutionState
): IWorkflowStoreState {
  return Object.freeze({
    ...editorState,
    ...executionState,
  });
}

function freezeEditorState(state: IWorkflowEditorState): IWorkflowEditorState {
  const actionHistory = state.actionHistory ?? defaultWorkflowActionHistory;

  return Object.freeze({
    ...state,
    workflows: Object.freeze([...(state.workflows ?? [])]),
    actionHistory: Object.freeze({
      ...actionHistory,
      entries: Object.freeze([...(actionHistory.entries ?? [])]),
    }),
  });
}

function upsertWorkflowSummary(
  workflows: ReadonlyArray<IWorkflow>,
  workflow: IWorkflow
): ReadonlyArray<IWorkflow> {
  const existingIndex = workflows.findIndex((item) => item.id === workflow.id);

  if (existingIndex === -1) {
    return Object.freeze([...workflows, workflow]);
  }

  return Object.freeze(workflows.map((item) => (item.id === workflow.id ? workflow : item)));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown workflow store error.";
}
