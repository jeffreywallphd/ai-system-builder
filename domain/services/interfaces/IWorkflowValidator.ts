import type { IWorkflow } from "../../workflows/interfaces/IWorkflow";
import type { IWorkflowGraph } from "../../workflows/interfaces/IWorkflowGraph";
import type { INode } from "../../nodes/interfaces/INode";
import type { IWorkflowConnection } from "../../workflows/interfaces/IWorkflowConnection";

export type WorkflowValidationSeverity = "error" | "warning" | "info";

export type WorkflowValidationScope =
  | "workflow"
  | "graph"
  | "node"
  | "connection"
  | "runtime"
  | "policy"
  | "dependency"
  | "model";

export type WorkflowValidationCode =
  | "workflow-empty"
  | "workflow-disabled"
  | "workflow-policy-violation"
  | "graph-cycle-detected"
  | "graph-disconnected"
  | "graph-unreachable-node"
  | "graph-missing-entry-node"
  | "graph-missing-exit-node"
  | "node-invalid"
  | "node-disabled"
  | "node-missing-required-property"
  | "node-runtime-incompatible"
  | "node-model-incompatible"
  | "connection-invalid"
  | "connection-missing-source-node"
  | "connection-missing-target-node"
  | "connection-missing-source-port"
  | "connection-missing-target-port"
  | "connection-type-incompatible"
  | "connection-cardinality-violation"
  | "dependency-missing"
  | "dependency-incompatible"
  | "runtime-preferred-not-allowed"
  | "runtime-not-supported"
  | "custom";

export interface IWorkflowValidationTargetRef {
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly connectionId?: string;
  readonly portId?: string;
  readonly propertyId?: string;
}

export interface IWorkflowValidationMessage {
  readonly code: WorkflowValidationCode;
  readonly severity: WorkflowValidationSeverity;
  readonly scope: WorkflowValidationScope;
  readonly message: string;
  readonly target?: IWorkflowValidationTargetRef;
}

export interface IWorkflowValidationOptions {
  /**
   * Whether disabled nodes should be treated as invalid.
   * Many workflows will allow disabled nodes to exist without failing validation.
   */
  readonly failOnDisabledNodes?: boolean;

  /**
   * Whether warnings should affect the top-level valid flag.
   */
  readonly treatWarningsAsErrors?: boolean;

  /**
   * Whether graph connectivity should be enforced strictly.
   */
  readonly requireConnectedGraph?: boolean;

  /**
   * Whether unreachable nodes should be reported.
   */
  readonly detectUnreachableNodes?: boolean;

  /**
   * Whether missing entry nodes should be reported.
   */
  readonly requireEntryNode?: boolean;

  /**
   * Whether missing exit nodes should be reported.
   */
  readonly requireExitNode?: boolean;

  /**
   * Optional runtime to validate against.
   * Useful when validating for a specific engine target.
   */
  readonly runtime?: string;

  /**
   * Whether to perform dependency-aware validation.
   */
  readonly validateDependencies?: boolean;

  /**
   * Whether to perform model-aware validation.
   */
  readonly validateModelCompatibility?: boolean;
}

export interface IWorkflowValidationResult {
  readonly isValid: boolean;
  readonly messages: ReadonlyArray<IWorkflowValidationMessage>;
  readonly errors: ReadonlyArray<IWorkflowValidationMessage>;
  readonly warnings: ReadonlyArray<IWorkflowValidationMessage>;
  readonly info: ReadonlyArray<IWorkflowValidationMessage>;
  readonly invalidNodeIds: ReadonlyArray<string>;
  readonly invalidConnectionIds: ReadonlyArray<string>;

  hasErrors(): boolean;
  hasWarnings(): boolean;
  hasMessage(code: WorkflowValidationCode): boolean;
}

export interface IWorkflowValidator {
  /**
   * Validates the workflow aggregate as a whole.
   */
  validateWorkflow(
    workflow: IWorkflow,
    options?: IWorkflowValidationOptions
  ): IWorkflowValidationResult;

  /**
   * Validates a workflow graph independently of the aggregate wrapper.
   */
  validateGraph(
    graph: IWorkflowGraph,
    options?: IWorkflowValidationOptions
  ): IWorkflowValidationResult;

  /**
   * Validates a single node within optional workflow context.
   */
  validateNode(
    node: INode,
    context?: {
      readonly workflow?: IWorkflow;
      readonly graph?: IWorkflowGraph;
      readonly options?: IWorkflowValidationOptions;
    }
  ): IWorkflowValidationResult;

  /**
   * Validates a single connection within optional workflow context.
   */
  validateConnection(
    connection: IWorkflowConnection,
    context?: {
      readonly workflow?: IWorkflow;
      readonly graph?: IWorkflowGraph;
      readonly options?: IWorkflowValidationOptions;
    }
  ): IWorkflowValidationResult;
}
