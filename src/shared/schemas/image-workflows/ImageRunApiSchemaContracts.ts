import { z } from "zod";
import {
  buildImageRunEventCursor,
  ImageRunApiContractVersions,
  ImageRunEventCategories,
  ImageRunEventKinds,
  ImageRunFailureCategories,
  ImageRunFailureVisibilities,
  ImageRunReadinessStates,
  parseImageRunEventCursor,
  type CancelImageRunRequestDto,
  type CancelImageRunResponseDto,
  type GetImageRunExecutionReadinessRequestDto,
  type GetImageRunExecutionReadinessResponseDto,
  type GetImageRunRequestDto,
  type GetImageRunResponseDto,
  type GetImageRunStatusRequestDto,
  type GetImageRunStatusResponseDto,
  type ListImageRunEventsRequestDto,
  type ListImageRunEventsResponseDto,
  type ListImageRunsRequestDto,
  type ListImageRunsResponseDto,
  type SubmitImageRunResponseDto,
  type ImageRunSubmissionRequestDto,
} from "@shared/contracts/image-workflows/ImageRunApiContracts";
import {
  RunLifecycleStates,
  RunSubmissionSources,
} from "@domain/runs/RunDomain";
export interface ImageRunApiSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class ImageRunApiSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<ImageRunApiSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<ImageRunApiSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "ImageRunApiSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });
const OptionalTextSchema = z.string().trim().min(1).max(2000).optional();
const OptionalReasonSchema = z.string().trim().min(1).max(512).optional();
const TagSchema = z.string().trim().min(1).max(64);

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

const RunSubmissionSourceSchema = z.enum([
  RunSubmissionSources.uiManual,
  RunSubmissionSources.uiRerun,
  RunSubmissionSources.api,
  RunSubmissionSources.scheduleTrigger,
  RunSubmissionSources.eventTrigger,
  RunSubmissionSources.internalOrchestrator,
]);

const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(500),
  offset: z.number().int().min(0),
  returned: z.number().int().min(0),
  hasMore: z.boolean(),
}).strict();

function isFilesystemLikeLogicalReference(value: string): boolean {
  return /^[a-zA-Z]:\\/.test(value) || value.startsWith("/") || value.includes("\\");
}

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }
  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(".[", "[");
}

function parseSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ImageRunApiSchemaValidationError(
      schemaName,
      parsed.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        message: issue.message,
        code: issue.code,
      })),
    );
  }
  return parsed.data;
}

function assertNoForbiddenInternalKeys(value: unknown, context: z.RefinementCtx): void {
  const forbidden = new Set([
    "rawGraph",
    "graphJson",
    "comfyPromptGraph",
    "filesystemPath",
    "absolutePath",
    "localPath",
    "backendRequestPayload",
    "backendResponsePayload",
    "transportRequest",
    "transportResponse",
  ]);

  const visit = (node: unknown, path: ReadonlyArray<string | number>): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, [...path, index]));
      return;
    }
    for (const [key, entry] of Object.entries(node)) {
      if (forbidden.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, key],
          message: `Field '${key}' is not allowed in shared image run API contracts.`,
        });
      }
      visit(entry, [...path, key]);
    }
  };

  visit(value, []);
}

const ImageRunSubmissionInputAssetReferenceSchema = z.object({
  bindingId: IdentifierSchema,
  assetId: IdentifierSchema,
  assetVersionId: IdentifierSchema.optional(),
}).strict().superRefine((value, context) => {
  if (isFilesystemLikeLogicalReference(value.assetId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assetId"],
      message: "assetId must be a logical reference and cannot be a filesystem path.",
    });
  }
});

export const ImageRunSubmissionRequestDtoSchema: z.ZodType<ImageRunSubmissionRequestDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  actorUserIdentityId: IdentifierSchema,
  systemId: IdentifierSchema,
  operationKey: IdentifierSchema.optional(),
  source: RunSubmissionSourceSchema.optional(),
  idempotencyKey: IdentifierSchema.optional(),
  correlationId: IdentifierSchema.optional(),
  inputAssets: z.array(ImageRunSubmissionInputAssetReferenceSchema).max(200).optional(),
  parameterOverrides: z.record(z.string().trim().min(1), z.unknown()).optional(),
  tags: z.array(TagSchema).max(64).optional(),
}).strict().superRefine(assertNoForbiddenInternalKeys);

