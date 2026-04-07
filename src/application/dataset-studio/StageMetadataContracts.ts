import { z } from "zod";
import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import type { DatasetPipelineStageDefinition } from "@domain/dataset-studio/StagePipelineDomain";
import {
  readRawStorageStageOutput,
  readUnifiedIngestionStageOutput,
  type RawStorageStageOutput,
  type UnifiedIngestionStageOutput,
} from "./StageIntegrationContracts";

export const StageStatusMarkerKinds = Object.freeze({
  pending: "pending",
  current: "current",
  completed: "completed",
  skipped: "skipped",
  disabled: "disabled",
  blocked: "blocked",
} as const);

export type StageStatusMarkerKind = typeof StageStatusMarkerKinds[keyof typeof StageStatusMarkerKinds];

export const StageContractKinds = Object.freeze({
  simple: "simple",
  compositeMapped: "composite-mapped",
} as const);

export type StageContractKind = typeof StageContractKinds[keyof typeof StageContractKinds];

export const StageMetadataSchema = z.object({
  stageId: z.string().trim().min(1),
  stageKind: z.string().trim().min(1),
  stageCategory: z.enum(["source", "processing", "storage", "inspection"]),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  order: z.number().int().positive(),
  executionMode: z.enum(["required", "optional", "conditional"]),
  conditionId: z.string().trim().min(1).optional(),
  skipByDefault: z.boolean(),
  inspectability: z.object({
    inspectable: z.boolean(),
    inspectionReference: z.string().trim().min(1).optional(),
    summaryReference: z.string().trim().min(1).optional(),
  }),
  lineageHooks: z.object({
    pipelineId: z.string().trim().min(1).optional(),
    lineageId: z.string().trim().min(1).optional(),
    upstreamStageIds: z.array(z.string().trim().min(1)),
  }),
  previewHooks: z.object({
    previewReference: z.string().trim().min(1).optional(),
    sampleReference: z.string().trim().min(1).optional(),
  }),
  sourceMetadata: z.object({
    detectedDataType: z.string().trim().min(1).optional(),
    sourceReference: z.string().trim().min(1).optional(),
  }),
  status: z.object({
    marker: z.nativeEnum(StageStatusMarkerKinds),
    updatedAt: z.string().trim().min(1),
  }),
});

export type StageMetadata = z.output<typeof StageMetadataSchema>;

const StagePortContractSchema = z.object({
  shapeKinds: z.array(z.string().trim().min(1)).min(1),
});

const StageSimpleContractSchema = z.object({
  kind: z.literal(StageContractKinds.simple),
  input: StagePortContractSchema,
  output: StagePortContractSchema,
  assetReferences: z.array(z.object({
    assetId: z.string().trim().min(1),
    assetVersion: z.string().trim().min(1).optional(),
  })).min(1),
});

const StageCompositeMappedContractSchema = z.object({
  kind: z.literal(StageContractKinds.compositeMapped),
  input: StagePortContractSchema,
  output: StagePortContractSchema,
  mappedChildren: z.array(z.object({
    key: z.string().trim().min(1),
    contract: StageSimpleContractSchema,
  })).min(1),
});

export const StageContractSchema = z.union([
  StageSimpleContractSchema,
  StageCompositeMappedContractSchema,
]);

export type StageContract = z.output<typeof StageContractSchema>;

export const StageMetadataPropagationPayloadSchema = z.object({
  fromStageId: z.string().trim().min(1),
  detectedDataType: z.string().trim().min(1).optional(),
  storageReference: z.string().trim().min(1).optional(),
  normalizationHints: z.record(z.string().trim().min(1), z.unknown()).optional(),
  previewReference: z.string().trim().min(1).optional(),
  inspectionReference: z.string().trim().min(1).optional(),
  lineage: z.object({
    pipelineId: z.string().trim().min(1).optional(),
    lineageId: z.string().trim().min(1).optional(),
    upstreamStageIds: z.array(z.string().trim().min(1)),
  }),
});

