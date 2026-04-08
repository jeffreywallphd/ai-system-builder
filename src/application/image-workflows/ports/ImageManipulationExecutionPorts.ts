import type { ImageWorkflowBackendTranslationReference } from "@domain/image-workflows/ImageWorkflowDomain";

export const ImageManipulationExecutionBackendHealthStates = Object.freeze({
  healthy: "healthy",
  degraded: "degraded",
  unavailable: "unavailable",
});

export type ImageManipulationExecutionBackendHealthState =
  typeof ImageManipulationExecutionBackendHealthStates[keyof typeof ImageManipulationExecutionBackendHealthStates];

export const ImageManipulationExecutionStates = Object.freeze({
  queued: "queued",
  dispatching: "dispatching",
  running: "running",
  completing: "completing",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export type ImageManipulationExecutionState =
  typeof ImageManipulationExecutionStates[keyof typeof ImageManipulationExecutionStates];

export const ImageManipulationExecutionTerminalStates = Object.freeze({
  completed: ImageManipulationExecutionStates.completed,
  failed: ImageManipulationExecutionStates.failed,
  cancelled: ImageManipulationExecutionStates.cancelled,
});

export type ImageManipulationExecutionTerminalState =
  typeof ImageManipulationExecutionTerminalStates[keyof typeof ImageManipulationExecutionTerminalStates];

export const ImageManipulationExecutionProgressEventKinds = Object.freeze({
  queued: "queued",
  started: "started",
  heartbeat: "heartbeat",
  stageChanged: "stage-changed",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export type ImageManipulationExecutionProgressEventKind =
  typeof ImageManipulationExecutionProgressEventKinds[keyof typeof ImageManipulationExecutionProgressEventKinds];

export const ImageManipulationExecutionOutputReferenceKinds = Object.freeze({
  assetReference: "asset-reference",
  datasetItemReference: "dataset-item-reference",
  storageObjectReference: "storage-object-reference",
  externalUrl: "external-url",
  inlineValue: "inline-value",
});

export type ImageManipulationExecutionOutputReferenceKind =
  typeof ImageManipulationExecutionOutputReferenceKinds[keyof typeof ImageManipulationExecutionOutputReferenceKinds];

export const ImageManipulationExecutionErrorCategories = Object.freeze({
  validation: "validation",
  translation: "translation",
  dependency: "dependency",
  capacity: "capacity",
  timeout: "timeout",
  cancellation: "cancellation",
  execution: "execution",
  output: "output",
  connectivity: "connectivity",
  internal: "internal",
});

export type ImageManipulationExecutionErrorCategory =
  typeof ImageManipulationExecutionErrorCategories[keyof typeof ImageManipulationExecutionErrorCategories];

export const ImageManipulationExecutionCancellationStatuses = Object.freeze({
  accepted: "accepted",
  alreadyTerminal: "already-terminal",
  notSupported: "not-supported",
  rejected: "rejected",
  notFound: "not-found",
  failed: "failed",
});

export type ImageManipulationExecutionCancellationStatus =
  typeof ImageManipulationExecutionCancellationStatuses[keyof typeof ImageManipulationExecutionCancellationStatuses];

export interface ImageManipulationExecutionRequestInputAsset {
  readonly inputId: string;
  readonly logicalAssetReference: string;
  readonly role?: string;
}

export interface ImageManipulationExecutionRequestOutputTarget {
  readonly outputId: string;
  readonly logicalTargetReference: string;
  readonly required: boolean;
}

export interface ImageManipulationExecutionDispatchRequest {
  readonly requestId: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly workflow: {
    readonly workflowId: string;
    readonly workflowVersionTag: string;
    readonly workflowRevision: number;
    readonly operationKind: string;
    readonly backendTranslation: ImageWorkflowBackendTranslationReference;
  };
  readonly system: {
    readonly systemId: string;
    readonly systemVersionId?: string;
    readonly runtimeProfileId?: string;
  };
  readonly inputAssets: ReadonlyArray<ImageManipulationExecutionRequestInputAsset>;
  readonly outputTargets: ReadonlyArray<ImageManipulationExecutionRequestOutputTarget>;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly requestedAt: string;
  readonly requestedByActorId?: string;
  readonly correlationId?: string;
}

export interface ImageManipulationExecutionDispatchResult {
  readonly requestId: string;
  readonly runId: string;
  readonly executionJobId: string;
  readonly acceptedAt: string;
  readonly initialState: ImageManipulationExecutionState;
  readonly backendFamily: string;
  readonly backendExecutionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationExecutionError {
  readonly code: string;
  readonly category: ImageManipulationExecutionErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationExecutionStateSnapshot {
  readonly executionJobId: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly state: ImageManipulationExecutionState;
  readonly backendFamily: string;
  readonly backendExecutionId?: string;
  readonly startedAt?: string;
  readonly updatedAt: string;
  readonly finishedAt?: string;
  readonly progressPercent?: number;
  readonly stage?: string;
  readonly message?: string;
  readonly terminalState?: ImageManipulationExecutionTerminalState;
  readonly error?: ImageManipulationExecutionError;
}

export interface ImageManipulationExecutionProgressEvent {
  readonly executionJobId: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly kind: ImageManipulationExecutionProgressEventKind;
  readonly state: ImageManipulationExecutionState;
  readonly progressPercent?: number;
  readonly stage?: string;
  readonly message?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationExecutionOutputReference {
  readonly outputId: string;
  readonly kind: ImageManipulationExecutionOutputReferenceKind;
  readonly logicalReference?: string;
  readonly assetId?: string;
  readonly storageInstanceId?: string;
  readonly objectKey?: string;
  readonly uri?: string;
  readonly value?: unknown;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationExecutionOutputSnapshot {
  readonly executionJobId: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly state: ImageManipulationExecutionState;
  readonly outputs: ReadonlyArray<ImageManipulationExecutionOutputReference>;
  readonly discoveredAt: string;
}

export interface ImageManipulationExecutionBackendCapabilities {
  readonly backendFamily: string;
  readonly supportsProgressPolling: boolean;
  readonly supportsProgressStreaming: boolean;
  readonly supportsCancellation: boolean;
  readonly supportsOutputDiscovery: boolean;
  readonly supportedOperationKinds: ReadonlyArray<string>;
  readonly supportedTranslationContractVersions: ReadonlyArray<string>;
}

export interface ImageManipulationExecutionBackendStatus {
  readonly backendFamily: string;
  readonly health: ImageManipulationExecutionBackendHealthState;
  readonly checkedAt: string;
  readonly message?: string;
  readonly capabilities: ImageManipulationExecutionBackendCapabilities;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface IImageManipulationExecutionDispatchPort {
  dispatchExecution(request: ImageManipulationExecutionDispatchRequest): Promise<ImageManipulationExecutionDispatchResult>;
}

export interface IImageManipulationExecutionStateQueryPort {
  getExecutionState(query: {
    readonly executionJobId: string;
    readonly workspaceId: string;
  }): Promise<ImageManipulationExecutionStateSnapshot | undefined>;
}

export interface IImageManipulationExecutionProgressPort {
  listExecutionProgress(input: {
    readonly executionJobId: string;
    readonly workspaceId: string;
    readonly afterSequence?: number;
    readonly limit?: number;
  }): Promise<ReadonlyArray<ImageManipulationExecutionProgressEvent>>;
  subscribeToExecutionProgress(
    input: {
      readonly executionJobId: string;
      readonly workspaceId: string;
    },
    sink: (event: ImageManipulationExecutionProgressEvent) => void,
  ): Promise<() => void>;
}

export interface IImageManipulationExecutionCancellationPort {
  requestExecutionCancellation(input: {
    readonly executionJobId: string;
    readonly runId: string;
    readonly workspaceId: string;
    readonly requestedAt: string;
    readonly requestedByActorId?: string;
    readonly reason?: string;
  }): Promise<{
    readonly status: ImageManipulationExecutionCancellationStatus;
    readonly acknowledgedAt?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }>;
}

export interface IImageManipulationExecutionOutputPort {
  listExecutionOutputs(query: {
    readonly executionJobId: string;
    readonly workspaceId: string;
  }): Promise<ImageManipulationExecutionOutputSnapshot | undefined>;
}

export interface IImageManipulationExecutionCapabilityPort {
  getExecutionBackendStatus(input: {
    readonly workspaceId: string;
    readonly systemId?: string;
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
  }): Promise<ImageManipulationExecutionBackendStatus>;
}

export interface ImageManipulationExecutionPorts {
  readonly dispatch: IImageManipulationExecutionDispatchPort;
  readonly stateQuery: IImageManipulationExecutionStateQueryPort;
  readonly progress: IImageManipulationExecutionProgressPort;
  readonly cancellation: IImageManipulationExecutionCancellationPort;
  readonly outputs: IImageManipulationExecutionOutputPort;
  readonly capabilities: IImageManipulationExecutionCapabilityPort;
}
