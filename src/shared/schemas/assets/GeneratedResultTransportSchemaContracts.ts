import { z } from "zod";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import { SupportedImageMediaTypes } from "@domain/image-assets/ImageAssetDomain";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import {
  GeneratedResultDerivativeAvailabilityStatuses,
  GeneratedResultPreviewKinds,
} from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import {
  GeneratedResultOriginalAccessPurposes,
  GeneratedResultTransportContractVersions,
  type GetGeneratedResultLineageDetailRequestDto,
  type GetGeneratedResultLineageDetailResponseDto,
  type GetGeneratedResultLineageSummaryRequestDto,
  type GetGeneratedResultLineageSummaryResponseDto,
  type GetGeneratedResultRequestDto,
  type GetGeneratedResultResponseDto,
  type ListGeneratedResultsByRunRequestDto,
  type ListGeneratedResultsByRunResponseDto,
  type ListGeneratedResultsRequestDto,
  type ListGeneratedResultsResponseDto,
  type RequestGeneratedResultOriginalAccessRequestDto,
  type RequestGeneratedResultOriginalAccessResponseDto,
  type RequestGeneratedResultPreviewRequestDto,
  type RequestGeneratedResultPreviewResponseDto,
} from "@shared/contracts/assets/GeneratedResultTransportContracts";

export interface GeneratedResultTransportSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class GeneratedResultTransportSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<GeneratedResultTransportSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<GeneratedResultTransportSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "GeneratedResultTransportSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(192).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/);
const StorageInstanceIdSchema = z.string().trim().min(3).max(127).regex(/^[a-z0-9][a-z0-9-]{2,126}$/);
const TimestampSchema = z.string().trim().datetime({ offset: true });
const MediaTypeSchema = z.enum(SupportedImageMediaTypes);
const PreviewKindSchema = z.enum([
  GeneratedResultPreviewKinds.thumbnail,
  GeneratedResultPreviewKinds.displaySafe,
  GeneratedResultPreviewKinds.historySafe,
]);
const PreviewAvailabilityStatusSchema = z.enum([
  GeneratedResultDerivativeAvailabilityStatuses.pending,
  GeneratedResultDerivativeAvailabilityStatuses.available,
  GeneratedResultDerivativeAvailabilityStatuses.failed,
  GeneratedResultDerivativeAvailabilityStatuses.stale,
]);
const ResultStatusSchema = z.enum([
  GeneratedResultAssetStatuses.pendingCollection,
  GeneratedResultAssetStatuses.available,
  GeneratedResultAssetStatuses.previewReady,
  GeneratedResultAssetStatuses.failedCollection,
  GeneratedResultAssetStatuses.archived,
]);
const VisibilitySchema = z.enum([
  AssetVisibilities.private,
  AssetVisibilities.workspace,
  AssetVisibilities.shared,
  AssetVisibilities.published,
]);

function isFilesystemLikeReference(value: string): boolean {
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
    throw new GeneratedResultTransportSchemaValidationError(
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
    "rawComfyOutputPath",
    "backendFilePath",
    "filesystemPath",
    "absolutePath",
    "localPath",
    "storageRootPath",
    "rawAdapterPayload",
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
          message: `Field '${key}' is not allowed in generated-result transport contracts.`,
        });
      }
      visit(entry, [...path, key]);
    }
  };

  visit(value, []);
}

const ProtectedResourceIdSchema = z.string().trim().regex(/^protected-resource:\/\/[a-z0-9][a-z0-9._:-]{2,191}$/);
const AccessHandleSchema = z.string().trim().regex(/^preview-access:\/\/[a-z0-9][a-z0-9._:/-]{2,255}$/);

