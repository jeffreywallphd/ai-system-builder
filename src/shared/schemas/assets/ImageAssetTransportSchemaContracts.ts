import { z } from "zod";
import {
  ResourceVisibilities,
  SharingPolicyModes,
} from "@domain/authorization/AuthorizationDomain";
import {
  ImageAssetEventKinds,
  ImageAssetTransportContractVersions,
  ImageAssetUploadSessionStatuses,
  ImageAssetAccessPurposes,
} from "../../contracts/assets/ImageAssetTransportContracts";
import {
  ImageAssetFingerprintAlgorithms,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  SupportedImageMediaTypes,
} from "@domain/image-assets/ImageAssetDomain";
import type {
  CompleteImageAssetUploadRequestDto,
  CompleteImageAssetUploadResponseDto,
  CreateImageAssetRequestDto,
  CreateImageAssetResponseDto,
  GetImageAssetMetadataRequestDto,
  GetImageAssetMetadataResponseDto,
  InitiateImageAssetUploadRequestDto,
  InitiateImageAssetUploadResponseDto,
  ListImageAssetEventsRequestDto,
  ListImageAssetEventsResponseDto,
  ListImageAssetsRequestDto,
  ListImageAssetsResponseDto,
  RequestImageAssetAccessRequestDto,
  RequestImageAssetAccessResponseDto,
  RequestImageAssetPreviewRequestDto,
  RequestImageAssetPreviewResponseDto,
} from "../../dto/assets/ImageAssetTransportDtos";

export interface ImageAssetTransportSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class ImageAssetTransportSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<ImageAssetTransportSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<ImageAssetTransportSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "ImageAssetTransportSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(192).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,191}$/);
const StorageInstanceIdSchema = z.string().trim().min(1).max(127).regex(/^[a-z0-9][a-z0-9-]{2,126}$/);
const TimestampSchema = z.string().trim().datetime({ offset: true });
const FilenameSchema = z.string().trim().min(1).max(255);
const NormalizedFilenameSchema = z.string().trim().toLowerCase().min(1).max(255)
  .regex(/^[a-z0-9][a-z0-9._-]*$/)
  .refine((value) => !value.includes("/") && !value.includes("\\"), {
    message: "normalizedFilename cannot include path separators.",
  });
const MediaTypeSchema = z.enum(SupportedImageMediaTypes);

const StorageBindingReferenceSchema = z.string().trim()
  .regex(/^storage-instance:\/\/[a-z0-9][a-z0-9-]{2,126}(?:\/[a-z0-9-]+)?$/)
  .refine((value) => !value.startsWith("/") && !value.includes("\\") && !/^[a-zA-Z]:\\/.test(value), {
    message: "storageBindingReference must be a logical storage-instance reference, not a filesystem path.",
  });

const FingerprintSchema = z.object({
  algorithm: z.enum([
    ImageAssetFingerprintAlgorithms.sha256,
    ImageAssetFingerprintAlgorithms.sha512,
    ImageAssetFingerprintAlgorithms.blake3,
  ]),
  digest: z.string().trim().toLowerCase().regex(/^[a-f0-9]+$/),
}).strict().superRefine((value, context) => {
  const expectedLength = value.algorithm === ImageAssetFingerprintAlgorithms.sha512 ? 128 : 64;
  if (value.digest.length !== expectedLength) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["digest"],
      message: `digest must be ${expectedLength} characters for algorithm '${value.algorithm}'.`,
    });
  }
});

const VisibilitySchema = z.enum([
  ResourceVisibilities.private,
  ResourceVisibilities.workspace,
  ResourceVisibilities.shared,
  ResourceVisibilities.published,
]);

const SharingPolicySchema = z.object({
  mode: z.enum([
    SharingPolicyModes.ownerOnly,
    SharingPolicyModes.workspaceMembers,
    SharingPolicyModes.explicit,
    SharingPolicyModes.published,
  ]),
  policyId: IdentifierSchema.optional(),
  policyVersion: IdentifierSchema.optional(),
}).strict();

const LifecycleSchema = z.object({
  status: z.enum([
    ImageAssetStatuses.ingesting,
    ImageAssetStatuses.available,
    ImageAssetStatuses.failed,
    ImageAssetStatuses.archived,
    ImageAssetStatuses.deleted,
  ]),
  ingestedAt: TimestampSchema.optional(),
  failedAt: TimestampSchema.optional(),
  failedBy: IdentifierSchema.optional(),
  failureReason: z.string().trim().min(1).max(2000).optional(),
  archivedAt: TimestampSchema.optional(),
  archivedBy: IdentifierSchema.optional(),
  deletedAt: TimestampSchema.optional(),
  deletedBy: IdentifierSchema.optional(),
}).strict();

