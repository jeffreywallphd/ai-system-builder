import { z } from "zod";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { DatasetPipelineStageKinds } from "../../domain/dataset-studio/StagePipelineDomain";
import {
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionRouteHandlerKinds,
  UnifiedIngestionSourceKinds,
  type UnifiedIngestionExecutionMetadata,
  type UnifiedIngestionLineageRecord,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import type { UnifiedIngestionResult } from "./UnifiedIngestionOrchestrationService";

export const StageExecutionStatusKinds = Object.freeze({
  completed: "completed",
  failed: "failed",
  partial: "partial",
} as const);

export type StageExecutionStatusKind = typeof StageExecutionStatusKinds[keyof typeof StageExecutionStatusKinds];

const StageExecutionStatusSchema = z.nativeEnum(StageExecutionStatusKinds);

const UnifiedIngestionStageOutputSchema = z.object({
  stageKind: z.literal(DatasetPipelineStageKinds.ingestion),
  status: StageExecutionStatusSchema,
  detectedSourceKind: z.nativeEnum(UnifiedIngestionSourceKinds),
  outputTarget: z.nativeEnum(UnifiedIngestionOutputTargetKinds),
  canonicalOutputKind: z.string().trim().min(1),
  handlerKind: z.nativeEnum(UnifiedIngestionRouteHandlerKinds).optional(),
  fallbackUsed: z.boolean(),
  schemaKnown: z.boolean().optional(),
  profileComputed: z.boolean().optional(),
  sourceId: z.string().trim().min(1).optional(),
  sourceReference: z.string().trim().min(1).optional(),
  metadata: z.object({
    pipelineId: z.string().trim().min(1).optional(),
    orderedStageIds: z.array(z.string().trim().min(1)).optional(),
    lineageId: z.string().trim().min(1).optional(),
    warningCount: z.number().int().nonnegative().optional(),
    errorCount: z.number().int().nonnegative().optional(),
  }).optional(),
});

export type UnifiedIngestionStageOutput = z.output<typeof UnifiedIngestionStageOutputSchema>;

const RawStorageSourceSchema = z.object({
  sourceId: z.string().trim().min(1).optional(),
  sourceReference: z.string().trim().min(1).optional(),
  referenceKind: z.string().trim().min(1).optional(),
  sourceAssetId: z.string().trim().min(1).optional(),
  sourceVersionId: z.string().trim().min(1).optional(),
});

const RawStoragePersistenceSchema = z.object({
  storageReference: z.string().trim().min(1).optional(),
  persistedAt: z.string().trim().min(1),
  persistedContentType: z.string().trim().min(1).optional(),
  contentDigest: z.string().trim().min(1).optional(),
  byteLength: z.number().int().nonnegative().optional(),
});

const RawStorageTraceabilitySchema = z.object({
  lineageId: z.string().trim().min(1).optional(),
  pipelineId: z.string().trim().min(1).optional(),
  upstreamStageId: z.string().trim().min(1).optional(),
  notes: z.array(z.string().trim().min(1)).optional(),
});

const RawStorageStageOutputSchema = z.object({
  stageKind: z.literal(DatasetPipelineStageKinds.rawStorage),
  status: StageExecutionStatusSchema,
  source: RawStorageSourceSchema,
  persistence: RawStoragePersistenceSchema,
  traceability: RawStorageTraceabilitySchema,
});

export type RawStorageStageOutput = z.output<typeof RawStorageStageOutputSchema>;

const PreparedStorageDatasetSchema = z.object({
  preparedAssetId: z.string().trim().min(1),
  preparedAssetVersionId: z.string().trim().min(1),
  outputShapeKind: z.string().trim().min(1),
  recordCount: z.number().int().nonnegative().optional(),
  byteLength: z.number().int().nonnegative().optional(),
});

const PreparedStoragePersistenceSchema = z.object({
  targetId: z.string().trim().min(1),
  storageReference: z.string().trim().min(1),
  persistedAt: z.string().trim().min(1),
  contentDigest: z.string().trim().min(1).optional(),
});

const PreparedStorageLineageSchema = z.object({
  lineageId: z.string().trim().min(1),
  pipelineAssetId: z.string().trim().min(1),
  pipelineVersionId: z.string().trim().min(1).optional(),
  upstreamAssetIds: z.array(z.string().trim().min(1)).default([]),
  upstreamPipelineAssetIds: z.array(z.string().trim().min(1)).default([]),
});

const PreparedStorageStageOutputSchema = z.object({
  stageKind: z.literal(DatasetPipelineStageKinds.preparedStorage),
  status: StageExecutionStatusSchema,
  dataset: PreparedStorageDatasetSchema,
  persistence: PreparedStoragePersistenceSchema,
  lineage: PreparedStorageLineageSchema,
});

export type PreparedStorageStageOutput = z.output<typeof PreparedStorageStageOutputSchema>;

function toBoolean(value: CanonicalRecordValue | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return undefined;
}

function toString(value: CanonicalRecordValue | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function withoutUndefined(
  value: Readonly<Record<string, CanonicalRecordValue | undefined>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  const normalized = Object.entries(value)
    .filter((entry): entry is [string, CanonicalRecordValue] => entry[1] !== undefined);
  return Object.freeze(Object.fromEntries(normalized));
}

function deriveStatus(result: UnifiedIngestionResult): StageExecutionStatusKind {
  if (!result.ok) {
    return StageExecutionStatusKinds.failed;
  }
  if (result.issues.some((issue) => issue.severity === "error")) {
    return StageExecutionStatusKinds.partial;
  }
  return StageExecutionStatusKinds.completed;
}

function toUnifiedIngestionStageOutputMetadata(
  metadata: UnifiedIngestionExecutionMetadata,
  lineage: UnifiedIngestionLineageRecord,
): UnifiedIngestionStageOutput["metadata"] {
  return Object.freeze({
    pipelineId: metadata.processing.pipelineId,
    orderedStageIds: metadata.processing.orderedStageIds,
    lineageId: lineage.lineageId,
    warningCount: metadata.processing.warningCount,
    errorCount: metadata.processing.errorCount,
  });
}

function inferSchemaKnown(result: UnifiedIngestionResult): boolean {
  if (!result.ok) {
    return false;
  }
  return result.normalized.canonicalOutputKind === "records";
}

export function createUnifiedIngestionStageOutputFromResult(
  result: UnifiedIngestionResult,
): UnifiedIngestionStageOutput {
  const output = UnifiedIngestionStageOutputSchema.parse({
    stageKind: DatasetPipelineStageKinds.ingestion,
    status: deriveStatus(result),
    detectedSourceKind: result.detection?.detectedKind ?? UnifiedIngestionSourceKinds.unknown,
    outputTarget: result.metadata.processing.outputTarget,
    canonicalOutputKind: result.ok
      ? result.normalized.canonicalOutputKind
      : result.metadata.normalization?.canonicalOutputKind ?? "records",
    handlerKind: result.route?.status === "resolved" ? result.route.handlerKind : undefined,
    fallbackUsed: result.route?.fallbackUsed ?? false,
    schemaKnown: inferSchemaKnown(result),
    profileComputed: false,
    sourceId: result.source.sourceId,
    sourceReference: result.source.reference,
    metadata: toUnifiedIngestionStageOutputMetadata(result.metadata, result.lineage),
  });
  return Object.freeze(output);
}

export function toStageRecordFromUnifiedIngestionOutput(
  output: UnifiedIngestionStageOutput,
): Readonly<Record<string, CanonicalRecordValue>> {
  return withoutUndefined({
    status: output.status,
    completed: output.status === StageExecutionStatusKinds.completed,
    detectedSourceKind: output.detectedSourceKind,
    sourceKind: output.detectedSourceKind,
    outputTarget: output.outputTarget,
    canonicalOutputKind: output.canonicalOutputKind,
    handlerKind: output.handlerKind,
    fallbackUsed: output.fallbackUsed,
    schemaKnown: output.schemaKnown ?? false,
    profileComputed: output.profileComputed ?? false,
    sourceId: output.sourceId,
    sourceReference: output.sourceReference,
    pipelineId: output.metadata?.pipelineId,
    orderedStageIds: output.metadata?.orderedStageIds as CanonicalRecordValue | undefined,
    lineageId: output.metadata?.lineageId,
    warningCount: output.metadata?.warningCount,
    errorCount: output.metadata?.errorCount,
    unifiedIngestion: output as unknown as CanonicalRecordValue,
  });
}

function fromLegacyUnifiedIngestionStageOutput(
  value: Readonly<Record<string, CanonicalRecordValue>>,
): UnifiedIngestionStageOutput | undefined {
  const detectedSourceKind = toString(value.detectedSourceKind) ?? toString(value.sourceKind);
  if (!detectedSourceKind) {
    return undefined;
  }

  return UnifiedIngestionStageOutputSchema.parse({
    stageKind: DatasetPipelineStageKinds.ingestion,
    status: toBoolean(value.completed)
      ? StageExecutionStatusKinds.completed
      : (toString(value.status) ?? StageExecutionStatusKinds.partial),
    detectedSourceKind,
    outputTarget: toString(value.outputTarget) ?? UnifiedIngestionOutputTargetKinds.records,
    canonicalOutputKind: toString(value.canonicalOutputKind) ?? "records",
    handlerKind: toString(value.handlerKind),
    fallbackUsed: toBoolean(value.fallbackUsed) ?? false,
    schemaKnown: toBoolean(value.schemaKnown),
    profileComputed: toBoolean(value.profileComputed),
    sourceId: toString(value.sourceId),
    sourceReference: toString(value.sourceReference),
    metadata: {
      pipelineId: toString(value.pipelineId),
      orderedStageIds: Array.isArray(value.orderedStageIds)
        ? value.orderedStageIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : undefined,
      lineageId: toString(value.lineageId),
      warningCount: typeof value.warningCount === "number" ? value.warningCount : undefined,
      errorCount: typeof value.errorCount === "number" ? value.errorCount : undefined,
    },
  });
}

export function readUnifiedIngestionStageOutput(
  value?: Readonly<Record<string, CanonicalRecordValue>>,
): UnifiedIngestionStageOutput | undefined {
  if (!value) {
    return undefined;
  }

  const embedded = value.unifiedIngestion;
  if (embedded && typeof embedded === "object" && !Array.isArray(embedded)) {
    const parsed = UnifiedIngestionStageOutputSchema.safeParse(embedded);
    if (parsed.success) {
      return Object.freeze(parsed.data);
    }
  }

  return fromLegacyUnifiedIngestionStageOutput(value);
}

export function createRawStorageStageOutput(input: {
  readonly status?: StageExecutionStatusKind;
  readonly source: {
    readonly sourceId?: string;
    readonly sourceReference?: string;
    readonly referenceKind?: string;
    readonly sourceAssetId?: string;
    readonly sourceVersionId?: string;
  };
  readonly persistence: {
    readonly storageReference?: string;
    readonly persistedAt: string;
    readonly persistedContentType?: string;
    readonly contentDigest?: string;
    readonly byteLength?: number;
  };
  readonly traceability?: {
    readonly lineageId?: string;
    readonly pipelineId?: string;
    readonly upstreamStageId?: string;
    readonly notes?: ReadonlyArray<string>;
  };
}): RawStorageStageOutput {
  const output = RawStorageStageOutputSchema.parse({
    stageKind: DatasetPipelineStageKinds.rawStorage,
    status: input.status ?? StageExecutionStatusKinds.completed,
    source: input.source,
    persistence: input.persistence,
    traceability: input.traceability ?? {},
  });
  return Object.freeze(output);
}

export function toStageRecordFromRawStorageOutput(
  output: RawStorageStageOutput,
): Readonly<Record<string, CanonicalRecordValue>> {
  return withoutUndefined({
    status: output.status,
    completed: output.status === StageExecutionStatusKinds.completed,
    sourceId: output.source.sourceId,
    sourceReference: output.source.sourceReference,
    sourceAssetId: output.source.sourceAssetId,
    sourceVersionId: output.source.sourceVersionId,
    storageReference: output.persistence.storageReference,
    persistedAt: output.persistence.persistedAt,
    persistedContentType: output.persistence.persistedContentType,
    contentDigest: output.persistence.contentDigest,
    byteLength: output.persistence.byteLength,
    lineageId: output.traceability.lineageId,
    pipelineId: output.traceability.pipelineId,
    rawStorage: output as unknown as CanonicalRecordValue,
  });
}

function fromLegacyRawStorageStageOutput(
  value: Readonly<Record<string, CanonicalRecordValue>>,
): RawStorageStageOutput | undefined {
  const persistedAt = toString(value.persistedAt);
  const sourceReference = toString(value.sourceReference);
  const storageReference = toString(value.storageReference);
  if (!persistedAt && !sourceReference && !storageReference) {
    return undefined;
  }

  return RawStorageStageOutputSchema.parse({
    stageKind: DatasetPipelineStageKinds.rawStorage,
    status: toBoolean(value.completed)
      ? StageExecutionStatusKinds.completed
      : (toString(value.status) ?? StageExecutionStatusKinds.partial),
    source: {
      sourceId: toString(value.sourceId),
      sourceReference,
      referenceKind: toString(value.referenceKind),
      sourceAssetId: toString(value.sourceAssetId),
      sourceVersionId: toString(value.sourceVersionId),
    },
    persistence: {
      storageReference,
      persistedAt: persistedAt ?? new Date().toISOString(),
      persistedContentType: toString(value.persistedContentType),
      contentDigest: toString(value.contentDigest),
      byteLength: typeof value.byteLength === "number" ? value.byteLength : undefined,
    },
    traceability: {
      lineageId: toString(value.lineageId),
      pipelineId: toString(value.pipelineId),
      upstreamStageId: toString(value.upstreamStageId),
    },
  });
}

export function readRawStorageStageOutput(
  value?: Readonly<Record<string, CanonicalRecordValue>>,
): RawStorageStageOutput | undefined {
  if (!value) {
    return undefined;
  }

  const embedded = value.rawStorage;
  if (embedded && typeof embedded === "object" && !Array.isArray(embedded)) {
    const parsed = RawStorageStageOutputSchema.safeParse(embedded);
    if (parsed.success) {
      return Object.freeze(parsed.data);
    }
  }

  return fromLegacyRawStorageStageOutput(value);
}

export function createPreparedStorageStageOutput(input: {
  readonly status?: StageExecutionStatusKind;
  readonly dataset: {
    readonly preparedAssetId: string;
    readonly preparedAssetVersionId: string;
    readonly outputShapeKind: string;
    readonly recordCount?: number;
    readonly byteLength?: number;
  };
  readonly persistence: {
    readonly targetId: string;
    readonly storageReference: string;
    readonly persistedAt: string;
    readonly contentDigest?: string;
  };
  readonly lineage: {
    readonly lineageId: string;
    readonly pipelineAssetId: string;
    readonly pipelineVersionId?: string;
    readonly upstreamAssetIds?: ReadonlyArray<string>;
    readonly upstreamPipelineAssetIds?: ReadonlyArray<string>;
  };
}): PreparedStorageStageOutput {
  const output = PreparedStorageStageOutputSchema.parse({
    stageKind: DatasetPipelineStageKinds.preparedStorage,
    status: input.status ?? StageExecutionStatusKinds.completed,
    dataset: input.dataset,
    persistence: input.persistence,
    lineage: input.lineage,
  });
  return Object.freeze(output);
}

export function toStageRecordFromPreparedStorageOutput(
  output: PreparedStorageStageOutput,
): Readonly<Record<string, CanonicalRecordValue>> {
  return withoutUndefined({
    status: output.status,
    completed: output.status === StageExecutionStatusKinds.completed,
    preparedAssetId: output.dataset.preparedAssetId,
    preparedAssetVersionId: output.dataset.preparedAssetVersionId,
    outputShapeKind: output.dataset.outputShapeKind,
    preparedRecordCount: output.dataset.recordCount,
    preparedByteLength: output.dataset.byteLength,
    storageTargetId: output.persistence.targetId,
    storageReference: output.persistence.storageReference,
    persistedAt: output.persistence.persistedAt,
    contentDigest: output.persistence.contentDigest,
    lineageId: output.lineage.lineageId,
    pipelineAssetId: output.lineage.pipelineAssetId,
    pipelineVersionId: output.lineage.pipelineVersionId,
    upstreamAssetIds: output.lineage.upstreamAssetIds as CanonicalRecordValue,
    upstreamPipelineAssetIds: output.lineage.upstreamPipelineAssetIds as CanonicalRecordValue,
    preparedStorage: output as unknown as CanonicalRecordValue,
  });
}

function fromLegacyPreparedStorageStageOutput(
  value: Readonly<Record<string, CanonicalRecordValue>>,
): PreparedStorageStageOutput | undefined {
  const preparedAssetId = toString(value.preparedAssetId);
  const preparedAssetVersionId = toString(value.preparedAssetVersionId);
  const storageReference = toString(value.storageReference);
  const targetId = toString(value.storageTargetId);
  const persistedAt = toString(value.persistedAt);
  const lineageId = toString(value.lineageId);
  const pipelineAssetId = toString(value.pipelineAssetId);
  if (!preparedAssetId || !preparedAssetVersionId || !storageReference || !targetId || !persistedAt || !lineageId || !pipelineAssetId) {
    return undefined;
  }

  const upstreamAssetIds = Array.isArray(value.upstreamAssetIds)
    ? value.upstreamAssetIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const upstreamPipelineAssetIds = Array.isArray(value.upstreamPipelineAssetIds)
    ? value.upstreamPipelineAssetIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

  return PreparedStorageStageOutputSchema.parse({
    stageKind: DatasetPipelineStageKinds.preparedStorage,
    status: toBoolean(value.completed)
      ? StageExecutionStatusKinds.completed
      : (toString(value.status) ?? StageExecutionStatusKinds.partial),
    dataset: {
      preparedAssetId,
      preparedAssetVersionId,
      outputShapeKind: toString(value.outputShapeKind) ?? "records",
      recordCount: typeof value.preparedRecordCount === "number" ? value.preparedRecordCount : undefined,
      byteLength: typeof value.preparedByteLength === "number" ? value.preparedByteLength : undefined,
    },
    persistence: {
      targetId,
      storageReference,
      persistedAt,
      contentDigest: toString(value.contentDigest),
    },
    lineage: {
      lineageId,
      pipelineAssetId,
      pipelineVersionId: toString(value.pipelineVersionId),
      upstreamAssetIds,
      upstreamPipelineAssetIds,
    },
  });
}

export function readPreparedStorageStageOutput(
  value?: Readonly<Record<string, CanonicalRecordValue>>,
): PreparedStorageStageOutput | undefined {
  if (!value) {
    return undefined;
  }

  const embedded = value.preparedStorage;
  if (embedded && typeof embedded === "object" && !Array.isArray(embedded)) {
    const parsed = PreparedStorageStageOutputSchema.safeParse(embedded);
    if (parsed.success) {
      return Object.freeze(parsed.data);
    }
  }

  return fromLegacyPreparedStorageStageOutput(value);
}