const GeneratedResultPreviewDescriptorDtoSchema = z.object({
  derivativeId: IdentifierSchema,
  previewKind: PreviewKindSchema,
  availabilityStatus: PreviewAvailabilityStatusSchema,
  isPrimaryPreview: z.boolean(),
  mediaType: MediaTypeSchema.optional(),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
  byteSize: z.number().int().min(1).optional(),
  protectedResourceId: ProtectedResourceIdSchema.optional(),
  accessHandle: AccessHandleSchema.optional(),
  accessExpiresAt: TimestampSchema.optional(),
  generatedAt: TimestampSchema.optional(),
  failureCode: IdentifierSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.protectedResourceId && isFilesystemLikeReference(value.protectedResourceId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["protectedResourceId"],
      message: "protectedResourceId must be logical and cannot be a filesystem path.",
    });
  }

  if (value.accessHandle && isFilesystemLikeReference(value.accessHandle)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accessHandle"],
      message: "accessHandle must be logical and cannot be a filesystem path.",
    });
  }

  if (
    value.protectedResourceId?.startsWith("storage-instance://")
    || value.accessHandle?.startsWith("storage-instance://")
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accessHandle"],
      message: "preview access metadata cannot expose storage-instance references.",
    });
  }

  const hasAccess = Boolean(value.protectedResourceId || value.accessHandle || value.mediaType);
  if (
    value.availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.pending
    || value.availabilityStatus === GeneratedResultDerivativeAvailabilityStatuses.failed
  ) {
    if (hasAccess) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["availabilityStatus"],
        message: "pending/failed preview descriptors cannot include access metadata.",
      });
    }
  } else if (!value.protectedResourceId || !value.accessHandle || !value.mediaType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["availabilityStatus"],
      message: "available/stale preview descriptors must include protectedResourceId, accessHandle, and mediaType.",
    });
  }
});

const GeneratedResultLineageSummaryDtoSchema = z.object({
  resultAssetId: IdentifierSchema,
  runId: IdentifierSchema,
  systemId: IdentifierSchema,
  workflowId: IdentifierSchema,
  workflowTemplateId: IdentifierSchema.optional(),
  executionNodeId: IdentifierSchema.optional(),
  outputSlot: z.string().trim().min(1).max(128).regex(/^[a-z0-9][a-z0-9._:-]{0,127}$/),
  inputAssetCount: z.number().int().min(0),
  hasWorkflowTemplateVersion: z.boolean(),
  hasSystemSnapshot: z.boolean(),
  hasParameterSnapshot: z.boolean(),
  hasSelectedNode: z.boolean(),
}).strict();

const GeneratedResultLineageDetailDtoSchema = z.object({
  summary: GeneratedResultLineageSummaryDtoSchema,
  source: z.object({
    workflowTemplateVersionId: IdentifierSchema.optional(),
    workflowTemplateVersionTag: z.string().trim().regex(/^\d+\.\d+\.\d+$/).optional(),
    systemSnapshotId: IdentifierSchema.optional(),
    systemVersionTag: z.string().trim().regex(/^\d+\.\d+\.\d+$/).optional(),
    parameterSnapshotId: IdentifierSchema.optional(),
    selectedNodeId: IdentifierSchema.optional(),
    executionAdapterKind: z.string().trim().regex(/^[a-z0-9][a-z0-9._:-]{1,126}$/).optional(),
    executionBackendFamily: z.string().trim().regex(/^[a-z0-9][a-z0-9._:-]{1,126}$/).optional(),
  }).strict(),
  upstreamInputs: z.array(z.object({
    assetId: IdentifierSchema,
  }).strict()).max(2048),
  graph: z.object({
    nodes: z.array(z.object({
      nodeId: IdentifierSchema,
      nodeType: z.enum(["result", "run", "workflow", "system", "execution-node", "input-asset"]),
      referenceId: IdentifierSchema,
      label: z.string().trim().min(1).max(256).optional(),
    }).strict()).max(4096),
    edges: z.array(z.object({
      edgeId: IdentifierSchema,
      fromNodeId: IdentifierSchema,
      toNodeId: IdentifierSchema,
      relation: z.enum([
        "produced-by-run",
        "run-used-workflow",
        "run-targeted-system",
        "run-executed-on-node",
        "result-derived-from-input",
      ]),
    }).strict()).max(8192),
  }).strict(),
}).strict();

