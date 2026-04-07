import { z } from "zod";
import {
  RuntimeRealtimeAdminChangeKinds,
  RuntimeRealtimeConnectivityStates,
  RuntimeRealtimeEventCategories,
  RuntimeRealtimeEventEnvelopeVersion,
  RuntimeRealtimeSubscriptionModes,
  RuntimeRealtimeTopics,
  type RuntimeRealtimeEventEnvelope,
  type RuntimeRealtimeSubscriptionRequest,
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
]);
const CategorySchema = z.enum([
  RuntimeRealtimeEventCategories.runStatus,
  RuntimeRealtimeEventCategories.queueMovement,
  RuntimeRealtimeEventCategories.connectivityState,
  RuntimeRealtimeEventCategories.adminChange,
]);

const RunStatusPayloadSchema = z.object({
  executionId: IdentifierSchema,
  status: z.string().trim().min(1).max(128),
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

const EventPayloadSchema = z.union([
  RunStatusPayloadSchema,
  QueueMovementPayloadSchema,
  ConnectivityPayloadSchema,
  AdminChangePayloadSchema,
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

export type RuntimeRealtimeEventEnvelopePayload = z.infer<typeof RuntimeRealtimeEventEnvelopeSchema>;
export type RuntimeRealtimeSubscriptionRequestPayload = z.infer<typeof RuntimeRealtimeSubscriptionRequestSchema>;

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