const OwnershipSchema = z.object({
  workspaceId: IdentifierSchema,
  ownerUserId: IdentifierSchema.optional(),
  createdBy: IdentifierSchema,
  lastModifiedBy: IdentifierSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

const StorageSchema = z.object({
  storageInstanceId: StorageInstanceIdSchema,
  storageBindingReference: StorageBindingReferenceSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.storageBindingReference && !value.storageBindingReference.startsWith(`storage-instance://${value.storageInstanceId}`)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["storageBindingReference"],
      message: "storageBindingReference must start with storage-instance://<storageInstanceId>.",
    });
  }
});

const PreviewSchema = z.object({
  available: z.boolean(),
  previewAssetId: IdentifierSchema.optional(),
  mediaType: MediaTypeSchema.optional(),
}).strict().superRefine((value, context) => {
  if (!value.available && (value.previewAssetId || value.mediaType)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["previewAssetId"],
      message: "previewAssetId/mediaType can be present only when available=true.",
    });
  }
});

const LineageSchema = z.object({
  upstreamAssetIds: z.array(IdentifierSchema),
  sourceRunId: IdentifierSchema.optional(),
  generationOperationId: IdentifierSchema.optional(),
}).strict();

export const ImageAssetSummaryDtoSchema = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  assetId: IdentifierSchema,
  originKind: z.enum([
    ImageAssetOriginKinds.uploadedSource,
    ImageAssetOriginKinds.generatedResult,
  ]),
  mediaType: MediaTypeSchema,
  normalizedFilename: NormalizedFilenameSchema,
  sizeBytes: z.number().int().positive(),
  visibility: VisibilitySchema,
  ownership: OwnershipSchema,
  storage: StorageSchema,
  lifecycle: LifecycleSchema,
  preview: PreviewSchema,
}).strict();

export const ImageAssetDetailDtoSchema = ImageAssetSummaryDtoSchema.extend({
  originalFilename: FilenameSchema,
  fingerprint: FingerprintSchema,
  sharingPolicy: SharingPolicySchema,
  lineage: LineageSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.visibility === ResourceVisibilities.private && !value.ownership.ownerUserId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ownership", "ownerUserId"],
      message: "private visibility requires ownership.ownerUserId.",
    });
  }

  if (value.visibility === ResourceVisibilities.shared && !value.sharingPolicy.policyId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sharingPolicy", "policyId"],
      message: "shared visibility requires sharingPolicy.policyId.",
    });
  }

  if (value.visibility === ResourceVisibilities.published && !value.sharingPolicy.policyId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sharingPolicy", "policyId"],
      message: "published visibility requires sharingPolicy.policyId.",
    });
  }
});

export const ImageAssetUploadSessionDtoSchema = z.object({
  uploadSessionId: IdentifierSchema,
  assetId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  status: z.enum([
    ImageAssetUploadSessionStatuses.pending,
    ImageAssetUploadSessionStatuses.uploaded,
    ImageAssetUploadSessionStatuses.finalized,
    ImageAssetUploadSessionStatuses.expired,
    ImageAssetUploadSessionStatuses.canceled,
  ]),
  uploadEndpoint: z.string().trim().min(1),
  uploadMethod: z.literal("POST"),
  expected: z.object({
    fileName: FilenameSchema,
    mediaType: MediaTypeSchema,
    sizeBytes: z.number().int().positive(),
  }).strict(),
  expiresAt: TimestampSchema,
}).strict();

export const ImageAssetAccessGrantDtoSchema = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  assetId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  purpose: z.enum([
    ImageAssetAccessPurposes.downloadOriginal,
    ImageAssetAccessPurposes.inlinePreview,
    ImageAssetAccessPurposes.export,
  ]),
  mediaType: MediaTypeSchema,
  sizeBytes: z.number().int().positive(),
  token: z.string().trim().min(1),
  expiresAt: TimestampSchema,
  suggestedFileName: FilenameSchema.optional(),
}).strict();