const GeneratedResultSummaryDtoSchema = z.object({
  resultAssetId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  runId: IdentifierSchema,
  systemId: IdentifierSchema,
  workflowId: IdentifierSchema,
  workflowTemplateId: IdentifierSchema.optional(),
  executionNodeId: IdentifierSchema.optional(),
  outputSlot: z.string().trim().min(1).max(128).regex(/^[a-z0-9][a-z0-9._:-]{0,127}$/),
  status: ResultStatusSchema,
  mediaType: MediaTypeSchema,
  visibility: VisibilitySchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  preview: z.object({
    hasPreview: z.boolean(),
    primaryPreviewKind: PreviewKindSchema.optional(),
    availabilityStatus: PreviewAvailabilityStatusSchema.optional(),
  }).strict().superRefine((value, context) => {
    if (!value.hasPreview && (value.primaryPreviewKind || value.availabilityStatus)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryPreviewKind"],
        message: "primaryPreviewKind/availabilityStatus can only be present when hasPreview=true.",
      });
    }
  }),
  lineage: GeneratedResultLineageSummaryDtoSchema,
}).strict();

const StorageBindingReferenceSchema = z.string().trim()
  .regex(/^storage-instance:\/\/[a-z0-9][a-z0-9-]{2,126}(?:\/[a-z0-9._:-]+)?$/)
  .refine((value) => !isFilesystemLikeReference(value), {
    message: "storageBindingReference must be logical and cannot be a filesystem path.",
  });

const GeneratedResultDetailDtoSchema = GeneratedResultSummaryDtoSchema.extend({
  ownerUserId: IdentifierSchema.optional(),
  sharingPolicyRef: z.object({
    policyId: IdentifierSchema,
    policyVersion: IdentifierSchema.optional(),
  }).strict().optional(),
  storage: z.object({
    storageInstanceId: StorageInstanceIdSchema,
    storageBindingReference: StorageBindingReferenceSchema.optional(),
  }).strict().superRefine((value, context) => {
    if (
      value.storageBindingReference
      && !value.storageBindingReference.startsWith(`storage-instance://${value.storageInstanceId}`)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storageBindingReference"],
        message: "storageBindingReference must match storageInstanceId.",
      });
    }
  }),
  lifecycle: z.object({
    pendingSince: TimestampSchema,
    logicalAssetVersionId: IdentifierSchema.optional(),
    persistedAt: TimestampSchema.optional(),
    persistedBy: IdentifierSchema.optional(),
    previewReadyAt: TimestampSchema.optional(),
    previewReadyBy: IdentifierSchema.optional(),
    failedAt: TimestampSchema.optional(),
    failedBy: IdentifierSchema.optional(),
    failureCode: IdentifierSchema.optional(),
    failureMessage: z.string().trim().min(1).max(2048).optional(),
    archivedAt: TimestampSchema.optional(),
    archivedBy: IdentifierSchema.optional(),
  }).strict(),
  previewDescriptors: z.array(GeneratedResultPreviewDescriptorDtoSchema).max(64),
}).strict().superRefine((value, context) => {
  const lifecycle = value.lifecycle;
  const requireTogether = (left: unknown, right: unknown, path: string, message: string): void => {
    if ((left && !right) || (!left && right)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    }
  };

  requireTogether(lifecycle.persistedAt, lifecycle.persistedBy, "lifecycle.persistedBy", "persistedAt and persistedBy must be provided together.");
  requireTogether(lifecycle.previewReadyAt, lifecycle.previewReadyBy, "lifecycle.previewReadyBy", "previewReadyAt and previewReadyBy must be provided together.");
  requireTogether(lifecycle.failedAt, lifecycle.failedBy, "lifecycle.failedBy", "failedAt and failedBy must be provided together.");
  requireTogether(lifecycle.archivedAt, lifecycle.archivedBy, "lifecycle.archivedBy", "archivedAt and archivedBy must be provided together.");

  if (value.status === GeneratedResultAssetStatuses.pendingCollection) {
    if (
      lifecycle.logicalAssetVersionId
      || lifecycle.persistedAt
      || lifecycle.previewReadyAt
      || lifecycle.failedAt
      || lifecycle.failureCode
      || lifecycle.failureMessage
      || lifecycle.archivedAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lifecycle"],
        message: "pending-collection results cannot include persisted, preview, failed, or archived metadata.",
      });
    }
  } else if (value.status === GeneratedResultAssetStatuses.available) {
    if (!lifecycle.logicalAssetVersionId || !lifecycle.persistedAt || !lifecycle.persistedBy) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lifecycle"],
        message: "available results must include logicalAssetVersionId, persistedAt, and persistedBy.",
      });
    }
    if (lifecycle.failedAt || lifecycle.archivedAt || lifecycle.previewReadyAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lifecycle"],
        message: "available results cannot include preview, failed, or archived metadata.",
      });
    }
  } else if (value.status === GeneratedResultAssetStatuses.previewReady) {
    if (
      !lifecycle.logicalAssetVersionId
      || !lifecycle.persistedAt
      || !lifecycle.persistedBy
      || !lifecycle.previewReadyAt
      || !lifecycle.previewReadyBy
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lifecycle"],
        message: "preview-ready results must include persisted and preview readiness metadata.",
      });
    }
  } else if (value.status === GeneratedResultAssetStatuses.failedCollection) {
    if (!lifecycle.failedAt || !lifecycle.failedBy || !lifecycle.failureCode || !lifecycle.failureMessage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lifecycle"],
        message: "failed-collection results must include failed metadata.",
      });
    }
    if (lifecycle.logicalAssetVersionId || lifecycle.persistedAt || lifecycle.previewReadyAt || lifecycle.archivedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lifecycle"],
        message: "failed-collection results cannot include persisted, preview, or archived metadata.",
      });
    }
  } else if (
    !lifecycle.logicalAssetVersionId
    || !lifecycle.persistedAt
    || !lifecycle.persistedBy
    || !lifecycle.archivedAt
    || !lifecycle.archivedBy
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lifecycle"],
      message: "archived results must include persisted and archived metadata.",
    });
  }
});

