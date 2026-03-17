export type NodeExecutionStyle =
  | "delegated-workflow"
  | "interpreted-node"
  | "python-node"
  | "hybrid"
  | "generic";

export interface INodeImplementationDescriptorProps {
  readonly providerId: string;
  readonly runtimeId: string;
  readonly nodeTypeId: string;
  readonly title: string;
  readonly executionStyles?: ReadonlyArray<NodeExecutionStyle>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export class NodeImplementationDescriptor {
  public readonly providerId: string;
  public readonly runtimeId: string;
  public readonly nodeTypeId: string;
  public readonly title: string;
  public readonly executionStyles: ReadonlyArray<NodeExecutionStyle>;
  public readonly metadata?: Readonly<Record<string, unknown>>;

  constructor(props: INodeImplementationDescriptorProps) {
    this.providerId = props.providerId;
    this.runtimeId = props.runtimeId;
    this.nodeTypeId = props.nodeTypeId;
    this.title = props.title;
    this.executionStyles = Object.freeze([...(props.executionStyles ?? ["generic"])]);
    this.metadata = props.metadata ? Object.freeze({ ...props.metadata }) : undefined;
  }

  public matchesNodeType(nodeTypeId: string): boolean {
    return normalize(this.nodeTypeId) === normalize(nodeTypeId);
  }

  public matchesProvider(providerId: string): boolean {
    return normalize(this.providerId) === normalize(providerId);
  }
}
