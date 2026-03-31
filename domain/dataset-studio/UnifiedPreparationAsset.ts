import { z } from "zod";
import type { CanonicalDataShapeKind, CanonicalRecordValue } from "./CanonicalDataShapes";
import { CanonicalDataShapeKinds } from "./CanonicalDataShapes";
import type { PipelineStageConfigMode, PipelineStageId } from "./PipelineStageDomain";
import { PipelineStageConfigModes, PipelineStageIds } from "./PipelineStageDomain";

export const UnifiedPreparationAssetKinds = Object.freeze({
  unifiedPreparation: "unified-preparation",
} as const);

export type UnifiedPreparationAssetKind =
  typeof UnifiedPreparationAssetKinds[keyof typeof UnifiedPreparationAssetKinds];

export const UnifiedPreparationVisibilityModes = Object.freeze({
  simple: "simple",
  advanced: "advanced",
} as const);

export type UnifiedPreparationVisibilityMode =
  typeof UnifiedPreparationVisibilityModes[keyof typeof UnifiedPreparationVisibilityModes];

export const UnifiedPreparationStageActivationModes = Object.freeze({
  always: "always",
  conditional: "conditional",
  disabled: "disabled",
} as const);

export type UnifiedPreparationStageActivationMode =
  typeof UnifiedPreparationStageActivationModes[keyof typeof UnifiedPreparationStageActivationModes];

export interface UnifiedPreparationAssetIdentity {
  readonly assetId: string;
  readonly versionId: string;
  readonly kind: UnifiedPreparationAssetKind;
}

export interface UnifiedPreparationAssetVersioning {
  readonly schemaVersion: string;
  readonly contractVersion: string;
  readonly revision: number;
}

export interface UnifiedPreparationUpstreamBinding {
  readonly pipelineAssetId: string;
  readonly pipelineVersionId?: string;
  readonly outputStageId?: PipelineStageId;
  readonly outputAssetGroupIds?: ReadonlyArray<string>;
  readonly sourceReference?: string;
}

export interface UnifiedPreparationStageActivation {
  readonly mode: UnifiedPreparationStageActivationMode;
  readonly conditionId?: string;
  readonly reason?: string;
}

export interface UnifiedPreparationStageConfig {
  readonly stageId: PipelineStageId;
  readonly visibility: UnifiedPreparationVisibilityMode;
  readonly configMode: PipelineStageConfigMode;
  readonly activation: UnifiedPreparationStageActivation;
  readonly options: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface UnifiedPreparationOutputDescriptor {
  readonly preparedAssetId: string;
  readonly preparedAssetVersionId?: string;
  readonly outputShapeKind: CanonicalDataShapeKind;
  readonly description?: string;
}

export interface UnifiedPreparationStorageTarget {
  readonly targetId: string;
  readonly locationReference?: string;
  readonly retentionPolicy?: string;
}

export interface UnifiedPreparationLineageMetadata {
  readonly lineageId?: string;
  readonly upstreamAssetIds: ReadonlyArray<string>;
  readonly reusableAsAsset: boolean;
  readonly reusableLabel?: string;
}

export interface UnifiedPreparationPreviewMetadata {
  readonly previewEnabled: boolean;
  readonly inspectionEnabled: boolean;
  readonly previewSampleSize?: number;
  readonly inspectionReference?: string;
}

export interface UnifiedPreparationAssetDefinition {
  readonly identity: UnifiedPreparationAssetIdentity;
  readonly versioning: UnifiedPreparationAssetVersioning;
  readonly upstreamBindings: ReadonlyArray<UnifiedPreparationUpstreamBinding>;
  readonly stages: ReadonlyArray<UnifiedPreparationStageConfig>;
  readonly output: UnifiedPreparationOutputDescriptor;
  readonly storageTarget?: UnifiedPreparationStorageTarget;
  readonly lineage: UnifiedPreparationLineageMetadata;
  readonly preview: UnifiedPreparationPreviewMetadata;
}

const StageIdSchema = z.nativeEnum(PipelineStageIds);
const ShapeKindSchema = z.nativeEnum(CanonicalDataShapeKinds);

const UnifiedPreparationAssetIdentitySchema = z.object({
  assetId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  kind: z.literal(UnifiedPreparationAssetKinds.unifiedPreparation),
});

const UnifiedPreparationAssetVersioningSchema = z.object({
  schemaVersion: z.string().trim().min(1).default("1.0.0"),
  contractVersion: z.string().trim().min(1).default("1.0.0"),
  revision: z.number().int().min(1).default(1),
});

const UnifiedPreparationUpstreamBindingSchema = z.object({
  pipelineAssetId: z.string().trim().min(1),
  pipelineVersionId: z.string().trim().min(1).optional(),
  outputStageId: StageIdSchema.optional(),
  outputAssetGroupIds: z.array(z.string().trim().min(1)).optional(),
  sourceReference: z.string().trim().min(1).optional(),
});

const UnifiedPreparationStageActivationSchema = z.object({
  mode: z.nativeEnum(UnifiedPreparationStageActivationModes),
  conditionId: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).optional(),
});

