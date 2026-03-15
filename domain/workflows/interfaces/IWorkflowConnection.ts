import type { NodePortValueType } from "../../nodes/interfaces/INodePort";
import type { IModelCompatibility } from "../../models/interfaces/IModelCompatibility";

/**
 * Represents one directed edge between two node ports in a workflow.
 *
 * This interface is intentionally richer than a minimal "from/to" edge because
 * AI Loom Studio will likely need:
 * - validation
 * - UI labeling/state
 * - execution planning
 * - future routing/conditional semantics
 * - engine adapter metadata without binding to any engine here
 */

export type WorkflowConnectionKind =
  | "data"
  | "model"
  | "dependency"
  | "control"
  | "generic";

export type WorkflowConnectionState =
  | "active"
  | "disabled"
  | "invalid"
  | "draft";

export interface IWorkflowConnectionEndpoint {
  /**
   * The owning node instance.
   */
  readonly nodeId: string;

  /**
   * The port on that node.
   */
  readonly portId: string;
}

export interface IWorkflowConnectionMetadata {
  /**
   * Optional human-readable label shown in UI.
   */
  readonly label?: string;

  /**
   * Optional description/help text.
   */
  readonly description?: string;

  /**
   * Optional tags for filtering/grouping.
   */
  readonly tags?: ReadonlyArray<string>;
}

export interface IWorkflowConnectionCompatibilitySnapshot {
  /**
   * Optional resolved value types at the time the connection is created or validated.
   * Useful for caching analysis, debugging, and adapter planning.
   */
  readonly valueTypes?: ReadonlyArray<NodePortValueType>;

  /**
   * Optional resolved model compatibility at the time of validation.
   */
  readonly modelCompatibility?: IModelCompatibility;
}

export interface IWorkflowConnection {
  /**
   * Stable connection identifier.
   */
  readonly id: string;

  /**
   * Source must be an output port.
   */
  readonly source: IWorkflowConnectionEndpoint;

  /**
   * Target must be an input port.
   */
  readonly target: IWorkflowConnectionEndpoint;

  /**
   * High-level connection type.
   */
  readonly kind: WorkflowConnectionKind;

  /**
   * Current lifecycle/validation state.
   */
  readonly state: WorkflowConnectionState;

  /**
   * Whether the connection is enabled.
   */
  readonly isEnabled: boolean;

  /**
   * Optional ordering hint when multiple inbound connections matter.
   * Useful for future fan-in, message ordering, or execution planning.
   */
  readonly order?: number;

  /**
   * Optional metadata for UI/documentation.
   */
  readonly metadata?: IWorkflowConnectionMetadata;

  /**
   * Optional compatibility snapshot from prior analysis.
   */
  readonly compatibilitySnapshot?: IWorkflowConnectionCompatibilitySnapshot;

  /**
   * Returns true when this connection references the given node.
   */
  involvesNode(nodeId: string): boolean;

  /**
   * Returns true when this connection references the given port endpoint.
   */
  involvesEndpoint(endpoint: IWorkflowConnectionEndpoint): boolean;

  /**
   * Returns true when the connection is currently usable for execution planning.
   */
  isActive(): boolean;

  /**
   * Returns true when this connection forms the same logical edge as another.
   */
  equals(other: IWorkflowConnection): boolean;

  /**
   * Returns a new connection with updated state.
   */
  withState(state: WorkflowConnectionState): IWorkflowConnection;

  /**
   * Returns a new connection with updated enabled state.
   */
  withEnabled(isEnabled: boolean): IWorkflowConnection;

  /**
   * Returns a new connection with updated compatibility snapshot.
   */
  withCompatibilitySnapshot(
    snapshot: IWorkflowConnectionCompatibilitySnapshot | undefined
  ): IWorkflowConnection;
}
