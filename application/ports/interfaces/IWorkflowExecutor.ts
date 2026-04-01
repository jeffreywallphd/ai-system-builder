import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import type { RuntimeEngine } from "../../../domain/models/interfaces/IModelCompatibility";

export type WorkflowExecutionStatus =
  | "queued"
  | "preparing"
  | "validating"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowExecutionEventKind =
  | "workflow-started"
  | "workflow-progress"
  | "workflow-completed"
  | "workflow-failed"
  | "workflow-cancelled"
  | "node-started"
  | "node-progress"
  | "node-completed"
  | "node-failed"
  | "asset-produced"
  | "log"
  | "custom";

export type ExecutionProvenanceKind =
  | "real"
  | "delegated"
  | "scaffolded"
  | "hybrid"
  | "unavailable";

export type ExecutionFallbackKind =
  | "scaffold-interpreter"
  | "browser-storage"
  | "in-memory"
  | "browser-download";

export type McpExecutionTruthStatus =
  | "live"
  | "stale"
  | "disconnected"
  | "scaffolded-fallback"
  | "unavailable";

export type ModelLibraryTruthState =
  | "installed-and-verified"
  | "installed-but-unverified"
  | "registered-metadata-only"
  | "missing-on-disk"
  | "partially-installed"
  | "corrupted-checksum-mismatch"
  | "downloaded-but-unregistered"
  | "browser-fallback-downloaded-only";

export interface IExecutionFallbackInfo {
  readonly kind: ExecutionFallbackKind;
  readonly isActive: boolean;
  readonly reason?: string;
}

export interface IMcpExecutionProvenance {
  readonly status: McpExecutionTruthStatus;
  readonly serverId?: string;
  readonly toolName?: string;
  readonly detail?: string;
  readonly checkedAt?: string;
}

export interface IModelLibraryProvenance {
  readonly state: ModelLibraryTruthState;
  readonly location?: string;
  readonly detail?: string;
}

export interface INodeExecutionProvenance {
  readonly classification: ExecutionProvenanceKind;
  readonly runtime?: string;
  readonly executorId: string;
  readonly detail?: string;
  readonly nodeType?: string;
  readonly fallback?: IExecutionFallbackInfo;
  readonly mcp?: IMcpExecutionProvenance;
  readonly modelLibrary?: IModelLibraryProvenance;
}

export interface IWorkflowExecutionProvenance {
  readonly classification: ExecutionProvenanceKind;
  readonly runtime?: string;
  readonly strategyId: string;
  readonly detail?: string;
  readonly selectionReason?: string;
  readonly fallback?: IExecutionFallbackInfo;
  readonly nodeCounts?: Readonly<Record<ExecutionProvenanceKind, number>>;
  readonly mcp?: IMcpExecutionProvenance;
  readonly nodeProvenance?: Readonly<Record<string, INodeExecutionProvenance>>;
}

export interface IWorkflowExecutionTarget {
  /**
   * Requested execution engine/runtime.
   * Examples:
   * - comfyui
   * - transformers
   * - ollama
   * - custom
   */
  readonly runtime?: RuntimeEngine | string;

  /**
   * Optional provider/implementation identifier when multiple executors
   * can serve the same runtime.
   */
  readonly provider?: string;

  /**
   * Optional execution profile or environment name.
   * Examples:
   * - local
   * - gpu-1
   * - staging
   */
  readonly profile?: string;
}

export interface IWorkflowExecutionInput {
  /**
   * Workflow to execute.
   */
  readonly workflow: IWorkflow;

  /**
   * Optional explicit target runtime/provider selection.
   */
  readonly target?: IWorkflowExecutionTarget;

  /**
   * Optional execution-time overrides for node properties.
   * Keyed by node ID, then property ID.
   */
  readonly propertyOverrides?: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;

  /**
   * Optional initial input assets bound by node/property/port reference.
   * The exact binding interpretation is executor-specific, but the application
   * can pass domain assets without depending on infrastructure details.
   */
  readonly inputAssets?: ReadonlyArray<IAsset>;