const UnifiedPreparationStageConfigSchema = z.object({
  stageId: StageIdSchema,
  visibility: z.nativeEnum(UnifiedPreparationVisibilityModes).default(
    UnifiedPreparationVisibilityModes.simple,
  ),
  configMode: z.nativeEnum(PipelineStageConfigModes).default(PipelineStageConfigModes.simple),
  activation: UnifiedPreparationStageActivationSchema.default({
    mode: UnifiedPreparationStageActivationModes.always,
  }),
  options: z.record(z.any()).default({}),
});

const UnifiedPreparationOutputDescriptorSchema = z.object({
  preparedAssetId: z.string().trim().min(1),
  preparedAssetVersionId: z.string().trim().min(1).optional(),
  outputShapeKind: ShapeKindSchema,
  description: z.string().trim().min(1).optional(),
});

const UnifiedPreparationStorageTargetSchema = z.object({
  targetId: z.string().trim().min(1),
  locationReference: z.string().trim().min(1).optional(),
  retentionPolicy: z.string().trim().min(1).optional(),
});

const UnifiedPreparationLineageMetadataSchema = z.object({
  lineageId: z.string().trim().min(1).optional(),
  upstreamAssetIds: z.array(z.string().trim().min(1)).default([]),
  reusableAsAsset: z.boolean().default(true),
  reusableLabel: z.string().trim().min(1).optional(),
});

const UnifiedPreparationPreviewMetadataSchema = z.object({
  previewEnabled: z.boolean().default(true),
  inspectionEnabled: z.boolean().default(true),
  previewSampleSize: z.number().int().min(1).max(2000).optional(),
  inspectionReference: z.string().trim().min(1).optional(),
});

export const UnifiedPreparationAssetDefinitionSchema = z.object({
  identity: UnifiedPreparationAssetIdentitySchema,
  versioning: UnifiedPreparationAssetVersioningSchema,
  upstreamBindings: z.array(UnifiedPreparationUpstreamBindingSchema).min(1),
  stages: z.array(UnifiedPreparationStageConfigSchema).min(1),
  output: UnifiedPreparationOutputDescriptorSchema,
  storageTarget: UnifiedPreparationStorageTargetSchema.optional(),
  lineage: UnifiedPreparationLineageMetadataSchema,
  preview: UnifiedPreparationPreviewMetadataSchema,
});

const RequiredUnifiedPreparationStages = Object.freeze([
  PipelineStageIds.SourceSelection,
  PipelineStageIds.UnifiedIngestion,
  PipelineStageIds.StoragePrepared,
] as const);

function dedupeStageConfigs(
  stages: ReadonlyArray<UnifiedPreparationStageConfig>,
): ReadonlyArray<UnifiedPreparationStageConfig> {
  const deduped = new Map<PipelineStageId, UnifiedPreparationStageConfig>();
  for (const stage of stages) {
    deduped.set(stage.stageId, stage);
  }
  return Object.freeze([...deduped.values()]);
}

function assertActivationIntegrity(stage: UnifiedPreparationStageConfig): void {
  if (
    stage.activation.mode === UnifiedPreparationStageActivationModes.conditional
    && !stage.activation.conditionId
  ) {
    throw new Error(`Stage '${stage.stageId}' requires conditionId when activation mode is conditional.`);
  }
}

export function createUnifiedPreparationAssetDefinition(
  input: UnifiedPreparationAssetDefinition,
): UnifiedPreparationAssetDefinition {
  const parsed = UnifiedPreparationAssetDefinitionSchema.parse(input) as UnifiedPreparationAssetDefinition;
  const stages = dedupeStageConfigs(parsed.stages);
  const stageIds = new Set(stages.map((stage) => stage.stageId));

  for (const requiredStageId of RequiredUnifiedPreparationStages) {
    if (!stageIds.has(requiredStageId)) {
      throw new Error(`Unified preparation asset is missing required stage '${requiredStageId}'.`);
    }
  }

  for (const stage of stages) {
    assertActivationIntegrity(stage);
  }

  const preparedStorageStage = stages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared);
  if (!preparedStorageStage) {
    throw new Error(`Unified preparation asset is missing required stage '${PipelineStageIds.StoragePrepared}'.`);
  }
  const storageTargetDefined = Boolean(parsed.storageTarget?.targetId);
  const stageDestinationDefined = typeof preparedStorageStage.options.destination === "string"
    && preparedStorageStage.options.destination.trim().length > 0;
  if (!storageTargetDefined && !stageDestinationDefined) {
    throw new Error(
      "Unified preparation asset requires storageTarget.targetId or StoragePrepared stage option 'destination'.",
    );
  }

  return Object.freeze({
    ...parsed,
    stages,
  });
}