export const ImageAssetEventDtoSchema = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  eventId: IdentifierSchema,
  kind: z.enum([
    ImageAssetEventKinds.created,
    ImageAssetEventKinds.uploadInitiated,
    ImageAssetEventKinds.uploadCompleted,
    ImageAssetEventKinds.lifecycleStatusChanged,
    ImageAssetEventKinds.metadataUpdated,
    ImageAssetEventKinds.previewRequested,
    ImageAssetEventKinds.accessGranted,
    ImageAssetEventKinds.deleted,
  ]),
  occurredAt: TimestampSchema,
  workspaceId: IdentifierSchema,
  actorUserId: IdentifierSchema.optional(),
  assetId: IdentifierSchema,
  lifecycleStatus: LifecycleSchema.shape.status.optional(),
  uploadSessionId: IdentifierSchema.optional(),
  details: z.record(z.string(), z.unknown()).optional(),
}).strict();

const ListFiltersSchema = z.object({
  ownerUserIds: z.array(IdentifierSchema).min(1).optional(),
  originKinds: z.array(ImageAssetSummaryDtoSchema.shape.originKind).min(1).optional(),
  statuses: z.array(LifecycleSchema.shape.status).min(1).optional(),
  visibilities: z.array(VisibilitySchema).min(1).optional(),
  mediaTypes: z.array(MediaTypeSchema).min(1).optional(),
  storageInstanceIds: z.array(StorageInstanceIdSchema).min(1).optional(),
  search: z.string().trim().min(1).max(512).optional(),
  createdAfter: TimestampSchema.optional(),
  createdBefore: TimestampSchema.optional(),
  updatedAfter: TimestampSchema.optional(),
  updatedBefore: TimestampSchema.optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

export const CreateImageAssetRequestDtoSchema: z.ZodType<CreateImageAssetRequestDto> = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  originKind: ImageAssetSummaryDtoSchema.shape.originKind,
  visibility: VisibilitySchema,
  ownerUserId: IdentifierSchema.optional(),
  storage: StorageSchema,
  mediaType: MediaTypeSchema,
  originalFilename: FilenameSchema,
  normalizedFilename: NormalizedFilenameSchema,
  sizeBytes: z.number().int().positive(),
  fingerprint: FingerprintSchema,
  sharingPolicy: SharingPolicySchema.optional(),
  lineage: LineageSchema.optional(),
}).strict();

export const CreateImageAssetResponseDtoSchema: z.ZodType<CreateImageAssetResponseDto> = z.object({
  asset: ImageAssetDetailDtoSchema,
}).strict();

export const InitiateImageAssetUploadRequestDtoSchema: z.ZodType<InitiateImageAssetUploadRequestDto> = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  assetId: IdentifierSchema,
  fileName: FilenameSchema,
  mediaType: MediaTypeSchema,
  sizeBytes: z.number().int().positive(),
  expectedFingerprint: FingerprintSchema.optional(),
}).strict();

export const InitiateImageAssetUploadResponseDtoSchema: z.ZodType<InitiateImageAssetUploadResponseDto> = z.object({
  asset: ImageAssetDetailDtoSchema,
  upload: ImageAssetUploadSessionDtoSchema,
}).strict();

export const CompleteImageAssetUploadRequestDtoSchema: z.ZodType<CompleteImageAssetUploadRequestDto> = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  assetId: IdentifierSchema,
  uploadSessionId: IdentifierSchema,
  mediaType: MediaTypeSchema.optional(),
  sizeBytes: z.number().int().positive().optional(),
  fingerprint: FingerprintSchema.optional(),
  completedAt: TimestampSchema.optional(),
}).strict();

export const CompleteImageAssetUploadResponseDtoSchema: z.ZodType<CompleteImageAssetUploadResponseDto> = z.object({
  asset: ImageAssetDetailDtoSchema,
  uploadSessionId: IdentifierSchema,
  finalizedAt: TimestampSchema,
}).strict();

export const GetImageAssetMetadataRequestDtoSchema: z.ZodType<GetImageAssetMetadataRequestDto> = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  assetId: IdentifierSchema,
  includeDeleted: z.boolean().optional(),
}).strict();

export const GetImageAssetMetadataResponseDtoSchema: z.ZodType<GetImageAssetMetadataResponseDto> = z.object({
  asset: ImageAssetDetailDtoSchema,
}).strict();

export const ListImageAssetsRequestDtoSchema: z.ZodType<ListImageAssetsRequestDto> = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  filters: ListFiltersSchema.optional(),
}).strict();

