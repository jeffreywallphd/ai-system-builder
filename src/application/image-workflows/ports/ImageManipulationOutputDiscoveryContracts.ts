import { z } from "zod";
import {
  ImageManipulationExecutionFailureCategories,
} from "./ImageManipulationExecutionStatusContracts";
import {
  ImageManipulationFailureNormalizationSources,
  normalizeImageManipulationExecutionFailure,
} from "./ImageManipulationFailureNormalization";

export const ImageManipulationOutputDiscoveryContractsSchemaVersion = "1.0.0" as const;

export const ImageManipulationOutputMediaKinds = Object.freeze({
  image: "image",
  video: "video",
  document: "document",
  binary: "binary",
});

export type ImageManipulationOutputMediaKind =
  typeof ImageManipulationOutputMediaKinds[keyof typeof ImageManipulationOutputMediaKinds];

export const ImageManipulationOutputRoles = Object.freeze({
  primary: "primary",
  variant: "variant",
  intermediate: "intermediate",
  preview: "preview",
});

export type ImageManipulationOutputRole =
  typeof ImageManipulationOutputRoles[keyof typeof ImageManipulationOutputRoles];

export const ImageManipulationOutputSlotMatchStatuses = Object.freeze({
  matched: "matched",
  fallback: "fallback",
  unmatched: "unmatched",
});

export type ImageManipulationOutputSlotMatchStatus =
  typeof ImageManipulationOutputSlotMatchStatuses[keyof typeof ImageManipulationOutputSlotMatchStatuses];

export const ImageManipulationTemporaryBackendReferenceKinds = Object.freeze({
  backendOutputToken: "backend-output-token",
  backendObjectHandle: "backend-object-handle",
  backendUri: "backend-uri",
  inlinePayloadHandle: "inline-payload-handle",
});

export type ImageManipulationTemporaryBackendReferenceKind =
  typeof ImageManipulationTemporaryBackendReferenceKinds[keyof typeof ImageManipulationTemporaryBackendReferenceKinds];

export const ImageManipulationCollectedExecutionStatuses = Object.freeze({
  collected: "collected",
  partiallyCollected: "partially-collected",
  failed: "failed",
});

export type ImageManipulationCollectedExecutionStatus =
  typeof ImageManipulationCollectedExecutionStatuses[keyof typeof ImageManipulationCollectedExecutionStatuses];

export const ImageManipulationOutputPersistenceStatuses = Object.freeze({
  notPersisted: "not-persisted",
  persisted: "persisted",
  failed: "failed",
});

export type ImageManipulationOutputPersistenceStatus =
  typeof ImageManipulationOutputPersistenceStatuses[keyof typeof ImageManipulationOutputPersistenceStatuses];

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

const outputCollectionFailureSchema = z.object({
  code: z.string().trim().min(1),
  category: z.nativeEnum(ImageManipulationExecutionFailureCategories),
  summary: z.string().trim().min(1),
  userMessage: z.string().trim().min(1).optional(),
  retryable: z.boolean(),
  failedAt: z.string().trim().min(1),
  stageCode: z.string().trim().min(1).optional(),
  partialProgressObserved: z.boolean(),
  partialOutputCount: z.number().int().nonnegative(),
  diagnostics: z.record(z.string(), jsonValueSchema).optional(),
}).strict();

export type ImageManipulationOutputCollectionFailure = z.infer<typeof outputCollectionFailureSchema>;

function looksLikeFilesystemPath(value: string): boolean {
  return value.startsWith("/")
    || value.startsWith("./")
    || value.startsWith("../")
    || /^[A-Za-z]:[\\/]/.test(value)
    || value.includes("\\");
}

function looksLikeLocalFileUri(value: string): boolean {
  return /^file:(\/\/)?/i.test(value);
}

const logicalReferenceSchema = z.string().trim().min(1).refine(
  (value) => !looksLikeFilesystemPath(value),
  "Logical reference values cannot be raw filesystem paths.",
);

const safeBackendHandleSchema = z.string().trim().min(1).refine(
  (value) => !looksLikeFilesystemPath(value),
  "Temporary backend references cannot contain raw filesystem paths.",
);

const safeBackendUriSchema = z.string().trim().min(1).refine(
  (value) => !looksLikeFilesystemPath(value) && !looksLikeLocalFileUri(value),
  "Temporary backend URIs cannot contain local filesystem paths.",
);

const contractMetadataSchema = z.record(z.string(), jsonValueSchema);

