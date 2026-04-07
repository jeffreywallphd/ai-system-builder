import { z } from "zod";
import {
  RunLifecycleEventKinds,
  RunMutationActions,
  RunOrchestrationTransportContractVersions,
  resolveRunSubmissionSource,
  type RunSubmissionRequest,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
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
  retry: z.object({
    attempt: z.number().int().min(1),
    maxAttempts: z.number().int().min(1),
    queuedAt: TimestampSchema.optional(),
  }).strict(),
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
}).strict();

export const RunQueueStatusReadResponseSchema = z.object({
  items: z.array(RunQueueStatusItemSchema),
  totalCount: z.number().int().min(0),
  asOf: TimestampSchema,
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
  toState: RunLifecycleStateSchema,
  occurredAt: TimestampSchema.optional(),
  reason: OptionalReasonSchema,
  actorId: IdentifierSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
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
