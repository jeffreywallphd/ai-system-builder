import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";

export type ComfyAdapterLifecycleStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ComfyAdapterErrorCode =
  | "invalid-request"
  | "transport-error"
  | "queue-timeout"
  | "execution-failed"
  | "execution-cancelled"
  | "output-normalization-failed"
  | "unknown";

export interface IComfyAdapterAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly role?: string;
}

export interface IComfyAdapterExecutionContext {
  readonly executionId?: string;
  readonly systemId?: string;
  readonly datasetRefs?: ReadonlyArray<string>;
  readonly runtimeOptions?: Readonly<Record<string, unknown>>;
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
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IComfyAdapterError {
  readonly code: ComfyAdapterErrorCode;
  readonly message: string;
  readonly retriable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IComfyAdapterResult {
  readonly executionId: string;
  readonly status: Extract<ComfyAdapterLifecycleStatus, "completed" | "failed" | "cancelled">;
  readonly outputs: ReadonlyArray<IComfyAdapterOutputRecord>;
  readonly lifecycle: ReadonlyArray<IComfyAdapterLifecycleEvent>;
  readonly error?: IComfyAdapterError;
  readonly messages?: ReadonlyArray<string>;
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
