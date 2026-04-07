import type {
  IWorkflow,
  IWorkflowAuditInfo,
  IWorkflowMetadata,
  IWorkflowRuntimeProfile,
  IWorkflowValidationResult,
  WorkflowExecutionPolicy,
  WorkflowStatus,
} from "./interfaces/IWorkflow";
import type { INode } from "../../../domain/nodes/interfaces/INode";
import type { IWorkflowConnection } from "./interfaces/IWorkflowConnection";
import type { IWorkflowGraph } from "./interfaces/IWorkflowGraph";
import { WorkflowAuditInfo, WorkflowMetadata, WorkflowRuntimeProfile } from "./WorkflowMetadata";
import { WorkflowGraph } from "./WorkflowGraph";

function uniqueById<T extends { id: string }>(items: ReadonlyArray<T>): ReadonlyArray<T> {
  const map = new Map<string, T>();

  for (const item of items) {
    map.set(item.id, item);
  }

  return Object.freeze([...map.values()]);
}

export class WorkflowValidationResult implements IWorkflowValidationResult {
  public readonly isValid: boolean;
  public readonly messages: ReadonlyArray<string>;
  public readonly invalidNodeIds: ReadonlyArray<string>;
  public readonly invalidConnectionIds: ReadonlyArray<string>;

  constructor(params: {
    isValid: boolean;
    messages?: ReadonlyArray<string>;
    invalidNodeIds?: ReadonlyArray<string>;
    invalidConnectionIds?: ReadonlyArray<string>;
  }) {
    this.isValid = params.isValid;
    this.messages = Object.freeze([...(params.messages ?? [])]);
    this.invalidNodeIds = Object.freeze([...(params.invalidNodeIds ?? [])]);
    this.invalidConnectionIds = Object.freeze([
      ...(params.invalidConnectionIds ?? []),
    ]);
  }
}

export class Workflow implements IWorkflow {
  public readonly id: string;
  public readonly metadata: IWorkflowMetadata;
  public readonly status: WorkflowStatus;
  public readonly isEnabled: boolean;
  public readonly runtimeProfile?: IWorkflowRuntimeProfile;
  public readonly executionPolicy: WorkflowExecutionPolicy;
  public readonly audit?: IWorkflowAuditInfo;
  public readonly nodes: ReadonlyArray<INode>;
  public readonly connections: ReadonlyArray<IWorkflowConnection>;

  constructor(params: {
    id: string;
    metadata: IWorkflowMetadata;
    status?: WorkflowStatus;
    isEnabled?: boolean;
    runtimeProfile?: IWorkflowRuntimeProfile;
    executionPolicy?: WorkflowExecutionPolicy;
    audit?: IWorkflowAuditInfo;
    nodes?: ReadonlyArray<INode>;
    connections?: ReadonlyArray<IWorkflowConnection>;
  }) {
    const id = params.id.trim();

    if (!id) {
      throw new Error("Workflow.id cannot be empty.");
    }

    this.id = id;
    this.metadata = WorkflowMetadata.from(params.metadata);
    this.status = params.status ?? "draft";
    this.isEnabled = params.isEnabled ?? true;
    this.runtimeProfile = WorkflowRuntimeProfile.from(params.runtimeProfile);
    this.executionPolicy = params.executionPolicy ?? "acyclic-only";
    this.audit = WorkflowAuditInfo.from(params.audit);
    this.nodes = uniqueById(params.nodes ?? []);
    this.connections = uniqueById(params.connections ?? []);
  }

  public getNode(nodeId: string): INode | undefined {
    return this.nodes.find((node) => node.id === nodeId);
  }

  public getConnection(connectionId: string): IWorkflowConnection | undefined {
    return this.connections.find((connection) => connection.id === connectionId);
  }

  public hasNode(nodeId: string): boolean {
    return !!this.getNode(nodeId);
  }

  public hasConnection(connectionId: string): boolean {
    return !!this.getConnection(connectionId);
  }

  public addNode(node: INode): IWorkflow {
    if (this.hasNode(node.id)) {
      throw new Error(`Workflow already contains node '${node.id}'.`);
    }

    return this.clone({
      nodes: [...this.nodes, node],
      audit: this.touchAudit(),
    });
  }

  public updateNode(node: INode): IWorkflow {
    if (!this.hasNode(node.id)) {
      throw new Error(`Workflow does not contain node '${node.id}'.`);
    }

    return this.clone({
      nodes: this.nodes.map((current) => (current.id === node.id ? node : current)),
      audit: this.touchAudit(),
    });
  }

  public removeNode(nodeId: string): IWorkflow {
    if (!this.hasNode(nodeId)) {
      return this;
    }

    return this.clone({
      nodes: this.nodes.filter((node) => node.id !== nodeId),
      connections: this.connections.filter(
        (connection) => !connection.involvesNode(nodeId)
      ),
      audit: this.touchAudit(),
    });
  }

  public addConnection(connection: IWorkflowConnection): IWorkflow {
    if (this.hasConnection(connection.id)) {
      throw new Error(`Workflow already contains connection '${connection.id}'.`);
    }

    return this.clone({
      connections: [...this.connections, connection],
      audit: this.touchAudit(),
    });
  }

