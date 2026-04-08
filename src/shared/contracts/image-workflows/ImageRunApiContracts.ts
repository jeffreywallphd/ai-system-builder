import type { SharedApiMutationResult } from "@shared/contracts/api/SharedApiContractPrimitives";
import type { RunLifecycleState, RunSubmissionSource } from "@domain/runs/RunDomain";
import {
  ImageManipulationFailureSummaryCategories,
  type ImageManipulationFailureSummaryCategory,
} from "./ImageManipulationValidationFailureTaxonomy";

export class ImageRunApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRunApiContractError";
  }
}

export const ImageRunApiContractVersions = Object.freeze({
  v1: "image-run-api/v1",
} as const);

export type ImageRunApiContractVersion =
  typeof ImageRunApiContractVersions[keyof typeof ImageRunApiContractVersions];

export const ImageRunApiRoutes = Object.freeze({
  submitRun: "/api/v1/image-systems/:systemId/runs",
  getRun: "/api/v1/image-runs/:runId",
  listRuns: "/api/v1/image-runs",
  getRunStatus: "/api/v1/image-runs/:runId/status",
  cancelRun: "/api/v1/image-runs/:runId/cancel",
  listRunEvents: "/api/v1/image-runs/:runId/events",
  getExecutionReadiness: "/api/v1/image-runs/execution/readiness",
} as const);

export const ImageRunTerminalStates = Object.freeze({
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
} as const);

export type ImageRunTerminalState = typeof ImageRunTerminalStates[keyof typeof ImageRunTerminalStates];

export const ImageRunFailureVisibilities = Object.freeze({
  userSafe: "user-safe",
  admin: "admin",
} as const);

export type ImageRunFailureVisibility =
  typeof ImageRunFailureVisibilities[keyof typeof ImageRunFailureVisibilities];

export const ImageRunFailureCategories = Object.freeze({
  validation: ImageManipulationFailureSummaryCategories.validation,
  translation: ImageManipulationFailureSummaryCategories.translation,
  dependency: ImageManipulationFailureSummaryCategories.dependency,
  capacity: ImageManipulationFailureSummaryCategories.capacity,
  timeout: ImageManipulationFailureSummaryCategories.timeout,
  cancellation: ImageManipulationFailureSummaryCategories.cancellation,
  execution: ImageManipulationFailureSummaryCategories.execution,
  output: ImageManipulationFailureSummaryCategories.output,
  connectivity: ImageManipulationFailureSummaryCategories.connectivity,
  internal: ImageManipulationFailureSummaryCategories.internal,
  unknown: ImageManipulationFailureSummaryCategories.unknown,
} as const);

export type ImageRunFailureCategory = ImageManipulationFailureSummaryCategory;

export const ImageRunEventCategories = Object.freeze({
  lifecycle: "lifecycle",
  progress: "progress",
  failure: "failure",
  result: "result",
  cancellation: "cancellation",
} as const);

export type ImageRunEventCategory = typeof ImageRunEventCategories[keyof typeof ImageRunEventCategories];

export const ImageRunEventKinds = Object.freeze({
  submissionAccepted: "submission-accepted",
  stateChanged: "state-changed",
  progressUpdated: "progress-updated",
  cancellationRequested: "cancellation-requested",
  cancelled: "cancelled",
  failed: "failed",
  completed: "completed",
  resultAttached: "result-attached",
} as const);

export type ImageRunEventKind = typeof ImageRunEventKinds[keyof typeof ImageRunEventKinds];

export const ImageRunReadinessStates = Object.freeze({
  ready: "ready",
  degraded: "degraded",
  unavailable: "unavailable",
} as const);

export type ImageRunReadinessState = typeof ImageRunReadinessStates[keyof typeof ImageRunReadinessStates];

export const ImageRunSubmissionReadinessStates = Object.freeze({
  ready: "ready",
  advisory: "advisory",
  blocked: "blocked",
} as const);

export type ImageRunSubmissionReadinessState =
  typeof ImageRunSubmissionReadinessStates[keyof typeof ImageRunSubmissionReadinessStates];

