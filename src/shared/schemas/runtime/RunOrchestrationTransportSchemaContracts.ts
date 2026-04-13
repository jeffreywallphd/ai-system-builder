import { z } from "zod";
import {
  ExecutionReadinessNodeAvailabilityStates,
  ExecutionReadinessStates,
  RunLifecycleEventKinds,
  RunMutationActions,
  RunOrchestrationTransportContractVersions,
  RunSchedulingPriorityBands,
  RunResultOutputAvailabilityHints,
  RunResultAvailabilityStates,
  RunResultOutputReferenceKinds,
  RunResultTerminalQualityHints,
  resolveRunSubmissionSource,
  type RunSubmissionRequest,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  RuntimeAvailabilityResponseContractVersions,
  RuntimeAvailabilityStates,
} from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
} from "@domain/runs/RunDomain";

export interface RunOrchestrationTransportSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class RunOrchestrationTransportSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<RunOrchestrationTransportSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<RunOrchestrationTransportSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "RunOrchestrationTransportSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });
const OptionalReasonSchema = z.string().trim().min(1).max(512).optional();

const RunSubmissionSourceSchema = z.enum([
  RunSubmissionSources.uiManual,
  RunSubmissionSources.uiRerun,
  RunSubmissionSources.api,
  RunSubmissionSources.scheduleTrigger,
  RunSubmissionSources.eventTrigger,
  RunSubmissionSources.internalOrchestrator,
]);

const RunLifecycleStateSchema = z.enum([
  RunLifecycleStates.submitted,
  RunLifecycleStates.queued,
  RunLifecycleStates.assignmentPending,
  RunLifecycleStates.assigned,
  RunLifecycleStates.dispatching,
  RunLifecycleStates.running,
  RunLifecycleStates.cancelling,
  RunLifecycleStates.retryPending,
  RunLifecycleStates.completed,
  RunLifecycleStates.failed,
  RunLifecycleStates.cancelled,
]);

const RunListSortBySchema = z.enum([
  "submittedAt",
  "updatedAt",
  "state",
]);

const RunListSortDirectionSchema = z.enum([
  "asc",
  "desc",
]);

const RunAssignmentStatusSchema = z.enum([
  RunAssignmentStatuses.unassigned,
  RunAssignmentStatuses.pending,
  RunAssignmentStatuses.assigned,
  RunAssignmentStatuses.released,
]);

const RunExecutionOutcomeSchema = z.enum([
  RunExecutionOutcomeKinds.none,
  RunExecutionOutcomeKinds.succeeded,
  RunExecutionOutcomeKinds.failed,
  RunExecutionOutcomeKinds.cancelled,
]);

const RunActionEligibilitySchema = z.object({
  allowed: z.boolean(),
  reason: z.string().trim().min(1).max(512).optional(),
}).strict();

const RunActionAvailabilitySchema = z.object({
  cancel: RunActionEligibilitySchema,
  retry: RunActionEligibilitySchema,
  dequeue: RunActionEligibilitySchema,
}).strict();

const RunFailureSummarySchema = z.object({
  code: z.string().trim().min(1).max(256),
  message: z.string().trim().min(1).max(2000),
  retryable: z.boolean(),
  occurredAt: TimestampSchema.optional(),
  diagnostics: z.object({
    visibility: z.literal("admin"),
    latestDispatchFailure: z.object({
      attemptId: IdentifierSchema,
      recordedAt: TimestampSchema,
      nodeId: IdentifierSchema,
      safeCode: z.string().trim().min(1).max(256),
      safeMessage: z.string().trim().min(1).max(2000),
      internalCode: z.string().trim().min(1).max(256).optional(),
      retryable: z.boolean().optional(),
      detailKeys: z.array(z.string().trim().min(1).max(256)).max(256).optional(),
    }).strict().optional(),
    latestExecutionTelemetry: z.object({
      updatedAt: TimestampSchema.optional(),
      senderNodeId: IdentifierSchema.optional(),
      senderBackendKind: IdentifierSchema.optional(),
      senderBackendRunId: IdentifierSchema.optional(),
      diagnosticKeys: z.array(z.string().trim().min(1).max(256)).max(256).optional(),
      finalizationDiagnosticKeys: z.array(z.string().trim().min(1).max(256)).max(256).optional(),
      registrationDiagnosticKeys: z.array(z.string().trim().min(1).max(256)).max(256).optional(),
    }).strict().optional(),
  }).strict().optional(),
}).strict();

const RunStatusTimelineEntrySchema = z.object({
  occurredAt: TimestampSchema,
  state: RunLifecycleStateSchema,
  source: z.enum(["run-state", "audit"]),
  kind: z.enum([
    "submission",
    "lifecycle-transition",
    "dispatch-attempt",
    "progress",
    "cancellation",
    "retry",
  ]).optional(),
  message: z.string().trim().min(1).max(1024).optional(),
}).strict();

