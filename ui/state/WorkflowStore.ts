import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { IWorkflowExecutionEvent } from "../../application/ports/interfaces/IWorkflowExecutor";
import type {
  IWorkflowValidationOptions,
  IWorkflowValidationResult,
} from "../../domain/services/interfaces/IWorkflowValidator";
import type { ICreateWorkflowRequest } from "../../application/workflows/CreateWorkflowUseCase";
import type { ICreateNodeRequest } from "../../application/nodes/CreateNodeUseCase";
import type { IConnectNodesRequest } from "../../application/nodes/ConnectNodesUseCase";
import type { IExecuteWorkflowRequest } from "../../application/workflows/ExecuteWorkflowUseCase";
import { WorkflowService } from "../services/WorkflowService";
import { NodeService } from "../services/NodeService";

export interface IWorkflowStoreState {
  readonly workflows: ReadonlyArray<IWorkflow>;
  readonly currentWorkflow?: IWorkflow;
  readonly validation?: IWorkflowValidationResult;
  readonly selectedNodeId?: string;
  readonly selectedConnectionId?: string;
  readonly isDirty: boolean;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly isExecuting: boolean;
  readonly lastExecutionEvent?: IWorkflowExecutionEvent;
  readonly nodeExecutionOutputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly outputAssets: ReadonlyArray<IAsset>;
  readonly error?: string;
}

export type WorkflowStoreListener = (state: IWorkflowStoreState) => void;

export interface IWorkflowStoreOptions {
  readonly workflowService: WorkflowService;
  readonly nodeService: NodeService;
  readonly initialState?: Partial<IWorkflowStoreState>;
}

const defaultState: IWorkflowStoreState = Object.freeze({
  workflows: Object.freeze([]),
  currentWorkflow: undefined,
  validation: undefined,
  selectedNodeId: undefined,
  selectedConnectionId: undefined,
  isDirty: false,
  isLoading: false,
  isSaving: false,
  isExecuting: false,
  lastExecutionEvent: undefined,
  nodeExecutionOutputs: Object.freeze({}),
  outputAssets: Object.freeze([]),
  error: undefined,
});

export class WorkflowStore {
  private readonly workflowService: WorkflowService;
  private readonly nodeService: NodeService;
  private readonly listeners = new Set<WorkflowStoreListener>();
  private state: IWorkflowStoreState;