export const ImageRunSubmissionReadinessIssueCategories = Object.freeze({
  blocking: "blocking",
  advisory: "advisory",
  policyDenial: "policy-denial",
  assetBinding: "asset-binding",
  systemValidity: "system-validity",
  workflowValidity: "workflow-validity",
  backendReadinessDependency: "backend-readiness-dependency",
  compatibility: "compatibility",
} as const);

export type ImageRunSubmissionReadinessIssueCategory =
  typeof ImageRunSubmissionReadinessIssueCategories[keyof typeof ImageRunSubmissionReadinessIssueCategories];

export const ImageRunSubmissionReadinessIssueSeverities = Object.freeze({
  error: "error",
  warning: "warning",
  info: "info",
} as const);

export type ImageRunSubmissionReadinessIssueSeverity =
  typeof ImageRunSubmissionReadinessIssueSeverities[keyof typeof ImageRunSubmissionReadinessIssueSeverities];

export interface ImageRunSubmissionInputAssetReference {
  readonly bindingId: string;
  readonly assetId: string;
  readonly assetVersionId?: string;
}

export interface ImageRunSubmissionRequestDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly systemId: string;
  readonly operationKey?: string;
  readonly source?: RunSubmissionSource;
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
  readonly inputAssets?: ReadonlyArray<ImageRunSubmissionInputAssetReference>;
  readonly parameterOverrides?: Readonly<Record<string, unknown>>;
  readonly tags?: ReadonlyArray<string>;
}

export interface ImageRunSummaryDto {
  readonly runId: string;
  readonly workspaceId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly state: RunLifecycleState;
  readonly source: RunSubmissionSource;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly progress?: ImageRunProgressSnapshotDto;
  readonly failure?: ImageRunFailureSummaryDto;
  readonly result?: ImageRunResultSummaryDto;
}

export interface ImageRunDetailDto extends ImageRunSummaryDto {
  readonly submittedByActorId?: string;
  readonly correlationId?: string;
  readonly cancellation?: {
    readonly requestedAt: string;
    readonly requestedByActorId?: string;
    readonly reason?: string;
    readonly acknowledgedAt?: string;
  };
  readonly readiness?: ImageRunExecutionReadinessSummaryDto;
  readonly submissionReadiness?: ImageRunSubmissionReadinessSummaryDto;
}

export interface ImageRunProgressSnapshotDto {
  readonly state: RunLifecycleState;
  readonly updatedAt: string;
  readonly percent?: number;
  readonly stageCode?: string;
  readonly stageLabel?: string;
  readonly message?: string;
  readonly queuePosition?: number;
  readonly etaSeconds?: number;
  readonly completedUnitCount?: number;
  readonly totalUnitCount?: number;
  readonly partialOutputCount?: number;
}

export interface ImageRunFailureSummaryDto {
  readonly code: string;
  readonly category: ImageRunFailureCategory;
  readonly summary: string;
  readonly userMessage?: string;
  readonly retryable: boolean;
  readonly failedAt: string;
  readonly stageCode?: string;
  readonly partialProgressObserved: boolean;
  readonly partialOutputCount: number;
  readonly visibility: ImageRunFailureVisibility;
  readonly diagnostics?: {
    readonly detailKeys: ReadonlyArray<string>;
  };
}

export interface ImageRunResultOutputReferenceDto {
  readonly outputId: string;
  readonly assetId?: string;
  readonly assetVersionId?: string;
  readonly mediaType?: string;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ImageRunResultSummaryDto {
  readonly completedAt: string;
  readonly durationMs?: number;
  readonly outputCount: number;
  readonly partialOutputCount?: number;
  readonly hadPartialOutputs: boolean;
  readonly outputs: ReadonlyArray<ImageRunResultOutputReferenceDto>;
  readonly warningCount?: number;
  readonly summary?: string;
}

export interface SubmitImageRunResponseDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly run: ImageRunDetailDto;
  readonly mutation: SharedApiMutationResult;
}

export interface GetImageRunRequestDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly workspaceId: string;
  readonly runId: string;
}

export interface GetImageRunResponseDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly run: ImageRunDetailDto;
}

