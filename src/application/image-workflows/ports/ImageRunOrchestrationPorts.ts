import type {
  ImageManipulationExecutionCancellationStatus,
  ImageManipulationExecutionDispatchRequest,
  ImageManipulationExecutionDispatchResult,
  ImageManipulationExecutionOutputSnapshot,
  ImageManipulationExecutionProgressEvent,
  ImageManipulationExecutionStateSnapshot,
} from "@application/image-workflows/ports/ImageManipulationExecutionPorts";
import type { ImageManipulationExecutionReadinessSummary } from "@application/image-workflows/GetImageManipulationExecutionReadinessUseCase";
import type { ImageRunSubmissionReadinessResult } from "@application/image-workflows/ImageRunSubmissionReadinessContracts";
import type { ImageRunRecord, ImageRunStatus } from "@domain/runs/ImageRunDomain";

export interface ImageRunListQuery {
  readonly workspaceId: string;
  readonly ownerUserIds?: ReadonlyArray<string>;
  readonly systemIds?: ReadonlyArray<string>;
  readonly workflowIds?: ReadonlyArray<string>;
  readonly statuses?: ReadonlyArray<ImageRunStatus>;
  readonly queueIds?: ReadonlyArray<string>;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ImageRunMutationContext {
  readonly operationKey: string;
  readonly actorUserId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly expectedRevision?: number;
}

export interface ImageRunMutationResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly run: ImageRunRecord;
}

export interface IImageRunRepository {
  findImageRunById(runId: string): Promise<ImageRunRecord | undefined>;
  listImageRuns(query: ImageRunListQuery): Promise<ReadonlyArray<ImageRunRecord>>;
  createImageRun(
    run: ImageRunRecord,
    mutation: ImageRunMutationContext,
  ): Promise<ImageRunMutationResult>;
  saveImageRun(
    run: ImageRunRecord,
    mutation: ImageRunMutationContext,
  ): Promise<ImageRunMutationResult>;
}

export const ImageRunExecutionUpdateKinds = Object.freeze({
  snapshot: "snapshot",
  progressEvent: "progress-event",
  outputSnapshot: "output-snapshot",
});

export type ImageRunExecutionUpdateKind =
  typeof ImageRunExecutionUpdateKinds[keyof typeof ImageRunExecutionUpdateKinds];

export interface ImageRunExecutionStateRecord {
  readonly runId: string;
  readonly workspaceId: string;
  readonly executionJobId: string;
  readonly backendFamily: string;
  readonly backendExecutionId?: string;
  readonly latestState: ImageManipulationExecutionStateSnapshot;
  readonly lastProgressSequence?: number;
  readonly updatedAt: string;
}

export interface ImageRunExecutionProgressLogRecord {
  readonly runId: string;
  readonly workspaceId: string;
  readonly executionJobId: string;
  readonly event: ImageManipulationExecutionProgressEvent;
  readonly ingestedAt: string;
}

export interface ImageRunExecutionOutputRecord {
  readonly runId: string;
  readonly workspaceId: string;
  readonly executionJobId: string;
  readonly outputSnapshot: ImageManipulationExecutionOutputSnapshot;
  readonly discoveredAt: string;
}

export interface ImageRunExecutionUpdateEnvelope {
  readonly kind: ImageRunExecutionUpdateKind;
  readonly runId: string;
  readonly workspaceId: string;
  readonly executionJobId: string;
  readonly occurredAt: string;
  readonly state?: ImageManipulationExecutionStateSnapshot;
  readonly progressEvent?: ImageManipulationExecutionProgressEvent;
  readonly outputSnapshot?: ImageManipulationExecutionOutputSnapshot;
}

export interface IImageRunExecutionStateRepository {
  findExecutionStateByRunId(runId: string): Promise<ImageRunExecutionStateRecord | undefined>;
  saveExecutionState(
    state: ImageRunExecutionStateRecord,
    mutation: ImageRunMutationContext,
  ): Promise<ImageRunExecutionStateRecord>;
  appendExecutionProgressEvents(
    events: ReadonlyArray<ImageRunExecutionProgressLogRecord>,
    mutation: ImageRunMutationContext,
  ): Promise<ReadonlyArray<ImageRunExecutionProgressLogRecord>>;
  saveExecutionOutputSnapshot(
    output: ImageRunExecutionOutputRecord,
    mutation: ImageRunMutationContext,
  ): Promise<ImageRunExecutionOutputRecord>;
  listExecutionUpdates(input: {
    readonly runId: string;
    readonly workspaceId: string;
    readonly afterProgressSequence?: number;
    readonly limit?: number;
  }): Promise<ReadonlyArray<ImageRunExecutionUpdateEnvelope>>;
}