export const ListGeneratedResultsRequestDtoSchema: z.ZodType<ListGeneratedResultsRequestDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  runId: IdentifierSchema.optional(),
  systemId: IdentifierSchema.optional(),
  workflowId: IdentifierSchema.optional(),
  statuses: z.array(ResultStatusSchema).max(16).optional(),
  visibilities: z.array(VisibilitySchema).max(16).optional(),
  mediaTypes: z.array(MediaTypeSchema).max(16).optional(),
  search: z.string().trim().min(1).max(256).optional(),
  createdAfter: TimestampSchema.optional(),
  createdBefore: TimestampSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "status"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
}).strict();

export const ListGeneratedResultsResponseDtoSchema: z.ZodType<ListGeneratedResultsResponseDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  items: z.array(GeneratedResultSummaryDtoSchema),
  pagination: z.object({
    limit: z.number().int().min(0),
    offset: z.number().int().min(0),
    returned: z.number().int().min(0),
    hasMore: z.boolean(),
  }).strict(),
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const GetGeneratedResultRequestDtoSchema: z.ZodType<GetGeneratedResultRequestDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  resultAssetId: IdentifierSchema,
}).strict().superRefine((value, context) => {
  if (isFilesystemLikeReference(value.resultAssetId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resultAssetId"],
      message: "resultAssetId must be a logical id and cannot be a filesystem path.",
    });
  }
});

export const GetGeneratedResultResponseDtoSchema: z.ZodType<GetGeneratedResultResponseDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  result: GeneratedResultDetailDtoSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const ListGeneratedResultsByRunRequestDtoSchema: z.ZodType<ListGeneratedResultsByRunRequestDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  runId: IdentifierSchema,
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

export const ListGeneratedResultsByRunResponseDtoSchema: z.ZodType<ListGeneratedResultsByRunResponseDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  runId: IdentifierSchema,
  items: z.array(GeneratedResultSummaryDtoSchema),
  pagination: z.object({
    limit: z.number().int().min(0),
    offset: z.number().int().min(0),
    returned: z.number().int().min(0),
    hasMore: z.boolean(),
  }).strict(),
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const RequestGeneratedResultPreviewRequestDtoSchema: z.ZodType<RequestGeneratedResultPreviewRequestDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  resultAssetId: IdentifierSchema,
  preferredPreviewKinds: z.array(PreviewKindSchema).max(8).optional(),
}).strict();