export interface ListImageRunsRequestDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly workspaceId: string;
  readonly systemId?: string;
  readonly states?: ReadonlyArray<RunLifecycleState>;
  readonly sources?: ReadonlyArray<RunSubmissionSource>;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: "submittedAt" | "updatedAt" | "state";
  readonly sortDirection?: "asc" | "desc";
}

export interface ListImageRunsResponseDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly items: ReadonlyArray<ImageRunSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface GetImageRunStatusRequestDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly workspaceId: string;
  readonly runId: string;
}

export interface GetImageRunStatusResponseDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly runId: string;
  readonly workspaceId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly state: RunLifecycleState;
  readonly updatedAt: string;
  readonly progress?: ImageRunProgressSnapshotDto;
  readonly failure?: ImageRunFailureSummaryDto;
  readonly result?: ImageRunResultSummaryDto;
}

export interface CancelImageRunRequestDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly workspaceId: string;
  readonly runId: string;
  readonly requestedByActorId?: string;
  readonly reason?: string;
  readonly idempotencyKey?: string;
}

export interface CancelImageRunResponseDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly run: ImageRunDetailDto;
  readonly mutation: SharedApiMutationResult;
}

export interface ImageRunExecutionReadinessIssueDto {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
}

export interface ImageRunExecutionReadinessSummaryDto {
  readonly backendFamily: string;
  readonly checkedAt: string;
  readonly readiness: ImageRunReadinessState;
  readonly readyForExecution: boolean;
  readonly message?: string;
  readonly capabilities: {
    readonly backendFamily: string;
    readonly supportsProgressPolling: boolean;
    readonly supportsProgressStreaming: boolean;
    readonly supportsCancellation: boolean;
    readonly supportsOutputDiscovery: boolean;
    readonly supportedOperationKinds: ReadonlyArray<string>;
    readonly supportedTranslationContractVersions: ReadonlyArray<string>;
  };
  readonly issues: ReadonlyArray<ImageRunExecutionReadinessIssueDto>;
}

export interface ImageRunSubmissionReadinessIssueDto {
  readonly code: string;
  readonly summary: string;
  readonly category: ImageRunSubmissionReadinessIssueCategory;
  readonly severity: ImageRunSubmissionReadinessIssueSeverity;
  readonly blocking: boolean;
  readonly path?: string;
}

export interface ImageRunSubmissionReadinessPolicyDenialDto {
  readonly policyId: string;
  readonly code: string;
  readonly summary: string;
}

export interface ImageRunSubmissionAssetBindingCompletenessDto {
  readonly complete: boolean;
  readonly missingInputBindingIds: ReadonlyArray<string>;
  readonly missingOutputBindingIds: ReadonlyArray<string>;
  readonly unresolvedAssetReferences: ReadonlyArray<string>;
}

export interface ImageRunSubmissionDefinitionValidityDto {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssueDto>;
}

export interface ImageRunSubmissionBackendReadinessDependencyDto {
  readonly adapterHealth: "healthy" | "degraded" | "unavailable" | "unknown";
  readonly ready: boolean;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssueDto>;
}

export interface ImageRunSubmissionCompatibilityDto {
  readonly compatible: boolean;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssueDto>;
}

export interface ImageRunSubmissionReadinessSummaryDto {
  readonly checkedAt: string;
  readonly state: ImageRunSubmissionReadinessState;
  readonly readyForQueueing: boolean;
  readonly summary: string;
  readonly issues: ReadonlyArray<ImageRunSubmissionReadinessIssueDto>;
  readonly blockingIssues: ReadonlyArray<ImageRunSubmissionReadinessIssueDto>;
  readonly advisoryIssues: ReadonlyArray<ImageRunSubmissionReadinessIssueDto>;
  readonly policyDenials: ReadonlyArray<ImageRunSubmissionReadinessPolicyDenialDto>;
  readonly assetBinding: ImageRunSubmissionAssetBindingCompletenessDto;
  readonly workflowValidity: ImageRunSubmissionDefinitionValidityDto;
  readonly systemValidity: ImageRunSubmissionDefinitionValidityDto;
  readonly backendReadinessDependency: ImageRunSubmissionBackendReadinessDependencyDto;
  readonly compatibility: ImageRunSubmissionCompatibilityDto;
}

export interface GetImageRunExecutionReadinessRequestDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly workspaceId: string;
  readonly systemId?: string;
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
}

export interface GetImageRunExecutionReadinessResponseDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly readiness: ImageRunExecutionReadinessSummaryDto;
}

export interface ListImageRunEventsRequestDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly workspaceId: string;
  readonly runId: string;
  readonly afterCursor?: string;
  readonly limit?: number;
}

export interface ImageRunLifecycleEventPayload {
  readonly previousState?: RunLifecycleState;
  readonly state: RunLifecycleState;
  readonly reasonCode?: string;
  readonly reasonMessage?: string;
}

export interface ImageRunProgressEventPayload {
  readonly progress: ImageRunProgressSnapshotDto;
}

export interface ImageRunFailureEventPayload {
  readonly failure: ImageRunFailureSummaryDto;
}

export interface ImageRunResultEventPayload {
  readonly result: ImageRunResultSummaryDto;
}

export interface ImageRunCancellationEventPayload {
  readonly requestedAt: string;
  readonly requestedByActorId?: string;
  readonly reason?: string;
}

export type ImageRunEventPayload =
  | ImageRunLifecycleEventPayload
  | ImageRunProgressEventPayload
  | ImageRunFailureEventPayload
  | ImageRunResultEventPayload
  | ImageRunCancellationEventPayload;

export interface ImageRunEventEnvelopeDto {
  readonly eventId: string;
  readonly contractVersion: ImageRunApiContractVersion;
  readonly category: ImageRunEventCategory;
  readonly eventKind: ImageRunEventKind;
  readonly runId: string;
  readonly workspaceId: string;
  readonly systemId: string;
  readonly occurredAt: string;
  readonly sequence: number;
  readonly cursor: string;
  readonly payload: ImageRunEventPayload;
}

export interface ListImageRunEventsResponseDto {
  readonly contractVersion: ImageRunApiContractVersion;
  readonly items: ReadonlyArray<ImageRunEventEnvelopeDto>;
  readonly nextCursor?: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageRunApiContractError(`${field} is required.`);
  }
  return normalized;
}

function appendOptional(query: URLSearchParams, key: string, value?: string): void {
  const normalized = value?.trim();
  if (normalized) {
    query.set(key, normalized);
  }
}

function appendOptionalList(query: URLSearchParams, key: string, values?: ReadonlyArray<string>): void {
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      query.append(key, normalized);
    }
  }
}

export function toListImageRunsQueryParams(request: ListImageRunsRequestDto): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(request.workspaceId, "workspaceId"));
  appendOptional(query, "systemId", request.systemId);
  appendOptionalList(query, "state", request.states);
  appendOptionalList(query, "source", request.sources);
  appendOptional(query, "search", request.search);
  appendOptional(query, "sortBy", request.sortBy);
  appendOptional(query, "sortDirection", request.sortDirection);
  if (typeof request.limit === "number") {
    query.set("limit", String(request.limit));
  }
  if (typeof request.offset === "number") {
    query.set("offset", String(request.offset));
  }
  return query;
}

export function toListImageRunEventsQueryParams(request: ListImageRunEventsRequestDto): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(request.workspaceId, "workspaceId"));
  query.set("runId", normalizeRequired(request.runId, "runId"));
  appendOptional(query, "afterCursor", request.afterCursor);
  if (typeof request.limit === "number") {
    query.set("limit", String(request.limit));
  }
  return query;
}

export function buildImageRunEventCursor(sequence: number): string {
  const normalized = Math.max(1, Math.floor(sequence));
  return `image-run-event:${normalized}`;
}

export function parseImageRunEventCursor(cursor: string | undefined): number | undefined {
  const normalized = cursor?.trim();
  if (!normalized) {
    return undefined;
  }
  const match = normalized.match(/^image-run-event:(\d+)$/);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}