export interface ImageRunQueueEntry {
  readonly runId: string;
  readonly workspaceId: string;
  readonly queueId: string;
  readonly enqueuedAt: string;
  readonly eligibleAt: string;
  readonly schedulingPriority?: number;
  readonly reservationToken?: string;
  readonly reservedBy?: string;
  readonly reservedAt?: string;
  readonly reservationExpiresAt?: string;
}

export interface IImageRunReadinessResolver {
  resolveRunExecutionReadiness(input: {
    readonly workspaceId: string;
    readonly systemId: string;
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
  }): Promise<ImageManipulationExecutionReadinessSummary>;
  resolveRunSubmissionReadiness?(input: {
    readonly workspaceId: string;
    readonly systemId: string;
    readonly workflowId?: string;
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
    readonly inputAssetBindingIds?: ReadonlyArray<string>;
    readonly outputBindingIds?: ReadonlyArray<string>;
    readonly referencedAssetIds?: ReadonlyArray<string>;
  }): Promise<ImageRunSubmissionReadinessResult>;
}

export interface IImageRunQueueOrchestrationPort {
  enqueueRun(input: {
    readonly runId: string;
    readonly workspaceId: string;
    readonly queueId: string;
    readonly enqueuedAt: string;
    readonly eligibleAt?: string;
    readonly schedulingPriority?: number;
  }): Promise<ImageRunQueueEntry>;
  claimRunsForDispatch?(input: {
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly asOf: string;
  }): Promise<ReadonlyArray<ImageRunQueueEntry>>;
  releaseRunReservation?(input: {
    readonly runId: string;
    readonly reservationToken: string;
    readonly releasedAt: string;
  }): Promise<boolean>;
}

export interface ImageRunExecutionHandoffRequest {
  readonly runId: string;
  readonly workspaceId: string;
  readonly queuedEntry: ImageRunQueueEntry;
  readonly dispatchRequest: ImageManipulationExecutionDispatchRequest;
}

export interface ImageRunExecutionHandoffReceipt {
  readonly runId: string;
  readonly workspaceId: string;
  readonly queueId: string;
  readonly dispatch: ImageManipulationExecutionDispatchResult;
}

export interface IImageRunExecutionHandoffPort {
  handoffExecution(request: ImageRunExecutionHandoffRequest): Promise<ImageRunExecutionHandoffReceipt>;
}

export interface IImageRunExecutionUpdatePort {
  pollExecutionUpdates(input: {
    readonly runId: string;
    readonly workspaceId: string;
    readonly executionJobId: string;
    readonly afterSequence?: number;
    readonly limit?: number;
  }): Promise<ReadonlyArray<ImageRunExecutionUpdateEnvelope>>;
  subscribeToExecutionUpdates(
    input: {
      readonly runId: string;
      readonly workspaceId: string;
      readonly executionJobId: string;
    },
    sink: (update: ImageRunExecutionUpdateEnvelope) => void,
  ): Promise<() => void>;
}

export interface IImageRunCancellationOrchestrationPort {
  requestRunCancellation(input: {
    readonly runId: string;
    readonly workspaceId: string;
    readonly executionJobId?: string;
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

export interface IImageRunOutputHandoffNotificationPort {
  notifyRunOutputsAvailable(input: {
    readonly runId: string;
    readonly workspaceId: string;
    readonly executionJobId: string;
    readonly outputSnapshot: ImageManipulationExecutionOutputSnapshot;
    readonly notifiedAt: string;
  }): Promise<void>;
}

export interface ImageRunOrchestrationPorts {
  readonly runs: IImageRunRepository;
  readonly executionState: IImageRunExecutionStateRepository;
  readonly readiness: IImageRunReadinessResolver;
  readonly queue: IImageRunQueueOrchestrationPort;
  readonly executionHandoff: IImageRunExecutionHandoffPort;
  readonly executionUpdates: IImageRunExecutionUpdatePort;
  readonly cancellation: IImageRunCancellationOrchestrationPort;
  readonly outputHandoff: IImageRunOutputHandoffNotificationPort;
}