  /**
   * Optional arbitrary serializable execution parameters.
   * Useful for future extensibility without changing the interface.
   */
  readonly parameters?: Readonly<Record<string, unknown>>;

  /**
   * Optional execution metadata shared with downstream node execution contexts.
   */
  readonly executionMetadata?: Readonly<Record<string, unknown>>;
}

export interface IWorkflowExecutionProgress {
  readonly executionId: string;
  readonly status: WorkflowExecutionStatus;

  /**
   * Optional 0-100 percentage for overall workflow execution.
   */
  readonly percent?: number;

  /**
   * Optional current node being executed.
   */
  readonly currentNodeId?: string;

  /**
   * Optional human-readable message.
   */
  readonly message?: string;
}

export interface IWorkflowExecutionEvent {
  readonly executionId: string;
  readonly kind: WorkflowExecutionEventKind;
  readonly status: WorkflowExecutionStatus;

  /**
   * Optional related node.
   */
  readonly nodeId?: string;

  /**
   * Optional produced asset.
   */
  readonly asset?: IAsset;

  /**
   * Optional progress snapshot.
   */
  readonly progress?: IWorkflowExecutionProgress;

  /**
   * Optional human-readable message.
   */
  readonly message?: string;

  /**
   * Optional serializable event payload.
   */
  readonly payload?: Readonly<Record<string, unknown>>;

  /**
   * Optional workflow-level execution provenance.
   */
  readonly provenance?: IWorkflowExecutionProvenance;

  /**
   * Optional node-level provenance when the event is node-related.
   */
  readonly nodeProvenance?: INodeExecutionProvenance;
}

export interface IWorkflowExecutionResult {
  readonly executionId: string;
  readonly status: Extract<
    WorkflowExecutionStatus,
    "completed" | "failed" | "cancelled"
  >;

  /**
   * Any assets produced by the workflow execution.
   */
  readonly outputAssets: ReadonlyArray<IAsset>;

  /**
   * Optional execution-level messages/log summaries.
   */
  readonly messages?: ReadonlyArray<string>;

  /**
   * Optional failure/cancellation reason.
   */
  readonly errorMessage?: string;

  /**
   * Structured description of how execution actually ran.
   */
  readonly provenance?: IWorkflowExecutionProvenance;

  /**
   * Optional normalized execution inspection summary for preview/debugging flows.
   */
  readonly inspection?: Readonly<{
    readonly summary: Readonly<{
      readonly runtime?: string;
      readonly status: "completed" | "failed" | "cancelled";
      readonly outputCount: number;
      readonly lifecycleEventCount?: number;
      readonly messageCount?: number;
      readonly hasError: boolean;
    }>;
    readonly outputs?: ReadonlyArray<Readonly<{
      readonly nodeId?: string;
      readonly kind?: string;
      readonly reference?: string;
      readonly assetId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    }>>;
    readonly diagnostics?: Readonly<{
      readonly errorCode?: string;
      readonly errorCategory?: string;
      readonly errorSeverity?: string;
      readonly message?: string;
      readonly retriable?: boolean;
    }>;
  }>;
}

export interface IWorkflowExecutionHandle {
  readonly executionId: string;
  readonly input: IWorkflowExecutionInput;

  /**
   * Returns the latest known progress snapshot.
   */
  getProgress(): Promise<IWorkflowExecutionProgress>;

  /**
   * Waits for the workflow to complete or fail.
   */
  waitForCompletion(): Promise<IWorkflowExecutionResult>;

  /**
   * Requests cancellation.
   */
  cancel(): Promise<void>;

  /**
   * Optional event subscription for streaming progress.
   */
  subscribe?(
    listener: (event: IWorkflowExecutionEvent) => void
  ): Promise<() => void> | (() => void);
}

export interface IWorkflowExecutor {
  /**
   * Starts workflow execution and returns a handle for polling/subscription.
   */
  startExecution(
    input: IWorkflowExecutionInput
  ): Promise<IWorkflowExecutionHandle>;

  /**
   * Convenience API for one-shot execution.
   */
  execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult>;

  /**
   * Returns true when this executor can execute the given workflow/target.
   */
  canExecute(input: IWorkflowExecutionInput): boolean;
}