const temporaryBackendReferenceSchema = z.object({
  kind: z.nativeEnum(ImageManipulationTemporaryBackendReferenceKinds),
  backendFamily: z.string().trim().min(1),
  backendExecutionId: z.string().trim().min(1).optional(),
  backendOutputId: z.string().trim().min(1).optional(),
  referenceToken: safeBackendHandleSchema.optional(),
  objectHandle: safeBackendHandleSchema.optional(),
  uri: safeBackendUriSchema.optional(),
  expiresAt: z.string().trim().min(1).optional(),
  metadata: contractMetadataSchema.optional(),
}).strict().superRefine((value, context) => {
  const hasReference = Boolean(value.referenceToken || value.objectHandle || value.uri);
  if (!hasReference) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["referenceToken"],
      message: "Temporary backend references must include referenceToken, objectHandle, or uri.",
    });
  }
});

export type ImageManipulationTemporaryBackendReference = z.infer<typeof temporaryBackendReferenceSchema>;

const outputSlotMatchSchema = z.object({
  status: z.nativeEnum(ImageManipulationOutputSlotMatchStatuses),
  outputId: z.string().trim().min(1).optional(),
  expectedBackendField: z.string().trim().min(1).optional(),
  logicalTargetReference: logicalReferenceSchema.optional(),
  metadata: contractMetadataSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.status !== ImageManipulationOutputSlotMatchStatuses.unmatched && !value.outputId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["outputId"],
      message: "Matched/fallback slot matches must include outputId.",
    });
  }
});

export type ImageManipulationOutputSlotMatch = z.infer<typeof outputSlotMatchSchema>;

const outputMediaMetadataSchema = z.object({
  mediaKind: z.nativeEnum(ImageManipulationOutputMediaKinds),
  mimeType: z.string().trim().min(1),
  extension: z.string().trim().min(1).optional(),
  byteSize: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  channels: z.number().int().positive().optional(),
  colorSpace: z.string().trim().min(1).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  frameCount: z.number().int().positive().optional(),
  hashSha256: z.string().trim().min(1).optional(),
  metadata: contractMetadataSchema.optional(),
}).strict();

export type ImageManipulationOutputMediaMetadata = z.infer<typeof outputMediaMetadataSchema>;

const discoveredOutputDescriptorSchema = z.object({
  descriptorId: z.string().trim().min(1),
  discoveredAt: z.string().trim().min(1),
  outputRole: z.nativeEnum(ImageManipulationOutputRoles),
  outputIndex: z.number().int().nonnegative().default(0),
  outputGroupId: z.string().trim().min(1).optional(),
  slotMatch: outputSlotMatchSchema.optional(),
  media: outputMediaMetadataSchema,
  temporaryReference: temporaryBackendReferenceSchema,
  sourceInputAssetReference: logicalReferenceSchema.optional(),
  metadata: contractMetadataSchema.optional(),
}).strict();

export type ImageManipulationDiscoveredOutputDescriptor = z.infer<typeof discoveredOutputDescriptorSchema>;

const outputDiscoverySummarySchema = z.object({
  discoveredCount: z.number().int().nonnegative(),
  matchedSlotCount: z.number().int().nonnegative(),
  unmatchedSlotCount: z.number().int().nonnegative(),
}).strict();

const outputDiscoverySnapshotSchema = z.object({
  schemaVersion: z.literal(ImageManipulationOutputDiscoveryContractsSchemaVersion)
    .default(ImageManipulationOutputDiscoveryContractsSchemaVersion),
  discoveryId: z.string().trim().min(1),
  executionJobId: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  backendFamily: z.string().trim().min(1),
  discoveredAt: z.string().trim().min(1),
  outputs: z.array(discoveredOutputDescriptorSchema).default([]),
  summary: outputDiscoverySummarySchema,
  metadata: contractMetadataSchema.optional(),
}).strict();

export type ImageManipulationOutputDiscoverySnapshot = z.infer<typeof outputDiscoverySnapshotSchema>;

const logicalAssetRecordSchema = z.object({
  assetId: z.string().trim().min(1),
  logicalAssetReference: logicalReferenceSchema,
  lineageRecordId: z.string().trim().min(1).optional(),
  persistedAt: z.string().trim().min(1),
  previewAssetReference: logicalReferenceSchema.optional(),
  metadata: contractMetadataSchema.optional(),
}).strict();

export type ImageManipulationCollectedLogicalAssetRecord = z.infer<typeof logicalAssetRecordSchema>;

const outputPersistenceResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal(ImageManipulationOutputPersistenceStatuses.notPersisted),
    reason: z.string().trim().min(1).optional(),
  }).strict(),
  z.object({
    status: z.literal(ImageManipulationOutputPersistenceStatuses.persisted),
    logicalAsset: logicalAssetRecordSchema,
  }).strict(),
  z.object({
    status: z.literal(ImageManipulationOutputPersistenceStatuses.failed),
    errorCode: z.string().trim().min(1),
    message: z.string().trim().min(1),
    retryable: z.boolean(),
  }).strict(),
]);

export type ImageManipulationOutputPersistenceResult = z.infer<typeof outputPersistenceResultSchema>;

const collectedOutputRecordSchema = z.object({
  descriptorId: z.string().trim().min(1),
  temporaryReference: temporaryBackendReferenceSchema,
  persistence: outputPersistenceResultSchema,
  previewCandidate: z.boolean().default(false),
  lineageMetadata: contractMetadataSchema.optional(),
  metadata: contractMetadataSchema.optional(),
}).strict();

export type ImageManipulationCollectedOutputRecord = z.infer<typeof collectedOutputRecordSchema>;

const collectedExecutionSummarySchema = z.object({
  discoveredCount: z.number().int().nonnegative(),
  collectedCount: z.number().int().nonnegative(),
  persistedCount: z.number().int().nonnegative(),
  notPersistedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
}).strict();

const collectedExecutionResultSchema = z.object({
  schemaVersion: z.literal(ImageManipulationOutputDiscoveryContractsSchemaVersion)
    .default(ImageManipulationOutputDiscoveryContractsSchemaVersion),
  collectionId: z.string().trim().min(1),
  discoveryId: z.string().trim().min(1),
  executionJobId: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  collectedAt: z.string().trim().min(1),
  status: z.nativeEnum(ImageManipulationCollectedExecutionStatuses),
  collectionFailure: outputCollectionFailureSchema.optional(),
  discoveredOutputs: z.array(discoveredOutputDescriptorSchema).default([]),
  records: z.array(collectedOutputRecordSchema).default([]),
  summary: collectedExecutionSummarySchema,
  metadata: contractMetadataSchema.optional(),
}).strict();

export type ImageManipulationCollectedExecutionResult = z.infer<typeof collectedExecutionResultSchema>;

function deepFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const candidate = (value as Record<string, unknown>)[key];
    if (candidate && typeof candidate === "object") {
      deepFreeze(candidate);
    }
  }
  return value;
}

function assertUnique(values: ReadonlyArray<string>, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`${label} '${value}' must be unique.`);
    }
    seen.add(value);
  }
}

function assertDiscoveryIntegrity(snapshot: ImageManipulationOutputDiscoverySnapshot): void {
  assertUnique(snapshot.outputs.map((entry) => entry.descriptorId), "Discovered output descriptorId");

  const matchedCount = snapshot.outputs.filter((entry) => entry.slotMatch?.status !== "unmatched").length;
  const unmatchedCount = snapshot.outputs.length - matchedCount;
  if (snapshot.summary.discoveredCount !== snapshot.outputs.length) {
    throw new Error("Output discovery summary.discoveredCount must equal outputs.length.");
  }
  if (snapshot.summary.matchedSlotCount !== matchedCount) {
    throw new Error("Output discovery summary.matchedSlotCount must equal matched slot count.");
  }
  if (snapshot.summary.unmatchedSlotCount !== unmatchedCount) {
    throw new Error("Output discovery summary.unmatchedSlotCount must equal unmatched slot count.");
  }
}