const ImageRunProgressSnapshotDtoSchema = z.object({
  state: RunLifecycleStateSchema,
  updatedAt: TimestampSchema,
  percent: z.number().min(0).max(100).optional(),
  stageCode: IdentifierSchema.optional(),
  stageLabel: z.string().trim().min(1).max(256).optional(),
  message: z.string().trim().min(1).max(1024).optional(),
  queuePosition: z.number().int().min(0).optional(),
  etaSeconds: z.number().int().min(0).optional(),
  completedUnitCount: z.number().int().min(0).optional(),
  totalUnitCount: z.number().int().min(0).optional(),
  partialOutputCount: z.number().int().min(0).optional(),
}).strict();

const ImageRunFailureSummaryDtoSchema = z.object({
  code: IdentifierSchema,
  category: z.enum([
    ImageRunFailureCategories.validation,
    ImageRunFailureCategories.translation,
    ImageRunFailureCategories.dependency,
    ImageRunFailureCategories.capacity,
    ImageRunFailureCategories.timeout,
    ImageRunFailureCategories.cancellation,
    ImageRunFailureCategories.execution,
    ImageRunFailureCategories.output,
    ImageRunFailureCategories.connectivity,
    ImageRunFailureCategories.internal,
    ImageRunFailureCategories.unknown,
  ]),
  summary: z.string().trim().min(1).max(1024),
  userMessage: z.string().trim().min(1).max(1024).optional(),
  retryable: z.boolean(),
  failedAt: TimestampSchema,
  stageCode: IdentifierSchema.optional(),
  partialProgressObserved: z.boolean(),
  partialOutputCount: z.number().int().min(0),
  visibility: z.enum([
    ImageRunFailureVisibilities.userSafe,
    ImageRunFailureVisibilities.admin,
  ]),
  diagnostics: z.object({
    detailKeys: z.array(IdentifierSchema).max(256),
  }).strict().optional(),
}).strict();

const ImageRunResultOutputReferenceDtoSchema = z.object({
  outputId: IdentifierSchema,
  assetId: IdentifierSchema.optional(),
  assetVersionId: IdentifierSchema.optional(),
  mediaType: z.string().trim().min(1).max(256).optional(),
  label: z.string().trim().min(1).max(256).optional(),
  metadata: z.record(z.string().trim().min(1), z.unknown()).optional(),
}).strict().superRefine((value, context) => {
  if (value.assetId && isFilesystemLikeLogicalReference(value.assetId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assetId"],
      message: "assetId must be a logical reference and cannot be a filesystem path.",
    });
  }
});

const ImageRunResultSummaryDtoSchema = z.object({
  completedAt: TimestampSchema,
  durationMs: z.number().int().min(0).optional(),
  outputCount: z.number().int().min(0),
  partialOutputCount: z.number().int().min(0).optional(),
  hadPartialOutputs: z.boolean(),
  outputs: z.array(ImageRunResultOutputReferenceDtoSchema).max(512),
  warningCount: z.number().int().min(0).optional(),
  summary: z.string().trim().min(1).max(2000).optional(),
}).strict();

const ImageRunExecutionReadinessIssueDtoSchema = z.object({
  code: IdentifierSchema,
  severity: z.enum(["error", "warning"]),
  message: z.string().trim().min(1).max(2000),
}).strict();