const PaginationSchema = z.object({
  limit: z.number().int().min(0),
  offset: z.number().int().min(0),
  returned: z.number().int().min(0),
  hasMore: z.boolean(),
}).strict();

export const ListImageAssetsResponseDtoSchema: z.ZodType<ListImageAssetsResponseDto> = z.object({
  items: z.array(ImageAssetSummaryDtoSchema),
  pagination: PaginationSchema,
}).strict();

export const RequestImageAssetPreviewRequestDtoSchema: z.ZodType<RequestImageAssetPreviewRequestDto> = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  assetId: IdentifierSchema,
  preferredMediaTypes: z.array(MediaTypeSchema).min(1).optional(),
}).strict();

export const RequestImageAssetPreviewResponseDtoSchema: z.ZodType<RequestImageAssetPreviewResponseDto> = z.object({
  assetId: IdentifierSchema,
  preview: PreviewSchema,
}).strict();

export const RequestImageAssetAccessRequestDtoSchema: z.ZodType<RequestImageAssetAccessRequestDto> = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  assetId: IdentifierSchema,
  purpose: ImageAssetAccessGrantDtoSchema.shape.purpose,
  expiresInSeconds: z.number().int().min(1).max(86400).optional(),
  suggestedFileName: FilenameSchema.optional(),
}).strict();

export const RequestImageAssetAccessResponseDtoSchema: z.ZodType<RequestImageAssetAccessResponseDto> = z.object({
  access: ImageAssetAccessGrantDtoSchema,
}).strict();

export const ListImageAssetEventsRequestDtoSchema: z.ZodType<ListImageAssetEventsRequestDto> = z.object({
  contractVersion: z.literal(ImageAssetTransportContractVersions.v1),
  actorUserId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  assetId: IdentifierSchema.optional(),
  kinds: z.array(ImageAssetEventDtoSchema.shape.kind).min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
}).strict();

export const ListImageAssetEventsResponseDtoSchema: z.ZodType<ListImageAssetEventsResponseDto> = z.object({
  items: z.array(ImageAssetEventDtoSchema),
  pagination: PaginationSchema,
}).strict();

export type CreateImageAssetRequestDtoPayload = z.infer<typeof CreateImageAssetRequestDtoSchema>;
export type CreateImageAssetResponseDtoPayload = z.infer<typeof CreateImageAssetResponseDtoSchema>;
export type InitiateImageAssetUploadRequestDtoPayload = z.infer<typeof InitiateImageAssetUploadRequestDtoSchema>;
export type InitiateImageAssetUploadResponseDtoPayload = z.infer<typeof InitiateImageAssetUploadResponseDtoSchema>;
export type CompleteImageAssetUploadRequestDtoPayload = z.infer<typeof CompleteImageAssetUploadRequestDtoSchema>;
export type CompleteImageAssetUploadResponseDtoPayload = z.infer<typeof CompleteImageAssetUploadResponseDtoSchema>;
export type GetImageAssetMetadataRequestDtoPayload = z.infer<typeof GetImageAssetMetadataRequestDtoSchema>;
export type GetImageAssetMetadataResponseDtoPayload = z.infer<typeof GetImageAssetMetadataResponseDtoSchema>;
export type ListImageAssetsRequestDtoPayload = z.infer<typeof ListImageAssetsRequestDtoSchema>;
export type ListImageAssetsResponseDtoPayload = z.infer<typeof ListImageAssetsResponseDtoSchema>;
export type RequestImageAssetPreviewRequestDtoPayload = z.infer<typeof RequestImageAssetPreviewRequestDtoSchema>;
export type RequestImageAssetPreviewResponseDtoPayload = z.infer<typeof RequestImageAssetPreviewResponseDtoSchema>;
export type RequestImageAssetAccessRequestDtoPayload = z.infer<typeof RequestImageAssetAccessRequestDtoSchema>;
export type RequestImageAssetAccessResponseDtoPayload = z.infer<typeof RequestImageAssetAccessResponseDtoSchema>;
export type ListImageAssetEventsRequestDtoPayload = z.infer<typeof ListImageAssetEventsRequestDtoSchema>;
export type ListImageAssetEventsResponseDtoPayload = z.infer<typeof ListImageAssetEventsResponseDtoSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(schemaName: string, error: z.ZodError): ImageAssetTransportSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new ImageAssetTransportSchemaValidationError(schemaName, issues);
}

function parseImageAssetSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseCreateImageAssetRequestDto(payload: unknown): CreateImageAssetRequestDtoPayload {
  return parseImageAssetSchema("CreateImageAssetRequestDto", CreateImageAssetRequestDtoSchema, payload);
}

