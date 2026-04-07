import { z } from "zod";
import { RuntimeQueueItemStatuses } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";

export interface SystemRuntimeTransportSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class SystemRuntimeTransportSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<SystemRuntimeTransportSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<SystemRuntimeTransportSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "SystemRuntimeTransportSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });
const QueueItemStatusSchema = z.enum([
  RuntimeQueueItemStatuses.queued,
  RuntimeQueueItemStatuses.running,
  RuntimeQueueItemStatuses.completed,
  RuntimeQueueItemStatuses.failed,
  RuntimeQueueItemStatuses.cancelled,
]);

export const RuntimeStartRunRequestSchema = z.object({
  systemId: IdentifierSchema,
  versionId: IdentifierSchema,
  executionId: IdentifierSchema.optional(),
  async: z.boolean().optional(),
  tenantId: IdentifierSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
}).strict();

const RuntimeExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

const RuntimeMutationResultSchema = z.object({
  changed: z.boolean(),
  mutationId: IdentifierSchema.optional(),
  occurredAt: TimestampSchema.optional(),
}).strict();

export const RuntimeCancelRunRequestSchema = z.object({
  executionId: IdentifierSchema,
  reason: z.string().trim().min(1).max(512).optional(),
  cancelledAt: TimestampSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
}).strict();

export const RuntimeQueueListRequestSchema = z.object({
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema.optional(),
  tenantId: IdentifierSchema.optional(),
  statuses: z.array(QueueItemStatusSchema).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

export const RuntimeQueueListResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    items: z.array(z.object({
      queueItemId: IdentifierSchema,
      executionId: IdentifierSchema,
      systemId: IdentifierSchema,
      status: QueueItemStatusSchema,
      enqueuedAt: TimestampSchema,
      startedAt: TimestampSchema.optional(),
      completedAt: TimestampSchema.optional(),
      priority: z.number().int().optional(),
    }).strict()),
    totalCount: z.number().int().min(0),
  }).strict().optional(),
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
  }).strict().optional(),
}).strict();

export const RuntimeCancelRunResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    executionId: IdentifierSchema,
    status: RuntimeExecutionStatusSchema,
    mutation: RuntimeMutationResultSchema,
  }).strict().optional(),
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
  }).strict().optional(),
}).strict();

export const RuntimeDequeueRequestSchema = z.object({
  queueItemId: IdentifierSchema,
  reason: z.string().trim().min(1).max(512).optional(),
  dequeuedAt: TimestampSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
}).strict();

export const RuntimeDequeueResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    queueItemId: IdentifierSchema,
    executionId: IdentifierSchema,
    status: QueueItemStatusSchema,
    mutation: RuntimeMutationResultSchema,
  }).strict().optional(),
  error: z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
  }).strict().optional(),
}).strict();

export type RuntimeStartRunRequestPayload = z.infer<typeof RuntimeStartRunRequestSchema>;
export type RuntimeCancelRunRequestPayload = z.infer<typeof RuntimeCancelRunRequestSchema>;
export type RuntimeQueueListRequestPayload = z.infer<typeof RuntimeQueueListRequestSchema>;
export type RuntimeQueueListResponsePayload = z.infer<typeof RuntimeQueueListResponseSchema>;
export type RuntimeCancelRunResponsePayload = z.infer<typeof RuntimeCancelRunResponseSchema>;
export type RuntimeDequeueRequestPayload = z.infer<typeof RuntimeDequeueRequestSchema>;
export type RuntimeDequeueResponsePayload = z.infer<typeof RuntimeDequeueResponseSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(".[", "[");
}

function parseRuntimeSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new SystemRuntimeTransportSchemaValidationError(
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

export function parseRuntimeStartRunRequest(payload: unknown): RuntimeStartRunRequestPayload {
  return parseRuntimeSchema("RuntimeStartRunRequest", RuntimeStartRunRequestSchema, payload);
}

export function parseRuntimeCancelRunRequest(payload: unknown): RuntimeCancelRunRequestPayload {
  return parseRuntimeSchema("RuntimeCancelRunRequest", RuntimeCancelRunRequestSchema, payload);
}

export function parseRuntimeQueueListRequest(payload: unknown): RuntimeQueueListRequestPayload {
  return parseRuntimeSchema("RuntimeQueueListRequest", RuntimeQueueListRequestSchema, payload);
}

export function parseRuntimeQueueListResponse(payload: unknown): RuntimeQueueListResponsePayload {
  return parseRuntimeSchema("RuntimeQueueListResponse", RuntimeQueueListResponseSchema, payload);
}

export function parseRuntimeCancelRunResponse(payload: unknown): RuntimeCancelRunResponsePayload {
  return parseRuntimeSchema("RuntimeCancelRunResponse", RuntimeCancelRunResponseSchema, payload);
}

export function parseRuntimeDequeueRequest(payload: unknown): RuntimeDequeueRequestPayload {
  return parseRuntimeSchema("RuntimeDequeueRequest", RuntimeDequeueRequestSchema, payload);
}

export function parseRuntimeDequeueResponse(payload: unknown): RuntimeDequeueResponsePayload {
  return parseRuntimeSchema("RuntimeDequeueResponse", RuntimeDequeueResponseSchema, payload);
}