export type StageMetadataPropagationPayload = z.output<typeof StageMetadataPropagationPayloadSchema>;

export const StageRuntimeTrackingSchema = z.object({
  metadata: StageMetadataSchema,
  contract: StageContractSchema,
  propagated: StageMetadataPropagationPayloadSchema.optional(),
});

export type StageRuntimeTracking = z.output<typeof StageRuntimeTrackingSchema>;

function inferStageCategory(stageKind: string): StageMetadata["stageCategory"] {
  if (stageKind === "source" || stageKind === "source-selection") {
    return "source";
  }
  if (stageKind.includes("storage")) {
    return "storage";
  }
  if (stageKind === "preview" || stageKind === "profiling") {
    return "inspection";
  }
  return "processing";
}

function toRequiredString(value: CanonicalRecordValue | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function toBoolean(value: CanonicalRecordValue | undefined): boolean | undefined {
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

function toStageSimpleContract(stage: DatasetPipelineStageDefinition): z.input<typeof StageSimpleContractSchema> {
  return {
    kind: StageContractKinds.simple,
    input: {
      shapeKinds: stage.dataContract.acceptedInputShapeKinds,
    },
    output: {
      shapeKinds: stage.dataContract.producedOutputShapeKinds,
    },
    assetReferences: stage.assetReferences,
  };
}

export function createStageContractFromDefinition(
  stage: DatasetPipelineStageDefinition,
  options?: {
    readonly mappedChildren?: ReadonlyArray<{ readonly key: string; readonly stage: DatasetPipelineStageDefinition }>;
  },
): StageContract {
  if (!options?.mappedChildren || options.mappedChildren.length === 0) {
    return StageContractSchema.parse(toStageSimpleContract(stage));
  }
  return StageContractSchema.parse({
    kind: StageContractKinds.compositeMapped,
    input: {
      shapeKinds: stage.dataContract.acceptedInputShapeKinds,
    },
    output: {
      shapeKinds: stage.dataContract.producedOutputShapeKinds,
    },
    mappedChildren: options.mappedChildren.map((mapped) => ({
      key: mapped.key,
      contract: toStageSimpleContract(mapped.stage),
    })),
  });
}

export function createStageMetadataFromDefinition(
  stage: DatasetPipelineStageDefinition,
): StageMetadata {
  return StageMetadataSchema.parse({
    stageId: stage.id,
    stageKind: stage.kind,
    stageCategory: inferStageCategory(stage.kind),
    name: stage.name,
    description: stage.description,
    order: stage.order,
    executionMode: stage.executionPolicy.mode,
    conditionId: stage.executionPolicy.conditionId,
    skipByDefault: Boolean(stage.executionPolicy.skipByDefault),
    inspectability: {
      inspectable: true,
    },
    lineageHooks: {
      upstreamStageIds: [],
    },
    previewHooks: {},
    sourceMetadata: {},
    status: {
      marker: StageStatusMarkerKinds.pending,
      updatedAt: new Date().toISOString(),
    },
  });
}

export function withStageStatusMarker(
  metadata: StageMetadata,
  marker: StageStatusMarkerKind,
): StageMetadata {
  return StageMetadataSchema.parse({
    ...metadata,
    status: {
      marker,
      updatedAt: new Date().toISOString(),
    },
  });
}

function toPropagationFromUnified(
  stageId: string,
  output: UnifiedIngestionStageOutput,
): StageMetadataPropagationPayload {
  return StageMetadataPropagationPayloadSchema.parse({
    fromStageId: stageId,
    detectedDataType: output.detectedSourceKind,
    normalizationHints: {
      outputTarget: output.outputTarget,
      canonicalOutputKind: output.canonicalOutputKind,
      schemaKnown: output.schemaKnown ?? false,
      profileComputed: output.profileComputed ?? false,
      fallbackUsed: output.fallbackUsed,
    },
    previewReference: output.metadata?.lineageId,
    lineage: {
      pipelineId: output.metadata?.pipelineId,
      lineageId: output.metadata?.lineageId,
      upstreamStageIds: output.metadata?.orderedStageIds ?? [],
    },
  });
}

function toPropagationFromRawStorage(
  stageId: string,
  output: RawStorageStageOutput,
): StageMetadataPropagationPayload {
  return StageMetadataPropagationPayloadSchema.parse({
    fromStageId: stageId,
    detectedDataType: output.source.referenceKind,
    storageReference: output.persistence.storageReference,
    inspectionReference: output.persistence.contentDigest,
    lineage: {
      pipelineId: output.traceability.pipelineId,
      lineageId: output.traceability.lineageId,
      upstreamStageIds: output.traceability.upstreamStageId ? [output.traceability.upstreamStageId] : [],
    },
  });
}

export function createStageMetadataPropagationPayload(input: {
  readonly stageId: string;
  readonly stageOutput: Readonly<Record<string, CanonicalRecordValue>>;
}): StageMetadataPropagationPayload | undefined {
  const unified = readUnifiedIngestionStageOutput(input.stageOutput);
  if (unified) {
    return toPropagationFromUnified(input.stageId, unified);
  }

  const rawStorage = readRawStorageStageOutput(input.stageOutput);
  if (rawStorage) {
    return toPropagationFromRawStorage(input.stageId, rawStorage);
  }

  const detectedDataType = toRequiredString(input.stageOutput.detectedSourceKind)
    ?? toRequiredString(input.stageOutput.sourceKind)
    ?? toRequiredString(input.stageOutput.canonicalOutputKind);
  const storageReference = toRequiredString(input.stageOutput.storageReference);
  const previewReference = toRequiredString(input.stageOutput.previewReference);
  const inspectionReference = toRequiredString(input.stageOutput.inspectionReference);
  const pipelineId = toRequiredString(input.stageOutput.pipelineId);
  const lineageId = toRequiredString(input.stageOutput.lineageId);
  const schemaKnown = toBoolean(input.stageOutput.schemaKnown);
  const profileComputed = toBoolean(input.stageOutput.profileComputed);

  if (
    !detectedDataType
    && !storageReference
    && !previewReference
    && !inspectionReference
    && !pipelineId
    && !lineageId
    && schemaKnown === undefined
    && profileComputed === undefined
  ) {
    return undefined;
  }

  return StageMetadataPropagationPayloadSchema.parse({
    fromStageId: input.stageId,
    detectedDataType,
    storageReference,
    previewReference,
    inspectionReference,
    normalizationHints: {
      ...(schemaKnown === undefined ? {} : { schemaKnown }),
      ...(profileComputed === undefined ? {} : { profileComputed }),
    },
    lineage: {
      pipelineId,
      lineageId,
      upstreamStageIds: [],
    },
  });
}

export function mergePropagationPayloads(
  current: StageMetadataPropagationPayload | undefined,
  incoming: StageMetadataPropagationPayload,
): StageMetadataPropagationPayload {
  if (!current) {
    return StageMetadataPropagationPayloadSchema.parse(incoming);
  }

  return StageMetadataPropagationPayloadSchema.parse({
    fromStageId: incoming.fromStageId,
    detectedDataType: incoming.detectedDataType ?? current.detectedDataType,
    storageReference: incoming.storageReference ?? current.storageReference,
    normalizationHints: {
      ...(current.normalizationHints ?? {}),
      ...(incoming.normalizationHints ?? {}),
    },
    previewReference: incoming.previewReference ?? current.previewReference,
    inspectionReference: incoming.inspectionReference ?? current.inspectionReference,
    lineage: {
      pipelineId: incoming.lineage.pipelineId ?? current.lineage.pipelineId,
      lineageId: incoming.lineage.lineageId ?? current.lineage.lineageId,
      upstreamStageIds: Array.from(new Set([
        ...current.lineage.upstreamStageIds,
        ...incoming.lineage.upstreamStageIds,
      ])),
    },
  });
}