export function parseCreateImageAssetResponseDto(payload: unknown): CreateImageAssetResponseDtoPayload {
  return parseImageAssetSchema("CreateImageAssetResponseDto", CreateImageAssetResponseDtoSchema, payload);
}

export function parseInitiateImageAssetUploadRequestDto(payload: unknown): InitiateImageAssetUploadRequestDtoPayload {
  return parseImageAssetSchema(
    "InitiateImageAssetUploadRequestDto",
    InitiateImageAssetUploadRequestDtoSchema,
    payload,
  );
}

export function parseInitiateImageAssetUploadResponseDto(
  payload: unknown,
): InitiateImageAssetUploadResponseDtoPayload {
  return parseImageAssetSchema(
    "InitiateImageAssetUploadResponseDto",
    InitiateImageAssetUploadResponseDtoSchema,
    payload,
  );
}

export function parseCompleteImageAssetUploadRequestDto(payload: unknown): CompleteImageAssetUploadRequestDtoPayload {
  return parseImageAssetSchema(
    "CompleteImageAssetUploadRequestDto",
    CompleteImageAssetUploadRequestDtoSchema,
    payload,
  );
}

export function parseCompleteImageAssetUploadResponseDto(
  payload: unknown,
): CompleteImageAssetUploadResponseDtoPayload {
  return parseImageAssetSchema(
    "CompleteImageAssetUploadResponseDto",
    CompleteImageAssetUploadResponseDtoSchema,
    payload,
  );
}

export function parseGetImageAssetMetadataRequestDto(payload: unknown): GetImageAssetMetadataRequestDtoPayload {
  return parseImageAssetSchema(
    "GetImageAssetMetadataRequestDto",
    GetImageAssetMetadataRequestDtoSchema,
    payload,
  );
}

export function parseGetImageAssetMetadataResponseDto(payload: unknown): GetImageAssetMetadataResponseDtoPayload {
  return parseImageAssetSchema(
    "GetImageAssetMetadataResponseDto",
    GetImageAssetMetadataResponseDtoSchema,
    payload,
  );
}

export function parseListImageAssetsRequestDto(payload: unknown): ListImageAssetsRequestDtoPayload {
  return parseImageAssetSchema("ListImageAssetsRequestDto", ListImageAssetsRequestDtoSchema, payload);
}

export function parseListImageAssetsResponseDto(payload: unknown): ListImageAssetsResponseDtoPayload {
  return parseImageAssetSchema("ListImageAssetsResponseDto", ListImageAssetsResponseDtoSchema, payload);
}

export function parseRequestImageAssetPreviewRequestDto(
  payload: unknown,
): RequestImageAssetPreviewRequestDtoPayload {
  return parseImageAssetSchema(
    "RequestImageAssetPreviewRequestDto",
    RequestImageAssetPreviewRequestDtoSchema,
    payload,
  );
}

export function parseRequestImageAssetPreviewResponseDto(
  payload: unknown,
): RequestImageAssetPreviewResponseDtoPayload {
  return parseImageAssetSchema(
    "RequestImageAssetPreviewResponseDto",
    RequestImageAssetPreviewResponseDtoSchema,
    payload,
  );
}

export function parseRequestImageAssetAccessRequestDto(payload: unknown): RequestImageAssetAccessRequestDtoPayload {
  return parseImageAssetSchema(
    "RequestImageAssetAccessRequestDto",
    RequestImageAssetAccessRequestDtoSchema,
    payload,
  );
}

export function parseRequestImageAssetAccessResponseDto(payload: unknown): RequestImageAssetAccessResponseDtoPayload {
  return parseImageAssetSchema(
    "RequestImageAssetAccessResponseDto",
    RequestImageAssetAccessResponseDtoSchema,
    payload,
  );
}

export function parseListImageAssetEventsRequestDto(payload: unknown): ListImageAssetEventsRequestDtoPayload {
  return parseImageAssetSchema(
    "ListImageAssetEventsRequestDto",
    ListImageAssetEventsRequestDtoSchema,
    payload,
  );
}

export function parseListImageAssetEventsResponseDto(payload: unknown): ListImageAssetEventsResponseDtoPayload {
  return parseImageAssetSchema(
    "ListImageAssetEventsResponseDto",
    ListImageAssetEventsResponseDtoSchema,
    payload,
  );
}