const RunSchedulingPriorityBandSchema = z.enum([
  RunSchedulingPriorityBands.critical,
  RunSchedulingPriorityBands.high,
  RunSchedulingPriorityBands.normal,
  RunSchedulingPriorityBands.low,
]);

const RunSchedulingEffectivePrioritySchema = z.object({
  priorityBand: RunSchedulingPriorityBandSchema,
  rolePriorityScore: z.number(),
  queueAgeSeconds: z.number().int().min(0).optional(),
  asOf: TimestampSchema,
}).strict();

const RunSchedulingCandidateConstraintsSchema = z.object({
  requiredCapabilities: z.array(IdentifierSchema).max(128),
  requiresRemoteScheduling: z.boolean(),
}).strict();

const RunSchedulingDeferStatusSchema = z.object({
  eligibilityMarker: z.enum(["ready", "deferred", "blocked"]),
  deferCount: z.number().int().min(0),
  nextEligibleAt: TimestampSchema,
  reasonCodes: z.array(z.string().trim().min(1).max(128)).max(64),
  reasonMessage: z.string().trim().min(1).max(1024).optional(),
  decisionId: IdentifierSchema.optional(),
  recordedAt: TimestampSchema.optional(),
}).strict();

const RunSchedulingPlacementOutcomeSchema = z.object({
  outcome: z.enum(["assignment-recommended", "deferred", "no-placement", "not-applicable"]),
  selectedNodeId: IdentifierSchema.optional(),
  dispatchAttemptNodeId: IdentifierSchema.optional(),
  reasonCodes: z.array(z.string().trim().min(1).max(128)).max(64),
  reasonMessage: z.string().trim().min(1).max(1024).optional(),
  decisionId: IdentifierSchema.optional(),
}).strict();

const RunSchedulingAdminDiagnosticsSchema = z.object({
  requiresAdministrativeAttention: z.boolean(),
  noPlacementCategory: z.string().trim().min(1).max(128).optional(),
  reasonCodes: z.array(z.string().trim().min(1).max(128)).max(64),
  decisionReasonCodes: z.array(z.string().trim().min(1).max(128)).max(64),
  exclusionReasonCodes: z.array(z.string().trim().min(1).max(128)).max(64),
}).strict();

const RunSchedulingVisibilityProjectionSchema = z.object({
  effectivePriority: RunSchedulingEffectivePrioritySchema.optional(),
  candidateConstraints: RunSchedulingCandidateConstraintsSchema.optional(),
  defer: RunSchedulingDeferStatusSchema.optional(),
  placement: RunSchedulingPlacementOutcomeSchema,
  admin: RunSchedulingAdminDiagnosticsSchema.optional(),
}).strict();

const RuntimeTargetSchema = z.object({
  systemId: IdentifierSchema,
  versionId: IdentifierSchema,
  executionId: IdentifierSchema.optional(),
  tenantId: IdentifierSchema.optional(),
  async: z.boolean().optional(),
}).strict();

const LegacyRuntimeStartRunRequestSchema = z.object({
  systemId: IdentifierSchema,
  versionId: IdentifierSchema,
  executionId: IdentifierSchema.optional(),
  tenantId: IdentifierSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
  async: z.boolean().optional(),
}).strict();

