import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";

export type ComfyAdapterLifecycleStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ComfyAdapterErrorCode =
  | "connection-failed"
  | "request-mapping-failed"
  | "invalid-request"
  | "transport-error"
  | "queue-timeout"
  | "execution-failed"
  | "execution-cancelled"
  | "output-normalization-failed"
  | "cancelled"
  | "unknown";

export type ComfyAdapterErrorCategory =
  | "connectivity"
  | "validation"
  | "mapping"
  | "execution"
  | "timeout"
  | "cancellation"
  | "output"
  | "unknown";

export type ComfyAdapterErrorSeverity = "info" | "warning" | "error" | "critical";

export interface IComfyAdapterAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly role?: string;
}

export interface IComfyAdapterExecutionContext {
  readonly identifiers: Readonly<{
    readonly executionId?: string;
    readonly workflowId: string;
    readonly workflowVersionId?: string;
    readonly parentExecutionId?: string;
  }>;
  readonly system?: Readonly<{
    readonly systemAssetRef?: string;
    readonly systemRuntimeRef?: string;
  }>;
  readonly datasets: Readonly<{
    readonly datasetAssetRefs: ReadonlyArray<string>;
    readonly datasetInstanceRefs: ReadonlyArray<string>;
  }>;
  readonly inputs: Readonly<{
    readonly selectedAssetRefs: ReadonlyArray<IComfyAdapterAssetReference>;
  }>;
  readonly runtime: Readonly<{
    readonly parameters: Readonly<Record<string, unknown>>;
    readonly options: Readonly<Record<string, unknown>>;
  }>;
  readonly trigger?: Readonly<{
    readonly source: string;
    readonly action?: string;
    readonly actorId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
  readonly observability?: Readonly<{
    readonly lineageId?: string;
    readonly correlationId?: string;
    readonly tags?: ReadonlyArray<string>;
  }>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IComfyAdapterRequest {
  readonly workflow: IWorkflow;
  readonly propertyOverrides?: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
  readonly inputAssetRefs?: ReadonlyArray<IComfyAdapterAssetReference>;
  readonly runtimeParameters?: Readonly<Record<string, unknown>>;
  readonly context?: IComfyAdapterExecutionContext;
}

export interface IComfyAdapterLifecycleEvent {
  readonly executionId: string;
  readonly status: ComfyAdapterLifecycleStatus;
  readonly percent?: number;
  readonly message?: string;
  readonly queuePosition?: number;
}

export interface IComfyAdapterOutputRecord {
  readonly nodeId: string;
  readonly kind: "image" | "video" | "audio" | "text";
  readonly reference: string;
  readonly assetRef?: {
    readonly assetId: string;
    readonly versionId?: string;
  };
  readonly lineage?: Readonly<{
    readonly sourceExecutionId: string;
    readonly sourceNodeId: string;
    readonly consumedAssetRefs?: ReadonlyArray<IComfyAdapterAssetReference>;
  }>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IComfyAdapterError {
  readonly code: ComfyAdapterErrorCode;
  readonly category: ComfyAdapterErrorCategory;
  readonly severity: ComfyAdapterErrorSeverity;
  readonly message: string;
  readonly retriable: boolean;
  readonly retryable: boolean;
  readonly executionRef?: Readonly<{
    readonly executionId?: string;
    readonly workflowId?: string;
  }>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IComfyAdapterResult {
  readonly executionId: string;
  readonly status: Extract<ComfyAdapterLifecycleStatus, "completed" | "failed" | "cancelled">;
  readonly outputs: ReadonlyArray<IComfyAdapterOutputRecord>;
  readonly lifecycle: ReadonlyArray<IComfyAdapterLifecycleEvent>;
  readonly error?: IComfyAdapterError;
  readonly messages?: ReadonlyArray<string>;
  readonly inspection?: Readonly<{
    readonly executionSummary?: Readonly<Record<string, unknown>>;
    readonly diagnostics?: Readonly<Record<string, unknown>>;
  }>;
}

export interface IComfyAdapterCapabilities {
  readonly runtimeId: "comfyui";
  readonly supportsCancellation: boolean;
  readonly supportsProgressPolling: boolean;
  readonly supportsAssetReferences: boolean;
}

export interface IComfyExecutionAdapter {
  readonly capabilities: IComfyAdapterCapabilities;

  start(
    request: IComfyAdapterRequest,
    onLifecycleEvent?: (event: IComfyAdapterLifecycleEvent) => void
  ): Promise<{
    readonly executionId: string;
    cancel(): Promise<void>;
    waitForCompletion(): Promise<IComfyAdapterResult>;
  }>;
}