const ImageRunExecutionReadinessSummaryDtoSchema = z.object({
  backendFamily: IdentifierSchema,
  checkedAt: TimestampSchema,
  readiness: z.enum([
    ImageRunReadinessStates.ready,
    ImageRunReadinessStates.degraded,
    ImageRunReadinessStates.unavailable,
  ]),
  readyForExecution: z.boolean(),
  message: z.string().trim().min(1).max(2000).optional(),
  capabilities: z.object({
    backendFamily: IdentifierSchema,
    supportsProgressPolling: z.boolean(),
    supportsProgressStreaming: z.boolean(),
    supportsCancellation: z.boolean(),
    supportsOutputDiscovery: z.boolean(),
    supportedOperationKinds: z.array(IdentifierSchema).max(256),
    supportedTranslationContractVersions: z.array(IdentifierSchema).max(256),
  }).strict(),
  issues: z.array(ImageRunExecutionReadinessIssueDtoSchema).max(128),
}).strict();

const ImageRunSummaryDtoSchema = z.object({
  runId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema,
  workflowId: IdentifierSchema,
  state: RunLifecycleStateSchema,
  source: RunSubmissionSourceSchema,
  submittedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  progress: ImageRunProgressSnapshotDtoSchema.optional(),
  failure: ImageRunFailureSummaryDtoSchema.optional(),
  result: ImageRunResultSummaryDtoSchema.optional(),
}).strict();

const ImageRunDetailDtoSchema = ImageRunSummaryDtoSchema.extend({
  submittedByActorId: IdentifierSchema.optional(),
  correlationId: IdentifierSchema.optional(),
  cancellation: z.object({
    requestedAt: TimestampSchema,
    requestedByActorId: IdentifierSchema.optional(),
    reason: OptionalReasonSchema,
    acknowledgedAt: TimestampSchema.optional(),
  }).strict().optional(),
  readiness: ImageRunExecutionReadinessSummaryDtoSchema.optional(),
}).strict();

const MutationResultSchema = z.object({
  changed: z.boolean(),
  mutationId: IdentifierSchema.optional(),
  occurredAt: TimestampSchema.optional(),
}).strict();

export const SubmitImageRunResponseDtoSchema: z.ZodType<SubmitImageRunResponseDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  run: ImageRunDetailDtoSchema,
  mutation: MutationResultSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const GetImageRunRequestDtoSchema: z.ZodType<GetImageRunRequestDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  runId: IdentifierSchema,
}).strict();

export const GetImageRunResponseDtoSchema: z.ZodType<GetImageRunResponseDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  run: ImageRunDetailDtoSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const ListImageRunsRequestDtoSchema: z.ZodType<ListImageRunsRequestDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema.optional(),
  states: z.array(RunLifecycleStateSchema).max(16).optional(),
  sources: z.array(RunSubmissionSourceSchema).max(16).optional(),
  search: z.string().trim().min(1).max(256).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
  sortBy: z.enum(["submittedAt", "updatedAt", "state"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
}).strict();

export const ListImageRunsResponseDtoSchema: z.ZodType<ListImageRunsResponseDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  items: z.array(ImageRunSummaryDtoSchema),
  pagination: PaginationSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const GetImageRunStatusRequestDtoSchema: z.ZodType<GetImageRunStatusRequestDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  runId: IdentifierSchema,
}).strict();

export const GetImageRunStatusResponseDtoSchema: z.ZodType<GetImageRunStatusResponseDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  runId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema,
  workflowId: IdentifierSchema,
  state: RunLifecycleStateSchema,
  updatedAt: TimestampSchema,
  progress: ImageRunProgressSnapshotDtoSchema.optional(),
  failure: ImageRunFailureSummaryDtoSchema.optional(),
  result: ImageRunResultSummaryDtoSchema.optional(),
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const CancelImageRunRequestDtoSchema: z.ZodType<CancelImageRunRequestDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  runId: IdentifierSchema,
  requestedByActorId: IdentifierSchema.optional(),
  reason: OptionalReasonSchema,
  idempotencyKey: IdentifierSchema.optional(),
}).strict();

export const CancelImageRunResponseDtoSchema: z.ZodType<CancelImageRunResponseDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  run: ImageRunDetailDtoSchema,
  mutation: MutationResultSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const GetImageRunExecutionReadinessRequestDtoSchema: z.ZodType<GetImageRunExecutionReadinessRequestDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema.optional(),
  operationKind: IdentifierSchema.optional(),
  translationContractVersion: IdentifierSchema.optional(),
}).strict();