  public updateConnection(connection: IWorkflowConnection): IWorkflow {
    if (!this.hasConnection(connection.id)) {
      throw new Error(`Workflow does not contain connection '${connection.id}'.`);
    }

    return this.clone({
      connections: this.connections.map((current) =>
        current.id === connection.id ? connection : current
      ),
      audit: this.touchAudit(),
    });
  }

  public removeConnection(connectionId: string): IWorkflow {
    if (!this.hasConnection(connectionId)) {
      return this;
    }

    return this.clone({
      connections: this.connections.filter(
        (connection) => connection.id !== connectionId
      ),
      audit: this.touchAudit(),
    });
  }

  public withMetadata(metadata: IWorkflowMetadata): IWorkflow {
    return this.clone({
      metadata: WorkflowMetadata.from(metadata),
      audit: this.touchAudit(),
    });
  }

  public withStatus(status: WorkflowStatus): IWorkflow {
    return this.clone({
      status,
      audit: this.touchAudit(),
    });
  }

  public withEnabled(isEnabled: boolean): IWorkflow {
    return this.clone({
      isEnabled,
      audit: this.touchAudit(),
    });
  }

  public withRuntimeProfile(
    runtimeProfile: IWorkflowRuntimeProfile | undefined
  ): IWorkflow {
    return this.clone({
      runtimeProfile: WorkflowRuntimeProfile.from(runtimeProfile),
      audit: this.touchAudit(),
    });
  }

  public withExecutionPolicy(policy: WorkflowExecutionPolicy): IWorkflow {
    return this.clone({
      executionPolicy: policy,
      audit: this.touchAudit(),
    });
  }

  public toGraph(): IWorkflowGraph {
    return new WorkflowGraph({
      nodes: this.nodes,
      connections: this.connections,
    });
  }

  public validate(): IWorkflowValidationResult {
    const messages: string[] = [];
    const invalidNodeIds = new Set<string>();
    const invalidConnectionIds = new Set<string>();

    if (!this.isEnabled) {
      messages.push("[Workflow] Workflow is disabled.");
    }

    if (this.nodes.length === 0) {
      messages.push("[Workflow] Workflow must contain at least one node.");
    }

    const graphValidation = this.toGraph().validate();

    if (!graphValidation.isValid) {
      graphValidation.messages.forEach((message) => messages.push(message));
      graphValidation.invalidNodeIds.forEach((nodeId) => invalidNodeIds.add(nodeId));
      graphValidation.invalidConnectionIds.forEach((connectionId) =>
        invalidConnectionIds.add(connectionId)
      );
    }

    if (
      this.executionPolicy === "acyclic-only" &&
      this.toGraph().hasCycles()
    ) {
      messages.push("[Workflow] Workflow execution policy does not allow cycles.");
    }

    if (
      this.runtimeProfile?.preferredRuntime &&
      !this.runtimeProfile.supportsRuntime(this.runtimeProfile.preferredRuntime)
    ) {
      messages.push(
        "[Workflow] Preferred runtime is not included in allowed runtimes."
      );
    }

    return new WorkflowValidationResult({
      isValid: messages.length === 0,
      messages,
      invalidNodeIds: [...invalidNodeIds],
      invalidConnectionIds: [...invalidConnectionIds],
    });
  }

  public isExecutable(): boolean {
    if (!this.isEnabled) {
      return false;
    }

    if (this.status === "disabled" || this.status === "archived") {
      return false;
    }

    const validation = this.validate();
    return validation.isValid;
  }

  public static from(workflow: IWorkflow): Workflow {
    return new Workflow({
      id: workflow.id,
      metadata: workflow.metadata,
      status: workflow.status,
      isEnabled: workflow.isEnabled,
      runtimeProfile: workflow.runtimeProfile,
      executionPolicy: workflow.executionPolicy,
      audit: workflow.audit,
      nodes: workflow.nodes,
      connections: workflow.connections,
    });
  }

  private touchAudit(): IWorkflowAuditInfo | undefined {
    const currentAudit = WorkflowAuditInfo.from(this.audit);
    return (currentAudit ?? new WorkflowAuditInfo()).touch();
  }

  private clone(overrides: Partial<{
    metadata: IWorkflowMetadata;
    status: WorkflowStatus;
    isEnabled: boolean;
    runtimeProfile?: IWorkflowRuntimeProfile;
    executionPolicy: WorkflowExecutionPolicy;
    audit?: IWorkflowAuditInfo;
    nodes: ReadonlyArray<INode>;
    connections: ReadonlyArray<IWorkflowConnection>;
  }>): Workflow {
    return new Workflow({
      id: this.id,
      metadata: overrides.metadata ?? this.metadata,
      status: overrides.status ?? this.status,
      isEnabled: overrides.isEnabled ?? this.isEnabled,
      runtimeProfile:
        overrides.runtimeProfile !== undefined
          ? overrides.runtimeProfile
          : this.runtimeProfile,
      executionPolicy: overrides.executionPolicy ?? this.executionPolicy,
      audit: overrides.audit !== undefined ? overrides.audit : this.audit,
      nodes: overrides.nodes ?? this.nodes,
      connections: overrides.connections ?? this.connections,
    });
  }
}