export const RequestGeneratedResultPreviewResponseDtoSchema: z.ZodType<RequestGeneratedResultPreviewResponseDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  resultAssetId: IdentifierSchema,
  preview: z.object({
    available: z.boolean(),
    selected: GeneratedResultPreviewDescriptorDtoSchema.optional(),
    alternatives: z.array(GeneratedResultPreviewDescriptorDtoSchema).max(32),
  }).strict().superRefine((value, context) => {
    if (!value.available && value.selected) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selected"],
        message: "selected preview can only be present when available=true.",
      });
    }
  }),
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const RequestGeneratedResultOriginalAccessRequestDtoSchema: z.ZodType<RequestGeneratedResultOriginalAccessRequestDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  resultAssetId: IdentifierSchema,
  purpose: z.enum([
    GeneratedResultOriginalAccessPurposes.downloadOriginal,
    GeneratedResultOriginalAccessPurposes.exportOriginal,
    GeneratedResultOriginalAccessPurposes.auditReadonly,
  ]),
  expiresInSeconds: z.number().int().min(1).max(86400).optional(),
  suggestedFileName: z.string().trim().min(1).max(255).optional(),
}).strict();

export const RequestGeneratedResultOriginalAccessResponseDtoSchema: z.ZodType<RequestGeneratedResultOriginalAccessResponseDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  resultAssetId: IdentifierSchema,
  original: z.object({
    mediaType: MediaTypeSchema,
    byteSize: z.number().int().min(1).optional(),
    protectedResourceId: ProtectedResourceIdSchema,
    accessHandle: AccessHandleSchema,
    expiresAt: TimestampSchema,
    suggestedFileName: z.string().trim().min(1).max(255).optional(),
  }).strict(),
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const GetGeneratedResultLineageSummaryRequestDtoSchema: z.ZodType<GetGeneratedResultLineageSummaryRequestDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  resultAssetId: IdentifierSchema,
}).strict();

export const GetGeneratedResultLineageSummaryResponseDtoSchema: z.ZodType<GetGeneratedResultLineageSummaryResponseDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  lineage: GeneratedResultLineageSummaryDtoSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export const GetGeneratedResultLineageDetailRequestDtoSchema: z.ZodType<GetGeneratedResultLineageDetailRequestDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  resultAssetId: IdentifierSchema,
}).strict();

export const GetGeneratedResultLineageDetailResponseDtoSchema: z.ZodType<GetGeneratedResultLineageDetailResponseDto> = z.object({
  contractVersion: z.literal(GeneratedResultTransportContractVersions.v1),
  lineage: GeneratedResultLineageDetailDtoSchema,
}).strict().superRefine(assertNoForbiddenInternalKeys);

export type ListGeneratedResultsRequestDtoPayload = z.infer<typeof ListGeneratedResultsRequestDtoSchema>;
export type ListGeneratedResultsResponseDtoPayload = z.infer<typeof ListGeneratedResultsResponseDtoSchema>;
export type GetGeneratedResultRequestDtoPayload = z.infer<typeof GetGeneratedResultRequestDtoSchema>;
export type GetGeneratedResultResponseDtoPayload = z.infer<typeof GetGeneratedResultResponseDtoSchema>;
export type ListGeneratedResultsByRunRequestDtoPayload = z.infer<typeof ListGeneratedResultsByRunRequestDtoSchema>;
export type ListGeneratedResultsByRunResponseDtoPayload = z.infer<typeof ListGeneratedResultsByRunResponseDtoSchema>;
export type RequestGeneratedResultPreviewRequestDtoPayload = z.infer<typeof RequestGeneratedResultPreviewRequestDtoSchema>;
export type RequestGeneratedResultPreviewResponseDtoPayload = z.infer<typeof RequestGeneratedResultPreviewResponseDtoSchema>;
export type RequestGeneratedResultOriginalAccessRequestDtoPayload = z.infer<typeof RequestGeneratedResultOriginalAccessRequestDtoSchema>;
export type RequestGeneratedResultOriginalAccessResponseDtoPayload = z.infer<typeof RequestGeneratedResultOriginalAccessResponseDtoSchema>;
export type GetGeneratedResultLineageSummaryRequestDtoPayload = z.infer<typeof GetGeneratedResultLineageSummaryRequestDtoSchema>;
export type GetGeneratedResultLineageSummaryResponseDtoPayload = z.infer<typeof GetGeneratedResultLineageSummaryResponseDtoSchema>;
export type GetGeneratedResultLineageDetailRequestDtoPayload = z.infer<typeof GetGeneratedResultLineageDetailRequestDtoSchema>;
export type GetGeneratedResultLineageDetailResponseDtoPayload = z.infer<typeof GetGeneratedResultLineageDetailResponseDtoSchema>;