export const GetImageRunExecutionReadinessResponseDtoSchema: z.ZodType<GetImageRunExecutionReadinessResponseDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  readiness: ImageRunExecutionReadinessSummaryDtoSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

const ImageRunEventEnvelopeSchema = z.object({
  eventId: IdentifierSchema,
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  category: z.enum([
    ImageRunEventCategories.lifecycle,
    ImageRunEventCategories.progress,
    ImageRunEventCategories.failure,
    ImageRunEventCategories.result,
    ImageRunEventCategories.cancellation,
  ]),
  eventKind: z.enum([
    ImageRunEventKinds.submissionAccepted,
    ImageRunEventKinds.stateChanged,
    ImageRunEventKinds.progressUpdated,
    ImageRunEventKinds.cancellationRequested,
    ImageRunEventKinds.cancelled,
    ImageRunEventKinds.failed,
    ImageRunEventKinds.completed,
    ImageRunEventKinds.resultAttached,
  ]),
  runId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  systemId: IdentifierSchema,
  occurredAt: TimestampSchema,
  sequence: z.number().int().min(1),
  cursor: z.string().trim().regex(/^image-run-event:\d+$/),
  payload: z.union([
    z.object({
      previousState: RunLifecycleStateSchema.optional(),
      state: RunLifecycleStateSchema,
      reasonCode: IdentifierSchema.optional(),
      reasonMessage: z.string().trim().min(1).max(1024).optional(),
    }).strict(),
    z.object({
      progress: ImageRunProgressSnapshotDtoSchema,
    }).strict(),
    z.object({
      failure: ImageRunFailureSummaryDtoSchema,
    }).strict(),
    z.object({
      result: ImageRunResultSummaryDtoSchema,
    }).strict(),
    z.object({
      requestedAt: TimestampSchema,
      requestedByActorId: IdentifierSchema.optional(),
      reason: OptionalReasonSchema,
    }).strict(),
  ]),
}).strict().superRefine((value, context) => {
  if (parseImageRunEventCursor(value.cursor) !== value.sequence) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cursor"],
      message: "cursor must match the event sequence.",
    });
  }
  if (value.cursor !== buildImageRunEventCursor(value.sequence)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cursor"],
      message: "cursor must use canonical image-run-event format.",
    });
  }
});

export const ListImageRunEventsRequestDtoSchema: z.ZodType<ListImageRunEventsRequestDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  workspaceId: IdentifierSchema,
  runId: IdentifierSchema,
  afterCursor: z.string().trim().regex(/^image-run-event:\d+$/).optional(),
  limit: z.number().int().min(1).max(500).optional(),
}).strict();

export const ListImageRunEventsResponseDtoSchema: z.ZodType<ListImageRunEventsResponseDto> = z.object({
  contractVersion: z.literal(ImageRunApiContractVersions.v1),
  items: z.array(ImageRunEventEnvelopeSchema),
  nextCursor: z.string().trim().regex(/^image-run-event:\d+$/).optional(),
}).strict().superRefine(assertNoForbiddenInternalKeys);

export type ImageRunSubmissionRequestDtoPayload = z.infer<typeof ImageRunSubmissionRequestDtoSchema>;
export type SubmitImageRunResponseDtoPayload = z.infer<typeof SubmitImageRunResponseDtoSchema>;
export type GetImageRunRequestDtoPayload = z.infer<typeof GetImageRunRequestDtoSchema>;
export type GetImageRunResponseDtoPayload = z.infer<typeof GetImageRunResponseDtoSchema>;
export type ListImageRunsRequestDtoPayload = z.infer<typeof ListImageRunsRequestDtoSchema>;
export type ListImageRunsResponseDtoPayload = z.infer<typeof ListImageRunsResponseDtoSchema>;
export type GetImageRunStatusRequestDtoPayload = z.infer<typeof GetImageRunStatusRequestDtoSchema>;
export type GetImageRunStatusResponseDtoPayload = z.infer<typeof GetImageRunStatusResponseDtoSchema>;
export type CancelImageRunRequestDtoPayload = z.infer<typeof CancelImageRunRequestDtoSchema>;
export type CancelImageRunResponseDtoPayload = z.infer<typeof CancelImageRunResponseDtoSchema>;
export type GetImageRunExecutionReadinessRequestDtoPayload =
  z.infer<typeof GetImageRunExecutionReadinessRequestDtoSchema>;
