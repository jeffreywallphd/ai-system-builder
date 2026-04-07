import { z } from "zod";
import {
  RuntimeRealtimeAdminChangeKinds,
  RuntimeRealtimeAuditGovernanceEventKinds,
  RuntimeRealtimeConnectivityStates,
  RuntimeRealtimeEventCategories,
  RuntimeRealtimeEventEnvelopeVersion,
  RuntimeRealtimeOrchestrationEventKinds,
  RuntimeRealtimeSubscriptionModes,
  RuntimeRealtimeTopics,
  RuntimeRealtimeWebSocketActions,
  RuntimeRealtimeWebSocketMessageTypes,
  type RuntimeRealtimeEventEnvelope,
  type RuntimeRealtimeSubscriptionRequest,
  type RuntimeRealtimeWebSocketErrorMessage,
  type RuntimeRealtimeWebSocketEventMessage,
  type RuntimeRealtimeWebSocketSubscribeMessage,
  type RuntimeRealtimeWebSocketSubscriptionAckMessage,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";

export interface RuntimeRealtimeSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class RuntimeRealtimeSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<RuntimeRealtimeSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<RuntimeRealtimeSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "RuntimeRealtimeSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });
const TopicSchema = z.enum([
  RuntimeRealtimeTopics.runStatus,
  RuntimeRealtimeTopics.queue,
  RuntimeRealtimeTopics.connectivity,
  RuntimeRealtimeTopics.admin,
  RuntimeRealtimeTopics.auditGovernance,
]);
const CategorySchema = z.enum([
  RuntimeRealtimeEventCategories.runStatus,
  RuntimeRealtimeEventCategories.queueMovement,
  RuntimeRealtimeEventCategories.connectivityState,
  RuntimeRealtimeEventCategories.adminChange,
  RuntimeRealtimeEventCategories.auditGovernance,
]);
const OrchestrationEventKindSchema = z.enum([
  RuntimeRealtimeOrchestrationEventKinds.submissionAccepted,
  RuntimeRealtimeOrchestrationEventKinds.queueEnqueued,
  RuntimeRealtimeOrchestrationEventKinds.queueUpdated,
  RuntimeRealtimeOrchestrationEventKinds.assignmentUpdated,
  RuntimeRealtimeOrchestrationEventKinds.schedulingPriorityPlacementSelected,
  RuntimeRealtimeOrchestrationEventKinds.schedulingDeferredNoPlacement,
  RuntimeRealtimeOrchestrationEventKinds.schedulingReservationConflict,
  RuntimeRealtimeOrchestrationEventKinds.schedulingAssignmentMaterializationConflict,
  RuntimeRealtimeOrchestrationEventKinds.schedulingAssignmentMaterialized,
  RuntimeRealtimeOrchestrationEventKinds.schedulingRequeued,
  RuntimeRealtimeOrchestrationEventKinds.progressUpdated,
  RuntimeRealtimeOrchestrationEventKinds.cancellationRequested,
  RuntimeRealtimeOrchestrationEventKinds.retryQueued,
  RuntimeRealtimeOrchestrationEventKinds.completed,
  RuntimeRealtimeOrchestrationEventKinds.failed,
  RuntimeRealtimeOrchestrationEventKinds.cancelled,
  RuntimeRealtimeOrchestrationEventKinds.stateChanged,
]);

const RunStatusPayloadSchema = z.object({
  executionId: IdentifierSchema,
  status: z.string().trim().min(1).max(128),
  runId: IdentifierSchema.optional(),
  workflowId: IdentifierSchema.optional(),
  queueId: IdentifierSchema.optional(),
  lifecycleState: z.string().trim().min(1).max(128).optional(),
  eventKind: OrchestrationEventKindSchema.optional(),
  sessionId: IdentifierSchema.optional(),
  rootAssetId: IdentifierSchema.optional(),
  rootVersionId: IdentifierSchema.optional(),
  progress: z.object({
    completedNodeCount: z.number().int().min(0),
    failedNodeCount: z.number().int().min(0),
    runningNodeCount: z.number().int().min(0),
    totalNodeCount: z.number().int().min(0),
  }).strict().optional(),
  changedAt: TimestampSchema,
}).strict();

const QueueMovementPayloadSchema = z.object({
  queueItemId: IdentifierSchema,
  executionId: IdentifierSchema,
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  runId: IdentifierSchema.optional(),
  workflowId: IdentifierSchema.optional(),
  queueId: IdentifierSchema.optional(),
  lifecycleState: z.string().trim().min(1).max(128).optional(),
  eventKind: OrchestrationEventKindSchema.optional(),
  position: z.number().int().min(0).optional(),
  sessionId: IdentifierSchema.optional(),
  changedAt: TimestampSchema,
}).strict();

const ConnectivityPayloadSchema = z.object({
  state: z.enum([
    RuntimeRealtimeConnectivityStates.connected,
    RuntimeRealtimeConnectivityStates.reconnecting,
    RuntimeRealtimeConnectivityStates.degraded,
    RuntimeRealtimeConnectivityStates.disconnected,
  ]),
  reason: z.string().trim().min(1).max(512).optional(),
  observedAt: TimestampSchema,
  reconnectHint: z.object({
    retryAfterMs: z.number().int().min(0).optional(),
    sessionEpoch: IdentifierSchema.optional(),
  }).strict().optional(),
}).strict();

const AdminChangePayloadSchema = z.object({
  changeKind: z.enum([
    RuntimeRealtimeAdminChangeKinds.runtimePolicyUpdated,
    RuntimeRealtimeAdminChangeKinds.queuePolicyUpdated,
    RuntimeRealtimeAdminChangeKinds.workerCapacityUpdated,
    RuntimeRealtimeAdminChangeKinds.maintenanceModeChanged,
  ]),
  summary: z.string().trim().min(1).max(512),
  changedAt: TimestampSchema,
  changedByActorId: IdentifierSchema.optional(),
  metadata: z.record(z.string().trim().min(1), z.string().trim().min(1)).optional(),
}).strict();

const AuditGovernancePayloadSchema = z.object({
  eventId: IdentifierSchema,
  eventType: z.string().trim().min(1).max(128),
  auditCategory: z.string().trim().min(1).max(64),
  eventKind: z.enum([
    RuntimeRealtimeAuditGovernanceEventKinds.securitySensitiveActionRecorded,
    RuntimeRealtimeAuditGovernanceEventKinds.administrativeActionRecorded,
    RuntimeRealtimeAuditGovernanceEventKinds.sharingActionRecorded,
    RuntimeRealtimeAuditGovernanceEventKinds.policyActionRecorded,
    RuntimeRealtimeAuditGovernanceEventKinds.orchestrationActionRecorded,
    RuntimeRealtimeAuditGovernanceEventKinds.protectedDataActionRecorded,
  ]),
  action: z.string().trim().min(1).max(256),
  outcome: z.string().trim().min(1).max(64),
  occurredAt: TimestampSchema,
  recordedAt: TimestampSchema,
  actorId: IdentifierSchema,
  actorKind: z.string().trim().min(1).max(64),
  workspaceId: IdentifierSchema.optional(),
  resourceType: z.string().trim().min(1).max(128).optional(),
  resourceId: IdentifierSchema.optional(),
  correlationId: IdentifierSchema.optional(),
  requestId: IdentifierSchema.optional(),
  details: z.record(z.string().trim().min(1), z.unknown()).optional(),
  hasProtectedData: z.boolean(),
  redactionReasons: z.array(z.string().trim().min(1).max(128)).max(16),
}).strict();

const EventPayloadSchema = z.union([
  RunStatusPayloadSchema,
  QueueMovementPayloadSchema,
  ConnectivityPayloadSchema,
  AdminChangePayloadSchema,
  AuditGovernancePayloadSchema,
]);

export const RuntimeRealtimeEventEnvelopeSchema = z.object({
  eventId: IdentifierSchema,
  schemaVersion: z.literal(RuntimeRealtimeEventEnvelopeVersion),
  emittedAt: TimestampSchema,
  sequence: z.number().int().min(1),
  cursor: z.string().trim().regex(/^runtime-realtime:\d+$/),
  category: CategorySchema,
  topic: TopicSchema,
  workspaceScope: z.object({
    workspaceId: IdentifierSchema.optional(),
  }).strict(),
  actorScope: z.object({
    actorUserIdentityId: IdentifierSchema.optional(),
    sessionId: IdentifierSchema.optional(),
  }).strict(),
  runScope: z.object({
    executionId: IdentifierSchema.optional(),
  }).strict(),
  payload: EventPayloadSchema,
}).strict();

export const RuntimeRealtimeSubscriptionRequestSchema = z.object({
  actor: z.object({
    actorUserIdentityId: IdentifierSchema,
    accessChannel: z.enum(["desktop", "thin-client"]),
    sessionId: IdentifierSchema.optional(),
    workspaceId: IdentifierSchema.optional(),
  }).strict(),
  topics: z.array(z.object({
    topic: TopicSchema,
    workspaceId: IdentifierSchema.optional(),
    executionId: IdentifierSchema.optional(),
  }).strict()).min(1),
  mode: z.enum([
    RuntimeRealtimeSubscriptionModes.liveOnly,
    RuntimeRealtimeSubscriptionModes.resumeFromCursor,
  ]).optional(),
  reconnect: z.object({
    afterCursor: z.string().trim().regex(/^runtime-realtime:\d+$/).optional(),
  }).strict().optional(),
}).strict();

const RuntimeRealtimeWebSocketSubscribeRequestSchema = z.object({
  topics: z.array(z.object({
    topic: TopicSchema,
    workspaceId: IdentifierSchema.optional(),
    executionId: IdentifierSchema.optional(),
  }).strict()).min(1),
  mode: z.enum([
    RuntimeRealtimeSubscriptionModes.liveOnly,
    RuntimeRealtimeSubscriptionModes.resumeFromCursor,
  ]).optional(),
  reconnect: z.object({
    afterCursor: z.string().trim().regex(/^runtime-realtime:\d+$/).optional(),
  }).strict().optional(),
}).strict();

export const RuntimeRealtimeWebSocketSubscribeMessageSchema = z.object({
  action: z.literal(RuntimeRealtimeWebSocketActions.subscribe),
  request: RuntimeRealtimeWebSocketSubscribeRequestSchema,
}).strict();

export const RuntimeRealtimeWebSocketSubscriptionAckMessageSchema = z.object({
  type: z.literal(RuntimeRealtimeWebSocketMessageTypes.subscriptionAck),
  subscriptionId: IdentifierSchema,
  acceptedAt: TimestampSchema,
  mode: z.enum([
    RuntimeRealtimeSubscriptionModes.liveOnly,
    RuntimeRealtimeSubscriptionModes.resumeFromCursor,
  ]),
  topics: z.array(z.object({
    topic: TopicSchema,
    workspaceId: IdentifierSchema.optional(),
    executionId: IdentifierSchema.optional(),
  }).strict()).min(1),
  reconnect: z.object({
    afterCursor: z.string().trim().regex(/^runtime-realtime:\d+$/).optional(),
  }).strict().optional(),
}).strict();

export const RuntimeRealtimeWebSocketEventMessageSchema = z.object({
  type: z.literal(RuntimeRealtimeWebSocketMessageTypes.event),
  event: RuntimeRealtimeEventEnvelopeSchema,
}).strict();

export const RuntimeRealtimeWebSocketErrorMessageSchema = z.object({
  type: z.literal(RuntimeRealtimeWebSocketMessageTypes.error),
  error: z.object({
    code: z.enum(["invalid-request", "forbidden", "internal"]),
    message: z.string().trim().min(1).max(512),
    correlationId: z.string().trim().min(1).max(128).optional(),
  }).strict(),
}).strict();

export type RuntimeRealtimeEventEnvelopePayload = z.infer<typeof RuntimeRealtimeEventEnvelopeSchema>;
export type RuntimeRealtimeSubscriptionRequestPayload = z.infer<typeof RuntimeRealtimeSubscriptionRequestSchema>;
export type RuntimeRealtimeWebSocketSubscribeMessagePayload = z.infer<typeof RuntimeRealtimeWebSocketSubscribeMessageSchema>;
export type RuntimeRealtimeWebSocketSubscriptionAckMessagePayload = z.infer<typeof RuntimeRealtimeWebSocketSubscriptionAckMessageSchema>;
export type RuntimeRealtimeWebSocketEventMessagePayload = z.infer<typeof RuntimeRealtimeWebSocketEventMessageSchema>;
export type RuntimeRealtimeWebSocketErrorMessagePayload = z.infer<typeof RuntimeRealtimeWebSocketErrorMessageSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function parseRuntimeRealtimeSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new RuntimeRealtimeSchemaValidationError(
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

export function parseRuntimeRealtimeEventEnvelope(payload: unknown): RuntimeRealtimeEventEnvelope {
  return parseRuntimeRealtimeSchema(
    "RuntimeRealtimeEventEnvelope",
    RuntimeRealtimeEventEnvelopeSchema,
    payload,
  );
}

export function parseRuntimeRealtimeSubscriptionRequest(payload: unknown): RuntimeRealtimeSubscriptionRequest {
  return parseRuntimeRealtimeSchema(
    "RuntimeRealtimeSubscriptionRequest",
    RuntimeRealtimeSubscriptionRequestSchema,
    payload,
  );
}

export function parseRuntimeRealtimeWebSocketSubscribeMessage(payload: unknown): RuntimeRealtimeWebSocketSubscribeMessage {
  return parseRuntimeRealtimeSchema(
    "RuntimeRealtimeWebSocketSubscribeMessage",
    RuntimeRealtimeWebSocketSubscribeMessageSchema,
    payload,
  );
}

export function parseRuntimeRealtimeWebSocketSubscriptionAckMessage(
  payload: unknown,
): RuntimeRealtimeWebSocketSubscriptionAckMessage {
  return parseRuntimeRealtimeSchema(
    "RuntimeRealtimeWebSocketSubscriptionAckMessage",
    RuntimeRealtimeWebSocketSubscriptionAckMessageSchema,
    payload,
  );
}

export function parseRuntimeRealtimeWebSocketEventMessage(payload: unknown): RuntimeRealtimeWebSocketEventMessage {
  return parseRuntimeRealtimeSchema(
    "RuntimeRealtimeWebSocketEventMessage",
    RuntimeRealtimeWebSocketEventMessageSchema,
    payload,
  );
}

export function parseRuntimeRealtimeWebSocketErrorMessage(payload: unknown): RuntimeRealtimeWebSocketErrorMessage {
  return parseRuntimeRealtimeSchema(
    "RuntimeRealtimeWebSocketErrorMessage",
    RuntimeRealtimeWebSocketErrorMessageSchema,
    payload,
  );
}