  constructor(options: IWorkflowStoreOptions) {
    this.workflowService = options.workflowService;
    this.nodeService = options.nodeService;
    this.state = Object.freeze({
      ...defaultState,
      ...options.initialState,
      workflows: Object.freeze([...(options.initialState?.workflows ?? [])]),
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
    this.setState({
      isLoading: true,
      error: undefined,
    });

    try {
      const workflows = await this.workflowService.listWorkflows();

      this.setState({
        workflows: Object.freeze([...workflows]),
        isLoading: false,
      });
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async createWorkflow(request: ICreateWorkflowRequest): Promise<IWorkflow> {
    this.setState({
      isLoading: true,
      error: undefined,
    });

    try {
      const result = await this.workflowService.createWorkflow(request);

      this.setState({
        currentWorkflow: result.workflow,
        selectedNodeId: undefined,
        selectedConnectionId: undefined,
        validation: undefined,
        isDirty: true,
        isLoading: false,
        outputAssets: Object.freeze([]),
      });

      return result.workflow;
    } catch (error: unknown) {
      this.setState({
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

    this.setState({
      isLoading: true,
      error: undefined,
    });

    try {
      const workflow = await this.workflowService.loadWorkflow(normalizedId);

      const currentWorkflow = this.state.currentWorkflow;
      const hasConcurrentEdits =
        currentWorkflow?.id === normalizedId && this.state.isDirty;

      if (hasConcurrentEdits) {
        this.setState({
          isLoading: false,
        });

        return currentWorkflow;
      }

      this.setState({
        currentWorkflow: workflow,
        selectedNodeId: undefined,
        selectedConnectionId: undefined,
        validation: undefined,
        isDirty: false,
        isLoading: false,
        outputAssets: Object.freeze([]),
      });

      return workflow;
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async saveCurrentWorkflow(): Promise<IWorkflow> {
    const workflow = this.requireCurrentWorkflow();

    this.setState({
      isSaving: true,
      error: undefined,
    });

    try {
      const saved = await this.workflowService.saveWorkflow(workflow);
      await this.refreshWorkflows();

      this.setState({
        currentWorkflow: saved,
        isDirty: false,
        isSaving: false,
      });

      return saved;
    } catch (error: unknown) {
      this.setState({
        isSaving: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async deleteWorkflow(id: string): Promise<boolean> {
    this.setState({
      isLoading: true,
      error: undefined,
    });

    try {
      const deleted = await this.workflowService.deleteWorkflow(id);
      const currentWorkflow =
        this.state.currentWorkflow?.id === id ? undefined : this.state.currentWorkflow;

      await this.refreshWorkflows();

      this.setState({
        currentWorkflow,
        isLoading: false,
      });

      return deleted;
    } catch (error: unknown) {
      this.setState({
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

    this.setState({
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

    this.setState({
      isExecuting: true,
      error: undefined,
      lastExecutionEvent: undefined,
      nodeExecutionOutputs: Object.freeze({}),
      outputAssets: Object.freeze([]),
    });

    try {
      const result = await this.workflowService.executeWorkflow(
        {
          workflow,
          ...request,
        },
        (event) => {
          const payloadOutputs =
            event.payload && "nodeOutputs" in event.payload
              ? (event.payload.nodeOutputs as Readonly<Record<string, Readonly<Record<string, unknown>>>>)
              : undefined;

          this.setState({
            lastExecutionEvent: event,
            nodeExecutionOutputs: payloadOutputs ?? this.state.nodeExecutionOutputs,
            outputAssets: event.asset
              ? Object.freeze([...this.state.outputAssets, event.asset])
              : this.state.outputAssets,
          });

          onEvent?.(event);
        }
      );

      this.setState({
        currentWorkflow: result.effectiveWorkflow,
        isExecuting: false,
        outputAssets: Object.freeze([...(result.result.outputAssets ?? this.state.outputAssets)]),
      });
    } catch (error: unknown) {
      this.setState({
        isExecuting: false,
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public async createNode(request: Omit<ICreateNodeRequest, "workflow">): Promise<void> {
    const workflow = this.requireCurrentWorkflow();

    try {
      const result = await this.nodeService.createNode({
        workflow,
        ...request,
      });

      this.setState({
        currentWorkflow: result.workflow,
        selectedNodeId: result.node.id,
        selectedConnectionId: undefined,
        isDirty: true,
        validation: undefined,
        error: undefined,
      });
    } catch (error: unknown) {
      this.setState({
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

      this.setState({
        currentWorkflow: result.workflow,
        selectedConnectionId: result.connection.id,
        selectedNodeId: undefined,
        isDirty: true,
        validation: undefined,
        error: undefined,
      });
    } catch (error: unknown) {
      this.setState({
        error: toErrorMessage(error),
      });
      throw error;
    }
  }

  public updateNodeProperty(
    nodeId: string,
    propertyId: string,
    value: unknown
  ): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.workflowService.updateNodeProperty(
      workflow,
      nodeId,
      propertyId,
      value
    );

    this.setState({
      currentWorkflow: updatedWorkflow,
      selectedNodeId: nodeId.trim(),
      isDirty: true,
      validation: undefined,
      error: undefined,
    });
  }

  public moveNode(
    nodeId: string,
    position: { readonly x: number; readonly y: number }
  ): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.nodeService.moveNode(workflow, nodeId, position);

    this.setState({
      currentWorkflow: updatedWorkflow,
      selectedNodeId: nodeId.trim(),
      isDirty: true,
      validation: undefined,
      error: undefined,
    });
  }

  public removeNode(nodeId: string): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.nodeService.removeNode(workflow, nodeId);

    this.setState({
      currentWorkflow: updatedWorkflow,
      selectedNodeId: undefined,
      isDirty: true,
      validation: undefined,
      error: undefined,
    });
  }

  public removeConnection(connectionId: string): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.nodeService.removeConnection(
      workflow,
      connectionId
    );

    this.setState({
      currentWorkflow: updatedWorkflow,
      selectedConnectionId: undefined,
      isDirty: true,
      validation: undefined,
      error: undefined,
    });
  }

  public selectNode(nodeId: string | undefined): void {
    this.setState({
      selectedNodeId: nodeId?.trim() || undefined,
      selectedConnectionId: undefined,
    });
  }

  public selectConnection(connectionId: string | undefined): void {
    this.setState({
      selectedConnectionId: connectionId?.trim() || undefined,
      selectedNodeId: undefined,
    });
  }

  public clearSelection(): void {
    this.setState({
      selectedNodeId: undefined,
      selectedConnectionId: undefined,
    });
  }

  public clearEditorSession(): void {
    this.setState({
      currentWorkflow: undefined,
      validation: undefined,
      selectedNodeId: undefined,
      selectedConnectionId: undefined,
      isDirty: false,
      isLoading: false,
      isSaving: false,
      isExecuting: false,
      lastExecutionEvent: undefined,
      nodeExecutionOutputs: Object.freeze({}),
      outputAssets: Object.freeze([]),
      error: undefined,
    });
  }

  public setCurrentWorkflow(workflow: IWorkflow | undefined): void {
    this.setState({
      currentWorkflow: workflow,
      selectedNodeId: undefined,
      selectedConnectionId: undefined,
      validation: undefined,
      isDirty: false,
      outputAssets: Object.freeze([]),
    });
  }

  public renameCurrentWorkflow(name: string): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.workflowService.renameWorkflow(workflow, name);

    this.setState({
      currentWorkflow: updatedWorkflow,
      isDirty: true,
      error: undefined,
    });
  }

  public updateCurrentWorkflowDescription(description: string | undefined): void {
    const workflow = this.requireCurrentWorkflow();
    const updatedWorkflow = this.workflowService.setWorkflowDescription(
      workflow,
      description
    );

    this.setState({
      currentWorkflow: updatedWorkflow,
      isDirty: true,
      error: undefined,
    });
  }

  private requireCurrentWorkflow(): IWorkflow {
    const workflow = this.state.currentWorkflow;

    if (!workflow) {
      throw new Error("WorkflowStore does not have a current workflow.");
    }

    return workflow;
  }

  private setState(patch: Partial<IWorkflowStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      workflows: patch.workflows
        ? Object.freeze([...patch.workflows])
        : this.state.workflows,
      outputAssets: patch.outputAssets
        ? Object.freeze([...patch.outputAssets])
        : this.state.outputAssets,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown workflow store error.";
}