function assertCollectionIntegrity(result: ImageManipulationCollectedExecutionResult): void {
  assertUnique(result.discoveredOutputs.map((entry) => entry.descriptorId), "Collected result discovered descriptorId");
  assertUnique(result.records.map((entry) => entry.descriptorId), "Collected result record descriptorId");

  const discoveredIds = new Set(result.discoveredOutputs.map((entry) => entry.descriptorId));
  for (const record of result.records) {
    if (!discoveredIds.has(record.descriptorId)) {
      throw new Error(`Collected output record '${record.descriptorId}' has no matching discovered output descriptor.`);
    }
  }

  const persistedCount = result.records.filter((entry) => entry.persistence.status === "persisted").length;
  const notPersistedCount = result.records.filter((entry) => entry.persistence.status === "not-persisted").length;
  const failedCount = result.records.filter((entry) => entry.persistence.status === "failed").length;

  if (result.summary.discoveredCount !== result.discoveredOutputs.length) {
    throw new Error("Collection summary.discoveredCount must equal discoveredOutputs.length.");
  }
  if (result.summary.collectedCount !== result.records.length) {
    throw new Error("Collection summary.collectedCount must equal records.length.");
  }
  if (result.summary.persistedCount !== persistedCount) {
    throw new Error("Collection summary.persistedCount must equal persisted record count.");
  }
  if (result.summary.notPersistedCount !== notPersistedCount) {
    throw new Error("Collection summary.notPersistedCount must equal not-persisted record count.");
  }
  if (result.summary.failedCount !== failedCount) {
    throw new Error("Collection summary.failedCount must equal failed record count.");
  }

  if (result.status === ImageManipulationCollectedExecutionStatuses.collected && result.collectionFailure) {
    throw new Error("Collected execution result cannot include collectionFailure when status is collected.");
  }
  if (result.status === ImageManipulationCollectedExecutionStatuses.partiallyCollected && !result.collectionFailure) {
    throw new Error("Partially collected execution result requires collectionFailure.");
  }
  if (result.status === ImageManipulationCollectedExecutionStatuses.failed && !result.collectionFailure) {
    throw new Error("Failed collected execution result requires collectionFailure.");
  }
  if (
    result.collectionFailure
    && result.collectionFailure.partialOutputCount > result.summary.discoveredCount
  ) {
    throw new Error("collectionFailure.partialOutputCount cannot exceed discovered output count.");
  }
}

export function validateImageManipulationOutputDiscoverySnapshot(input: unknown): ImageManipulationOutputDiscoverySnapshot {
  const parsed = outputDiscoverySnapshotSchema.parse(input);
  assertDiscoveryIntegrity(parsed);
  return deepFreeze(parsed);
}

export function validateImageManipulationCollectedExecutionResult(input: unknown): ImageManipulationCollectedExecutionResult {
  const parsed = collectedExecutionResultSchema.parse(input);
  assertCollectionIntegrity(parsed);
  return deepFreeze(parsed);
}

export function parseImageManipulationOutputDiscoverySnapshot(input: unknown): ImageManipulationOutputDiscoverySnapshot | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const schemaVersion = (input as { readonly schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== undefined && schemaVersion !== ImageManipulationOutputDiscoveryContractsSchemaVersion) {
    throw new Error(`unsupported-image-manipulation-output-discovery-schema-version:${String(schemaVersion)}`);
  }
  return validateImageManipulationOutputDiscoverySnapshot(input);
}

export function parseImageManipulationCollectedExecutionResult(input: unknown): ImageManipulationCollectedExecutionResult | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const schemaVersion = (input as { readonly schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== undefined && schemaVersion !== ImageManipulationOutputDiscoveryContractsSchemaVersion) {
    throw new Error(`unsupported-image-manipulation-collected-result-schema-version:${String(schemaVersion)}`);
  }
  return validateImageManipulationCollectedExecutionResult(input);
}

export function createImageManipulationOutputCollectionFailure(input: {
  readonly failedAt: string;
  readonly backendStatusCode?: string;
  readonly backendErrorCode?: string;
  readonly rawMessage?: string;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  readonly stageCode?: string;
  readonly partialProgressObserved?: boolean;
  readonly partialOutputCount?: number;
}): ImageManipulationOutputCollectionFailure {
  const normalized = normalizeImageManipulationExecutionFailure({
    source: ImageManipulationFailureNormalizationSources.outputCollection,
    failedAt: input.failedAt,
    backendStatusCode: input.backendStatusCode,
    backendErrorCode: input.backendErrorCode,
    rawMessage: input.rawMessage,
    diagnostics: input.diagnostics,
    stageCode: input.stageCode ?? "output-collection",
    state: "failed",
    partialProgressObserved: input.partialProgressObserved,
    partialOutputCount: input.partialOutputCount,
  });
  return Object.freeze({
    code: normalized.code,
    category: normalized.category,
    summary: normalized.summary,
    userMessage: normalized.userMessage,
    retryable: normalized.retryable,
    failedAt: normalized.failedAt,
    stageCode: normalized.stageCode,
    partialProgressObserved: normalized.partialProgressObserved,
    partialOutputCount: normalized.partialOutputCount,
    diagnostics: normalized.diagnostics,
  });
}