const CanonicalRunSubmissionRequestSchema = z.object({
  workflowId: IdentifierSchema.optional(),
  workspaceId: IdentifierSchema.optional(),
  source: RunSubmissionSourceSchema.optional(),
  submittedByActorId: IdentifierSchema.optional(),
  clientRequestId: IdentifierSchema.optional(),
  correlationId: IdentifierSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
  runtimeTarget: RuntimeTargetSchema,
  tags: z.array(IdentifierSchema).max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const RunSubmissionRequestSchema = z.union([
  CanonicalRunSubmissionRequestSchema,
  LegacyRuntimeStartRunRequestSchema,
]);

const RunQueueStatusSnapshotSchema = z.object({
  queueId: IdentifierSchema,
  enteredAt: TimestampSchema,
  position: z.number().int().positive().nullable(),
  positionAsOf: TimestampSchema,
  dequeuedAt: TimestampSchema.optional(),
}).strict();

const RunSummarySchema = z.object({
  contractVersion: z.literal(RunOrchestrationTransportContractVersions.v1),
  runId: IdentifierSchema,
  workflowId: IdentifierSchema,
  workspaceId: IdentifierSchema.optional(),
  source: RunSubmissionSourceSchema,
  state: RunLifecycleStateSchema,
  assignmentStatus: RunAssignmentStatusSchema,
  executionOutcome: RunExecutionOutcomeSchema,
  submittedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  queue: RunQueueStatusSnapshotSchema.optional(),
  actionAvailability: RunActionAvailabilitySchema.optional(),
  failureSummary: RunFailureSummarySchema.optional(),
  scheduling: RunSchedulingVisibilityProjectionSchema.optional(),
}).strict();

const RunSubmissionMetadataSchema = z.object({
  submittedByActorId: IdentifierSchema.optional(),
  clientRequestId: IdentifierSchema.optional(),
  correlationId: IdentifierSchema.optional(),
}).strict();

const RunAssignmentSchema = z.object({
  status: RunAssignmentStatusSchema,
  candidateNodeId: IdentifierSchema.optional(),
  assignedNodeId: IdentifierSchema.optional(),
  assignedAt: TimestampSchema.optional(),
  releasedAt: TimestampSchema.optional(),
  releaseReason: z.string().trim().min(1).max(512).optional(),
}).strict();

const RunExecutionSchema = z.object({
  adapterKind: IdentifierSchema.optional(),
  adapterRunId: IdentifierSchema.optional(),
  startedAt: TimestampSchema.optional(),
  heartbeatAt: TimestampSchema.optional(),
  finishedAt: TimestampSchema.optional(),
  outcome: RunExecutionOutcomeSchema,
  errorCode: IdentifierSchema.optional(),
  errorMessage: z.string().trim().min(1).max(2000).optional(),
  progress: z.object({
    updatedAt: TimestampSchema,
    percent: z.number().min(0).max(100).optional(),
    stage: z.string().trim().min(1).max(256).optional(),
    message: z.string().trim().min(1).max(1024).optional(),
  }).strict().optional(),
}).strict();

const RunResultOutputReferenceSchema = z.object({
  outputId: IdentifierSchema,
  kind: z.enum([
    RunResultOutputReferenceKinds.asset,
    RunResultOutputReferenceKinds.storageObject,
    RunResultOutputReferenceKinds.url,
    RunResultOutputReferenceKinds.inline,
  ]),
  label: z.string().trim().min(1).max(256).optional(),
  assetId: IdentifierSchema.optional(),
  storageInstanceId: IdentifierSchema.optional(),
  objectKey: z.string().trim().min(1).max(2048).optional(),
  objectVersionId: z.string().trim().min(1).max(512).optional(),
  uri: z.string().trim().min(1).max(4096).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

const RunResultSummarySchema = z.object({
  summary: z.string().trim().min(1).max(2000).optional(),
  externalResultId: IdentifierSchema.optional(),
  outputs: z.array(RunResultOutputReferenceSchema),
  metrics: z.record(z.string(), z.unknown()).optional(),
  resultAvailabilityState: z.enum([
    RunResultAvailabilityStates.pendingResult,
    RunResultAvailabilityStates.partiallyCollected,
    RunResultAvailabilityStates.available,
    RunResultAvailabilityStates.previewPending,
    RunResultAvailabilityStates.failedCollection,
  ]).optional(),
  outputAvailability: z.enum([
    RunResultOutputAvailabilityHints.none,
    RunResultOutputAvailabilityHints.partial,
    RunResultOutputAvailabilityHints.available,
    RunResultOutputAvailabilityHints.degraded,
  ]).optional(),
  terminalQuality: z.enum([
    RunResultTerminalQualityHints.standard,
    RunResultTerminalQualityHints.partial,
    RunResultTerminalQualityHints.degraded,
  ]).optional(),
}).strict();

const RunCancellationSchema = z.object({
  requestedAt: TimestampSchema,
  requestedByActorId: IdentifierSchema.optional(),
  reason: OptionalReasonSchema,
  acknowledgedAt: TimestampSchema.optional(),
}).strict();

const RunRetrySchema = z.object({
  attempt: z.number().int().min(1),
  maxAttempts: z.number().int().min(1),
  previousRunId: IdentifierSchema.optional(),
  retryReason: OptionalReasonSchema,
  queuedAt: TimestampSchema.optional(),
}).strict();

export const RunDetailSchema = RunSummarySchema.extend({
  submission: RunSubmissionMetadataSchema,
  assignment: RunAssignmentSchema,
  execution: RunExecutionSchema,
  cancellation: RunCancellationSchema.optional(),
  retry: RunRetrySchema,
  finalization: RunResultSummarySchema.extend({
    finalizedAt: TimestampSchema,
    outcome: z.enum(["completed", "failed", "cancelled"]),
  }).strict().optional(),
  statusTimeline: z.array(RunStatusTimelineEntrySchema).optional(),
}).strict();

export const RunListReadRequestSchema = z.object({
  workspaceId: IdentifierSchema,
  states: z.array(RunLifecycleStateSchema).max(16).optional(),
  sources: z.array(RunSubmissionSourceSchema).max(16).optional(),
  search: z.string().trim().min(1).max(256).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  sortBy: RunListSortBySchema.optional(),
  sortDirection: RunListSortDirectionSchema.optional(),
}).strict();

const MutationResultSchema = z.object({
  changed: z.boolean(),
  mutationId: IdentifierSchema.optional(),
  occurredAt: TimestampSchema.optional(),
}).strict();

const RunSubmissionValidationIssueSchema = z.object({
  path: z.string().trim().min(1),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
}).strict();

export const RunSubmissionAcceptedResponseSchema = z.object({
  run: RunDetailSchema,
  mutation: MutationResultSchema,
  validationIssues: z.array(RunSubmissionValidationIssueSchema).optional(),
}).strict();

export const RunListReadResponseSchema = z.object({
  items: z.array(RunSummarySchema),
  totalCount: z.number().int().min(0),
}).strict();

export const RunStatusEnvelopeSchema = z.object({
  runId: IdentifierSchema,
  state: RunLifecycleStateSchema,
  updatedAt: TimestampSchema,
  queue: RunQueueStatusSnapshotSchema.optional(),
  assignmentStatus: RunAssignmentStatusSchema,
  executionOutcome: RunExecutionOutcomeSchema,
  execution: z.object({
    startedAt: TimestampSchema.optional(),
    heartbeatAt: TimestampSchema.optional(),
    finishedAt: TimestampSchema.optional(),
    progress: z.object({
      updatedAt: TimestampSchema,
      percent: z.number().min(0).max(100).optional(),
      stage: z.string().trim().min(1).max(256).optional(),
      message: z.string().trim().min(1).max(1024).optional(),
    }).strict().optional(),
  }).strict().optional(),
  retry: z.object({
    attempt: z.number().int().min(1),
    maxAttempts: z.number().int().min(1),
    queuedAt: TimestampSchema.optional(),
  }).strict(),
  finalization: RunResultSummarySchema.extend({
    finalizedAt: TimestampSchema,
    outcome: z.enum(["completed", "failed", "cancelled"]),
  }).strict().optional(),
  actionAvailability: RunActionAvailabilitySchema.optional(),
  failureSummary: RunFailureSummarySchema.optional(),
  statusTimeline: z.array(RunStatusTimelineEntrySchema).optional(),
}).strict();

export const RunQueueStatusReadRequestSchema = z.object({
  workspaceId: IdentifierSchema,
  statuses: z.array(RunLifecycleStateSchema).max(16).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

const RunQueueStatusItemSchema = z.object({
  runId: IdentifierSchema,
  workflowId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  state: RunLifecycleStateSchema,
  queue: RunQueueStatusSnapshotSchema,
  assignmentStatus: RunAssignmentStatusSchema,
  executionOutcome: RunExecutionOutcomeSchema,
  updatedAt: TimestampSchema,
  actionAvailability: RunActionAvailabilitySchema.optional(),
  failureSummary: RunFailureSummarySchema.optional(),
  scheduling: RunSchedulingVisibilityProjectionSchema.optional(),
}).strict();

export const ExecutionReadinessReadRequestSchema = z.object({
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema.optional(),
  operationKind: IdentifierSchema.optional(),
  translationContractVersion: IdentifierSchema.optional(),
}).strict();

const ExecutionReadinessIssueSchema = z.object({
  code: z.string().trim().min(1).max(256),
  severity: z.enum(["error", "warning"]),
  message: z.string().trim().min(1).max(2000),
}).strict();

const ExecutionReadinessCapabilitySummarySchema = z.object({
  backendFamily: IdentifierSchema,
  supportsProgressPolling: z.boolean(),
  supportsProgressStreaming: z.boolean(),
  supportsCancellation: z.boolean(),
  supportsOutputDiscovery: z.boolean(),
  supportedOperationKinds: z.array(IdentifierSchema).max(256),
  supportedTranslationContractVersions: z.array(IdentifierSchema).max(256),
}).strict();

const ExecutionReadinessNodeAvailabilitySummarySchema = z.object({
  state: z.enum([
    ExecutionReadinessNodeAvailabilityStates.available,
    ExecutionReadinessNodeAvailabilityStates.constrained,
    ExecutionReadinessNodeAvailabilityStates.unavailable,
    ExecutionReadinessNodeAvailabilityStates.unknown,
  ]),
  checkedAt: TimestampSchema,
  candidateNodeCount: z.number().int().min(0),
  eligibleNodeCount: z.number().int().min(0),
  unavailableNodeCount: z.number().int().min(0),
  incompatibleNodeCount: z.number().int().min(0),
  selectedNodeId: IdentifierSchema.optional(),
  topBlockingReasonCodes: z.array(z.string().trim().min(1).max(256)).max(64),
  topTransientAvailabilityReasonCodes: z.array(z.string().trim().min(1).max(256)).max(64),
  reasonCode: z.string().trim().min(1).max(256).optional(),
}).strict();

const RuntimeAvailabilityBlockingReasonSchema = z.object({
  code: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(2000),
  retryable: z.boolean(),
  retryAfterMs: z.number().int().min(0).optional(),
  observedAt: TimestampSchema.optional(),
}).strict();

const RuntimeAvailabilityFailureDetailSchema = z.object({
  code: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(2000),
  failedAt: TimestampSchema,
  retryable: z.boolean(),
  retryAfterMs: z.number().int().min(0).optional(),
}).strict();

const RuntimeAvailabilityResponseSchema = z.object({
  contractVersion: z.literal(RuntimeAvailabilityResponseContractVersions.v1),
  state: z.enum([
    RuntimeAvailabilityStates.unavailable,
    RuntimeAvailabilityStates.warming,
    RuntimeAvailabilityStates.ready,
    RuntimeAvailabilityStates.failed,
  ]),
  checkedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  retryable: z.boolean(),
  blockingReasons: z.array(RuntimeAvailabilityBlockingReasonSchema).max(64),
  warmupStartedAt: TimestampSchema.optional(),
  readyAt: TimestampSchema.optional(),
  failure: RuntimeAvailabilityFailureDetailSchema.optional(),
  diagnostics: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const ExecutionReadinessReadResponseSchema = z.object({
  backendFamily: IdentifierSchema,
  checkedAt: TimestampSchema,
  readiness: z.enum([
    ExecutionReadinessStates.ready,
    ExecutionReadinessStates.degraded,
    ExecutionReadinessStates.unavailable,
  ]),
  readyForExecution: z.boolean(),
  runtimeLifecycle: RuntimeAvailabilityResponseSchema.optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  capabilities: ExecutionReadinessCapabilitySummarySchema,
  nodeAvailability: ExecutionReadinessNodeAvailabilitySummarySchema,
  issues: z.array(ExecutionReadinessIssueSchema).max(128),
  diagnostics: z.record(z.string(), z.unknown()).optional(),
}).strict();

const RunQueueSchedulingAdminSummarySchema = z.object({
  asOf: TimestampSchema,
  totalRuns: z.number().int().min(0),
  deferredRuns: z.number().int().min(0),
  requiresAdministrativeAttentionRuns: z.number().int().min(0),
  reasonCodes: z.array(z.object({
    code: z.string().trim().min(1).max(128),
    count: z.number().int().min(1),
  }).strict()).max(128),
  decisionReasonCodes: z.array(z.object({
    code: z.string().trim().min(1).max(128),
    count: z.number().int().min(1),
  }).strict()).max(128),
  exclusionReasonCodes: z.array(z.object({
    code: z.string().trim().min(1).max(128),
    count: z.number().int().min(1),
  }).strict()).max(128),
}).strict();

export const RunQueueStatusReadResponseSchema = z.object({
  items: z.array(RunQueueStatusItemSchema),
  totalCount: z.number().int().min(0),
  asOf: TimestampSchema,
  schedulingAdminSummary: RunQueueSchedulingAdminSummarySchema.optional(),
}).strict();

export const SchedulingAdminListStaleReservationsRequestSchema = z.object({
  workspaceId: IdentifierSchema,
  queueId: IdentifierSchema.optional(),
  asOf: TimestampSchema.optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

const SchedulingAdminStaleReservationSchema = z.object({
  runId: IdentifierSchema,
  queueId: IdentifierSchema,
  workspaceId: IdentifierSchema.optional(),
  claimToken: IdentifierSchema,
  claimedBy: IdentifierSchema,
  claimedAt: TimestampSchema,
  claimExpiresAt: TimestampSchema,
  staleSeconds: z.number().int().min(0),
}).strict();

export const SchedulingAdminListStaleReservationsResponseSchema = z.object({
  asOf: TimestampSchema,
  totalCount: z.number().int().min(0),
  items: z.array(SchedulingAdminStaleReservationSchema),
}).strict();

export const SchedulingAdminReleaseStaleReservationRequestSchema = z.object({
  runId: IdentifierSchema,
  claimToken: IdentifierSchema,
  releasedAt: TimestampSchema.optional(),
  reason: OptionalReasonSchema,
}).strict();

export const SchedulingAdminReleaseStaleReservationResponseSchema = z.object({
  runId: IdentifierSchema,
  queueId: IdentifierSchema,
  releasedAt: TimestampSchema,
  staleSeconds: z.number().int().min(0),
  reservationOwner: IdentifierSchema,
  mutation: MutationResultSchema,
}).strict();

export const SchedulingAdminReevaluateDeferredRunsRequestSchema = z.object({
  queueId: IdentifierSchema.optional(),
  runIds: z.array(IdentifierSchema).max(200).optional(),
  requestedAt: TimestampSchema.optional(),
  reason: OptionalReasonSchema,
  limit: z.number().int().min(1).max(200).optional(),
}).strict();

export const SchedulingAdminReevaluateDeferredRunsResponseSchema = z.object({
  requestedAt: TimestampSchema,
  reEvaluatedCount: z.number().int().min(0),
  runIds: z.array(IdentifierSchema),
  mutation: MutationResultSchema,
}).strict();

export const RunCancellationRequestSchema = z.object({
  runId: IdentifierSchema,
  reason: OptionalReasonSchema,
  requestedByActorId: IdentifierSchema.optional(),
  requestedAt: TimestampSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
}).strict();

export const RunRetryRequestSchema = z.object({
  runId: IdentifierSchema,
  reason: OptionalReasonSchema,
  requestedByActorId: IdentifierSchema.optional(),
  requestedAt: TimestampSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
}).strict();

export const RunLifecycleUpdateRequestSchema = z.object({
  runId: IdentifierSchema,
  toState: RunLifecycleStateSchema.optional(),
  occurredAt: TimestampSchema.optional(),
  reason: OptionalReasonSchema,
  actorId: IdentifierSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
  senderNodeId: IdentifierSchema.optional(),
  senderBackendKind: IdentifierSchema.optional(),
  senderBackendRunId: IdentifierSchema.optional(),
  heartbeatAt: TimestampSchema.optional(),
  progress: z.object({
    updatedAt: TimestampSchema,
    percent: z.number().min(0).max(100).optional(),
    stage: z.string().trim().min(1).max(256).optional(),
    message: z.string().trim().min(1).max(1024).optional(),
  }).strict().optional(),
  result: z.object({
    summary: z.string().trim().min(1).max(2000).optional(),
    externalResultId: IdentifierSchema.optional(),
    outputs: z.array(RunResultOutputReferenceSchema).max(512).optional(),
    metrics: z.record(z.string(), z.unknown()).optional(),
    resultAvailabilityState: z.enum([
      RunResultAvailabilityStates.pendingResult,
      RunResultAvailabilityStates.partiallyCollected,
      RunResultAvailabilityStates.available,
      RunResultAvailabilityStates.previewPending,
      RunResultAvailabilityStates.failedCollection,
    ]).optional(),
    outputAvailabilityHint: z.enum([
      RunResultOutputAvailabilityHints.none,
      RunResultOutputAvailabilityHints.partial,
      RunResultOutputAvailabilityHints.available,
      RunResultOutputAvailabilityHints.degraded,
    ]).optional(),
    terminalQualityHint: z.enum([
      RunResultTerminalQualityHints.standard,
      RunResultTerminalQualityHints.partial,
      RunResultTerminalQualityHints.degraded,
    ]).optional(),
  }).strict().optional(),
  internalDiagnostics: z.record(z.string(), z.unknown()).optional(),
  queue: RunQueueStatusSnapshotSchema.optional(),
  assignment: RunAssignmentSchema.optional(),
  execution: RunExecutionSchema.optional(),
  cancellation: RunCancellationSchema.optional(),
  retry: z.object({
    attempt: z.number().int().min(1).optional(),
    maxAttempts: z.number().int().min(1).optional(),
    previousRunId: IdentifierSchema.optional(),
    retryReason: OptionalReasonSchema,
    queuedAt: TimestampSchema.optional(),
  }).strict().optional(),
}).strict();

const RunMutationActionSchema = z.enum([
  RunMutationActions.cancel,
  RunMutationActions.retry,
  RunMutationActions.schedulingAdmin,
  RunMutationActions.lifecycleUpdate,
]);

export const RunMutationResponseSchema = z.object({
  action: RunMutationActionSchema,
  run: RunDetailSchema,
  mutation: MutationResultSchema,
}).strict();

const RunLifecycleEventKindSchema = z.enum([
  RunLifecycleEventKinds.runSubmitted,
  RunLifecycleEventKinds.runStateChanged,
  RunLifecycleEventKinds.runCancelled,
  RunLifecycleEventKinds.runRetryQueued,
]);

export const RunLifecycleEventEnvelopeSchema = z.object({
  eventId: IdentifierSchema,
  eventKind: RunLifecycleEventKindSchema,
  occurredAt: TimestampSchema,
  run: RunStatusEnvelopeSchema,
}).strict();

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(".[", "[");
}

function parseRunOrchestrationSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new RunOrchestrationTransportSchemaValidationError(
      schemaName,
      parsed.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

export type RunSubmissionRequestPayload = z.infer<typeof CanonicalRunSubmissionRequestSchema>;
export type RunDetailPayload = z.infer<typeof RunDetailSchema>;
export type RunListReadRequestPayload = z.infer<typeof RunListReadRequestSchema>;
export type RunSubmissionAcceptedResponsePayload = z.infer<typeof RunSubmissionAcceptedResponseSchema>;
export type RunListReadResponsePayload = z.infer<typeof RunListReadResponseSchema>;
export type RunStatusEnvelopePayload = z.infer<typeof RunStatusEnvelopeSchema>;
export type RunQueueStatusReadRequestPayload = z.infer<typeof RunQueueStatusReadRequestSchema>;
export type RunQueueStatusReadResponsePayload = z.infer<typeof RunQueueStatusReadResponseSchema>;
export type ExecutionReadinessReadRequestPayload = z.infer<typeof ExecutionReadinessReadRequestSchema>;
export type ExecutionReadinessReadResponsePayload = z.infer<typeof ExecutionReadinessReadResponseSchema>;
export type SchedulingAdminListStaleReservationsRequestPayload =
  z.infer<typeof SchedulingAdminListStaleReservationsRequestSchema>;
export type SchedulingAdminListStaleReservationsResponsePayload =
  z.infer<typeof SchedulingAdminListStaleReservationsResponseSchema>;
export type SchedulingAdminReleaseStaleReservationRequestPayload =
  z.infer<typeof SchedulingAdminReleaseStaleReservationRequestSchema>;
export type SchedulingAdminReleaseStaleReservationResponsePayload =
  z.infer<typeof SchedulingAdminReleaseStaleReservationResponseSchema>;
export type SchedulingAdminReevaluateDeferredRunsRequestPayload =
  z.infer<typeof SchedulingAdminReevaluateDeferredRunsRequestSchema>;
export type SchedulingAdminReevaluateDeferredRunsResponsePayload =
  z.infer<typeof SchedulingAdminReevaluateDeferredRunsResponseSchema>;
export type RunCancellationRequestPayload = z.infer<typeof RunCancellationRequestSchema>;
export type RunRetryRequestPayload = z.infer<typeof RunRetryRequestSchema>;
export type RunLifecycleUpdateRequestPayload = z.infer<typeof RunLifecycleUpdateRequestSchema>;
export type RunMutationResponsePayload = z.infer<typeof RunMutationResponseSchema>;
export type RunLifecycleEventEnvelopePayload = z.infer<typeof RunLifecycleEventEnvelopeSchema>;

export function parseRunSubmissionRequest(payload: unknown): RunSubmissionRequestPayload {
  const parsed = parseRunOrchestrationSchema("RunSubmissionRequest", RunSubmissionRequestSchema, payload);
  if ("runtimeTarget" in parsed) {
    return parsed;
  }

  return Object.freeze({
    workflowId: parsed.systemId,
    source: resolveRunSubmissionSource(undefined),
    idempotencyKey: parsed.idempotencyKey,
    runtimeTarget: Object.freeze({
      systemId: parsed.systemId,
      versionId: parsed.versionId,
      executionId: parsed.executionId,
      tenantId: parsed.tenantId,
      async: parsed.async,
    }),
  });
}

export function parseRunDetail(payload: unknown): RunDetailPayload {
  return parseRunOrchestrationSchema("RunDetail", RunDetailSchema, payload);
}

export function parseRunListReadRequest(payload: unknown): RunListReadRequestPayload {
  return parseRunOrchestrationSchema("RunListReadRequest", RunListReadRequestSchema, payload);
}

export function parseRunSubmissionAcceptedResponse(payload: unknown): RunSubmissionAcceptedResponsePayload {
  return parseRunOrchestrationSchema("RunSubmissionAcceptedResponse", RunSubmissionAcceptedResponseSchema, payload);
}

export function parseRunListReadResponse(payload: unknown): RunListReadResponsePayload {
  return parseRunOrchestrationSchema("RunListReadResponse", RunListReadResponseSchema, payload);
}

export function parseRunStatusEnvelope(payload: unknown): RunStatusEnvelopePayload {
  return parseRunOrchestrationSchema("RunStatusEnvelope", RunStatusEnvelopeSchema, payload);
}

export function parseRunQueueStatusReadRequest(payload: unknown): RunQueueStatusReadRequestPayload {
  return parseRunOrchestrationSchema("RunQueueStatusReadRequest", RunQueueStatusReadRequestSchema, payload);
}

export function parseRunQueueStatusReadResponse(payload: unknown): RunQueueStatusReadResponsePayload {
  return parseRunOrchestrationSchema("RunQueueStatusReadResponse", RunQueueStatusReadResponseSchema, payload);
}

export function parseExecutionReadinessReadRequest(payload: unknown): ExecutionReadinessReadRequestPayload {
  return parseRunOrchestrationSchema("ExecutionReadinessReadRequest", ExecutionReadinessReadRequestSchema, payload);
}

export function parseExecutionReadinessReadResponse(payload: unknown): ExecutionReadinessReadResponsePayload {
  return parseRunOrchestrationSchema("ExecutionReadinessReadResponse", ExecutionReadinessReadResponseSchema, payload);
}

export function parseSchedulingAdminListStaleReservationsRequest(
  payload: unknown,
): SchedulingAdminListStaleReservationsRequestPayload {
  return parseRunOrchestrationSchema(
    "SchedulingAdminListStaleReservationsRequest",
    SchedulingAdminListStaleReservationsRequestSchema,
    payload,
  );
}

export function parseSchedulingAdminListStaleReservationsResponse(
  payload: unknown,
): SchedulingAdminListStaleReservationsResponsePayload {
  return parseRunOrchestrationSchema(
    "SchedulingAdminListStaleReservationsResponse",
    SchedulingAdminListStaleReservationsResponseSchema,
    payload,
  );
}

export function parseSchedulingAdminReleaseStaleReservationRequest(
  payload: unknown,
): SchedulingAdminReleaseStaleReservationRequestPayload {
  return parseRunOrchestrationSchema(
    "SchedulingAdminReleaseStaleReservationRequest",
    SchedulingAdminReleaseStaleReservationRequestSchema,
    payload,
  );
}

export function parseSchedulingAdminReleaseStaleReservationResponse(
  payload: unknown,
): SchedulingAdminReleaseStaleReservationResponsePayload {
  return parseRunOrchestrationSchema(
    "SchedulingAdminReleaseStaleReservationResponse",
    SchedulingAdminReleaseStaleReservationResponseSchema,
    payload,
  );
}

export function parseSchedulingAdminReevaluateDeferredRunsRequest(
  payload: unknown,
): SchedulingAdminReevaluateDeferredRunsRequestPayload {
  return parseRunOrchestrationSchema(
    "SchedulingAdminReevaluateDeferredRunsRequest",
    SchedulingAdminReevaluateDeferredRunsRequestSchema,
    payload,
  );
}

export function parseSchedulingAdminReevaluateDeferredRunsResponse(
  payload: unknown,
): SchedulingAdminReevaluateDeferredRunsResponsePayload {
  return parseRunOrchestrationSchema(
    "SchedulingAdminReevaluateDeferredRunsResponse",
    SchedulingAdminReevaluateDeferredRunsResponseSchema,
    payload,
  );
}

export function parseRunCancellationRequest(payload: unknown): RunCancellationRequestPayload {
  return parseRunOrchestrationSchema("RunCancellationRequest", RunCancellationRequestSchema, payload);
}

export function parseRunRetryRequest(payload: unknown): RunRetryRequestPayload {
  return parseRunOrchestrationSchema("RunRetryRequest", RunRetryRequestSchema, payload);
}

export function parseRunLifecycleUpdateRequest(payload: unknown): RunLifecycleUpdateRequestPayload {
  return parseRunOrchestrationSchema("RunLifecycleUpdateRequest", RunLifecycleUpdateRequestSchema, payload);
}

export function parseRunMutationResponse(payload: unknown): RunMutationResponsePayload {
  return parseRunOrchestrationSchema("RunMutationResponse", RunMutationResponseSchema, payload);
}

export function parseRunLifecycleEventEnvelope(payload: unknown): RunLifecycleEventEnvelopePayload {
  return parseRunOrchestrationSchema("RunLifecycleEventEnvelope", RunLifecycleEventEnvelopeSchema, payload);
}

export function toLegacyRuntimeStartRunRequest(payload: RunSubmissionRequest): {
  readonly systemId: string;
  readonly versionId: string;
  readonly executionId?: string;
  readonly tenantId?: string;
  readonly idempotencyKey?: string;
  readonly async?: boolean;
} {
  return Object.freeze({
    systemId: payload.runtimeTarget.systemId,
    versionId: payload.runtimeTarget.versionId,
    executionId: payload.runtimeTarget.executionId,
    tenantId: payload.runtimeTarget.tenantId,
    idempotencyKey: payload.idempotencyKey,
    async: payload.runtimeTarget.async,
  });
}