export type GetImageRunExecutionReadinessResponseDtoPayload =
  z.infer<typeof GetImageRunExecutionReadinessResponseDtoSchema>;
export type ListImageRunEventsRequestDtoPayload = z.infer<typeof ListImageRunEventsRequestDtoSchema>;
export type ListImageRunEventsResponseDtoPayload = z.infer<typeof ListImageRunEventsResponseDtoSchema>;

export function parseImageRunSubmissionRequestDto(payload: unknown): ImageRunSubmissionRequestDtoPayload {
  return parseSchema("ImageRunSubmissionRequestDto", ImageRunSubmissionRequestDtoSchema, payload);
}

export function parseSubmitImageRunResponseDto(payload: unknown): SubmitImageRunResponseDtoPayload {
  return parseSchema("SubmitImageRunResponseDto", SubmitImageRunResponseDtoSchema, payload);
}

export function parseGetImageRunRequestDto(payload: unknown): GetImageRunRequestDtoPayload {
  return parseSchema("GetImageRunRequestDto", GetImageRunRequestDtoSchema, payload);
}

export function parseGetImageRunResponseDto(payload: unknown): GetImageRunResponseDtoPayload {
  return parseSchema("GetImageRunResponseDto", GetImageRunResponseDtoSchema, payload);
}

export function parseListImageRunsRequestDto(payload: unknown): ListImageRunsRequestDtoPayload {
  return parseSchema("ListImageRunsRequestDto", ListImageRunsRequestDtoSchema, payload);
}

export function parseListImageRunsResponseDto(payload: unknown): ListImageRunsResponseDtoPayload {
  return parseSchema("ListImageRunsResponseDto", ListImageRunsResponseDtoSchema, payload);
}

export function parseGetImageRunStatusRequestDto(payload: unknown): GetImageRunStatusRequestDtoPayload {
  return parseSchema("GetImageRunStatusRequestDto", GetImageRunStatusRequestDtoSchema, payload);
}

export function parseGetImageRunStatusResponseDto(payload: unknown): GetImageRunStatusResponseDtoPayload {
  return parseSchema("GetImageRunStatusResponseDto", GetImageRunStatusResponseDtoSchema, payload);
}

export function parseCancelImageRunRequestDto(payload: unknown): CancelImageRunRequestDtoPayload {
  return parseSchema("CancelImageRunRequestDto", CancelImageRunRequestDtoSchema, payload);
}

export function parseCancelImageRunResponseDto(payload: unknown): CancelImageRunResponseDtoPayload {
  return parseSchema("CancelImageRunResponseDto", CancelImageRunResponseDtoSchema, payload);
}

export function parseGetImageRunExecutionReadinessRequestDto(
  payload: unknown,
): GetImageRunExecutionReadinessRequestDtoPayload {
  return parseSchema(
    "GetImageRunExecutionReadinessRequestDto",
    GetImageRunExecutionReadinessRequestDtoSchema,
    payload,
  );
}

export function parseGetImageRunExecutionReadinessResponseDto(
  payload: unknown,
): GetImageRunExecutionReadinessResponseDtoPayload {
  return parseSchema(
    "GetImageRunExecutionReadinessResponseDto",
    GetImageRunExecutionReadinessResponseDtoSchema,
    payload,
  );
}

export function parseListImageRunEventsRequestDto(payload: unknown): ListImageRunEventsRequestDtoPayload {
  return parseSchema("ListImageRunEventsRequestDto", ListImageRunEventsRequestDtoSchema, payload);
}

export function parseListImageRunEventsResponseDto(payload: unknown): ListImageRunEventsResponseDtoPayload {
  return parseSchema("ListImageRunEventsResponseDto", ListImageRunEventsResponseDtoSchema, payload);
}
