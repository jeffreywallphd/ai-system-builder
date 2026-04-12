import type {
  IWorkflowConnection,
  IWorkflowConnectionCompatibilitySnapshot,
  IWorkflowConnectionEndpoint,
  IWorkflowConnectionMetadata,
  WorkflowConnectionKind,
  WorkflowConnectionState,
} from "./interfaces/IWorkflowConnection";
import type { IModelCompatibility } from "../models/interfaces/IModelCompatibility";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function sameEndpoint(
  left: IWorkflowConnectionEndpoint,
  right: IWorkflowConnectionEndpoint
): boolean {
  return left.nodeId === right.nodeId && left.portId === right.portId;
}

export class WorkflowConnectionEndpoint
  implements IWorkflowConnectionEndpoint
{
  public readonly nodeId: string;
  public readonly portId: string;

  constructor(params: { nodeId: string; portId: string }) {
    const nodeId = params.nodeId.trim();
    const portId = params.portId.trim();

    if (!nodeId) {
      throw new Error("WorkflowConnectionEndpoint.nodeId cannot be empty.");
    }

    if (!portId) {
      throw new Error("WorkflowConnectionEndpoint.portId cannot be empty.");
    }

    this.nodeId = nodeId;
    this.portId = portId;
  }

  public static from(
    endpoint: IWorkflowConnectionEndpoint
  ): WorkflowConnectionEndpoint {
    return new WorkflowConnectionEndpoint({
      nodeId: endpoint.nodeId,
      portId: endpoint.portId,
    });
  }
}

export class WorkflowConnectionMetadata
  implements IWorkflowConnectionMetadata
{
  public readonly label?: string;
  public readonly description?: string;
  public readonly tags?: ReadonlyArray<string>;

  constructor(params: {
    label?: string;
    description?: string;
    tags?: ReadonlyArray<string>;
  } = {}) {
    this.label = params.label?.trim() || undefined;
    this.description = params.description?.trim() || undefined;
    this.tags = params.tags
      ? Object.freeze(params.tags.map((tag) => tag.trim()).filter(Boolean))
      : undefined;
  }

  public static from(
    metadata?: IWorkflowConnectionMetadata
  ): WorkflowConnectionMetadata | undefined {
    if (!metadata) {
      return undefined;
    }

    return new WorkflowConnectionMetadata({
      label: metadata.label,
      description: metadata.description,
      tags: metadata.tags,
    });
  }
}

export class WorkflowConnectionCompatibilitySnapshot
  implements IWorkflowConnectionCompatibilitySnapshot
{
  public readonly valueTypes?: ReadonlyArray<string>;
  public readonly modelCompatibility?: IModelCompatibility;

  constructor(params: {
    valueTypes?: ReadonlyArray<string>;
    modelCompatibility?: IModelCompatibility;
  } = {}) {
    this.valueTypes = params.valueTypes
      ? Object.freeze([...params.valueTypes])
      : undefined;
    this.modelCompatibility = params.modelCompatibility;
  }

  public static from(
    snapshot?: IWorkflowConnectionCompatibilitySnapshot
  ): WorkflowConnectionCompatibilitySnapshot | undefined {
    if (!snapshot) {
      return undefined;
    }

    return new WorkflowConnectionCompatibilitySnapshot({
      valueTypes: snapshot.valueTypes,
      modelCompatibility: snapshot.modelCompatibility,
    });
  }
}

export class WorkflowConnection implements IWorkflowConnection {
  public readonly id: string;
  public readonly source: IWorkflowConnectionEndpoint;
  public readonly target: IWorkflowConnectionEndpoint;
  public readonly kind: WorkflowConnectionKind;
  public readonly state: WorkflowConnectionState;
  public readonly isEnabled: boolean;
  public readonly order?: number;
  public readonly metadata?: IWorkflowConnectionMetadata;
  public readonly compatibilitySnapshot?: IWorkflowConnectionCompatibilitySnapshot;

  constructor(params: {
    id: string;
    source: IWorkflowConnectionEndpoint;
    target: IWorkflowConnectionEndpoint;
    kind?: WorkflowConnectionKind;
    state?: WorkflowConnectionState;
    isEnabled?: boolean;
    order?: number;
    metadata?: IWorkflowConnectionMetadata;
    compatibilitySnapshot?: IWorkflowConnectionCompatibilitySnapshot;
  }) {
    const id = params.id.trim();

    if (!id) {
      throw new Error("WorkflowConnection.id cannot be empty.");
    }

    const source = WorkflowConnectionEndpoint.from(params.source);
    const target = WorkflowConnectionEndpoint.from(params.target);

    if (sameEndpoint(source, target)) {
      throw new Error("WorkflowConnection source and target cannot be the same endpoint.");
    }

    this.id = id;
    this.source = source;
    this.target = target;
    this.kind = params.kind ?? "generic";
    this.state = params.state ?? "active";
    this.isEnabled = params.isEnabled ?? true;
    this.order = params.order;
    this.metadata = WorkflowConnectionMetadata.from(params.metadata);
    this.compatibilitySnapshot = WorkflowConnectionCompatibilitySnapshot.from(
      params.compatibilitySnapshot
    );
  }

  public involvesNode(nodeId: string): boolean {
    return this.source.nodeId === nodeId || this.target.nodeId === nodeId;
  }

  public involvesEndpoint(endpoint: IWorkflowConnectionEndpoint): boolean {
    return sameEndpoint(this.source, endpoint) || sameEndpoint(this.target, endpoint);
  }

  public isActive(): boolean {
    return this.isEnabled && this.state === "active";
  }

  public equals(other: IWorkflowConnection): boolean {
    return (
      this.id === other.id ||
      (sameEndpoint(this.source, other.source) &&
        sameEndpoint(this.target, other.target) &&
        normalize(this.kind) === normalize(other.kind))
    );
  }

  public withState(state: WorkflowConnectionState): IWorkflowConnection {
    return new WorkflowConnection({
      id: this.id,
      source: this.source,
      target: this.target,
      kind: this.kind,
      state,
      isEnabled: this.isEnabled,
      order: this.order,
      metadata: this.metadata,
      compatibilitySnapshot: this.compatibilitySnapshot,
    });
  }

  public withEnabled(isEnabled: boolean): IWorkflowConnection {
    return new WorkflowConnection({
      id: this.id,
      source: this.source,
      target: this.target,
      kind: this.kind,
      state: this.state,
      isEnabled,
      order: this.order,
      metadata: this.metadata,
      compatibilitySnapshot: this.compatibilitySnapshot,
    });
  }

  public withCompatibilitySnapshot(
    snapshot: IWorkflowConnectionCompatibilitySnapshot | undefined
  ): IWorkflowConnection {
    return new WorkflowConnection({
      id: this.id,
      source: this.source,
      target: this.target,
      kind: this.kind,
      state: this.state,
      isEnabled: this.isEnabled,
      order: this.order,
      metadata: this.metadata,
      compatibilitySnapshot: snapshot,
    });
  }

  public static from(connection: IWorkflowConnection): WorkflowConnection {
    return new WorkflowConnection({
      id: connection.id,
      source: connection.source,
      target: connection.target,
      kind: connection.kind,
      state: connection.state,
      isEnabled: connection.isEnabled,
      order: connection.order,
      metadata: connection.metadata,
      compatibilitySnapshot: connection.compatibilitySnapshot,
    });
  }
}