export function parseListGeneratedResultsRequestDto(payload: unknown): ListGeneratedResultsRequestDtoPayload {
  return parseSchema("ListGeneratedResultsRequestDto", ListGeneratedResultsRequestDtoSchema, payload);
}

export function parseListGeneratedResultsResponseDto(payload: unknown): ListGeneratedResultsResponseDtoPayload {
  return parseSchema("ListGeneratedResultsResponseDto", ListGeneratedResultsResponseDtoSchema, payload);
}

export function parseGetGeneratedResultRequestDto(payload: unknown): GetGeneratedResultRequestDtoPayload {
  return parseSchema("GetGeneratedResultRequestDto", GetGeneratedResultRequestDtoSchema, payload);
}

export function parseGetGeneratedResultResponseDto(payload: unknown): GetGeneratedResultResponseDtoPayload {
  return parseSchema("GetGeneratedResultResponseDto", GetGeneratedResultResponseDtoSchema, payload);
}

export function parseListGeneratedResultsByRunRequestDto(
  payload: unknown,
): ListGeneratedResultsByRunRequestDtoPayload {
  return parseSchema("ListGeneratedResultsByRunRequestDto", ListGeneratedResultsByRunRequestDtoSchema, payload);
}

export function parseListGeneratedResultsByRunResponseDto(
  payload: unknown,
): ListGeneratedResultsByRunResponseDtoPayload {
  return parseSchema("ListGeneratedResultsByRunResponseDto", ListGeneratedResultsByRunResponseDtoSchema, payload);
}

export function parseRequestGeneratedResultPreviewRequestDto(
  payload: unknown,
): RequestGeneratedResultPreviewRequestDtoPayload {
  return parseSchema("RequestGeneratedResultPreviewRequestDto", RequestGeneratedResultPreviewRequestDtoSchema, payload);
}

export function parseRequestGeneratedResultPreviewResponseDto(
  payload: unknown,
): RequestGeneratedResultPreviewResponseDtoPayload {
  return parseSchema("RequestGeneratedResultPreviewResponseDto", RequestGeneratedResultPreviewResponseDtoSchema, payload);
}

export function parseRequestGeneratedResultOriginalAccessRequestDto(
  payload: unknown,
): RequestGeneratedResultOriginalAccessRequestDtoPayload {
  return parseSchema(
    "RequestGeneratedResultOriginalAccessRequestDto",
    RequestGeneratedResultOriginalAccessRequestDtoSchema,
    payload,
  );
}

export function parseRequestGeneratedResultOriginalAccessResponseDto(
  payload: unknown,
): RequestGeneratedResultOriginalAccessResponseDtoPayload {
  return parseSchema(
    "RequestGeneratedResultOriginalAccessResponseDto",
    RequestGeneratedResultOriginalAccessResponseDtoSchema,
    payload,
  );
}

export function parseGetGeneratedResultLineageSummaryRequestDto(
  payload: unknown,
): GetGeneratedResultLineageSummaryRequestDtoPayload {
  return parseSchema(
    "GetGeneratedResultLineageSummaryRequestDto",
    GetGeneratedResultLineageSummaryRequestDtoSchema,
    payload,
  );
}

export function parseGetGeneratedResultLineageSummaryResponseDto(
  payload: unknown,
): GetGeneratedResultLineageSummaryResponseDtoPayload {
  return parseSchema(
    "GetGeneratedResultLineageSummaryResponseDto",
    GetGeneratedResultLineageSummaryResponseDtoSchema,
    payload,
  );
}

export function parseGetGeneratedResultLineageDetailRequestDto(
  payload: unknown,
): GetGeneratedResultLineageDetailRequestDtoPayload {
  return parseSchema(
    "GetGeneratedResultLineageDetailRequestDto",
    GetGeneratedResultLineageDetailRequestDtoSchema,
    payload,
  );
}

export function parseGetGeneratedResultLineageDetailResponseDto(
  payload: unknown,
): GetGeneratedResultLineageDetailResponseDtoPayload {
  return parseSchema(
    "GetGeneratedResultLineageDetailResponseDto",
    GetGeneratedResultLineageDetailResponseDtoSchema,
    payload,
  );
}
