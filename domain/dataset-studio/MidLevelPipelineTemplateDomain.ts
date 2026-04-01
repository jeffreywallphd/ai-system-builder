import { z } from "zod";
import { CanonicalDataShapeKinds, type CanonicalRecordValue } from "./CanonicalDataShapes";
import { PipelineStageIds, type PipelineStageId } from "./PipelineStageDomain";

export type PipelineTemplateId = string;

export const PipelineTemplateCategories = Object.freeze({
  generalDataPreparation: "general-data-preparation",
  analyticsPreparation: "analytics-preparation",
  documentPreparation: "document-preparation",
  imagePreparation: "image-preparation",
} as const);

export type PipelineTemplateCategory =
  typeof PipelineTemplateCategories[keyof typeof PipelineTemplateCategories];

export interface PipelineTemplateEditingCapabilities {
  readonly canReorderStages: boolean;
  readonly canInsertOptionalStages: boolean;
  readonly canRemoveOptionalStages: boolean;
  readonly canToggleOptionalStages: boolean;
  readonly canEditStageConfiguration: boolean;
}

export interface PipelineTemplatePreviewSupportMetadata {
  readonly supportsPipelinePreview: boolean;
  readonly supportsStagePreview: boolean;
  readonly supportedPreviewKinds: ReadonlyArray<typeof CanonicalDataShapeKinds[keyof typeof CanonicalDataShapeKinds]>;
}

export interface PipelineTemplateWizardMetadata {
  readonly guidedStageIds: ReadonlyArray<PipelineStageId>;
  readonly autoConfiguredStageIds: ReadonlyArray<PipelineStageId>;
  readonly progressiveDisclosureStageIds: ReadonlyArray<PipelineStageId>;
  readonly stageRationaleById: Readonly<Partial<Record<PipelineStageId, string>>>;
}

export interface PipelineTemplateDefinition {
  readonly id: PipelineTemplateId;
  readonly category: PipelineTemplateCategory;
  readonly displayName: string;
  readonly description: string;
  readonly intendedUseCase: string;
  readonly defaultStageIds: ReadonlyArray<PipelineStageId>;
  readonly optionalStageIds: ReadonlyArray<PipelineStageId>;
  readonly defaultStageConfigs: Readonly<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>>;
  readonly supportedInputShapeKinds: ReadonlyArray<typeof CanonicalDataShapeKinds[keyof typeof CanonicalDataShapeKinds]>;
  readonly supportedOutputShapeKinds: ReadonlyArray<typeof CanonicalDataShapeKinds[keyof typeof CanonicalDataShapeKinds]>;
  readonly editingCapabilities: PipelineTemplateEditingCapabilities;
  readonly previewSupport: PipelineTemplatePreviewSupportMetadata;
  readonly wizardMetadata: PipelineTemplateWizardMetadata;
}

export interface PipelineTemplateInstantiationOptions {
  readonly stageConfigOverrides?: Readonly<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>>;
  readonly enabledOptionalStageIds?: ReadonlyArray<PipelineStageId>;
  readonly disabledOptionalStageIds?: ReadonlyArray<PipelineStageId>;
  readonly stageOrder?: ReadonlyArray<PipelineStageId>;
}

const StageIdSchema = z.nativeEnum(PipelineStageIds);
const ShapeKindSchema = z.nativeEnum(CanonicalDataShapeKinds);
const PipelineTemplateIdSchema = z.string().trim().min(1);
const PipelineTemplateCategorySchema = z.nativeEnum(PipelineTemplateCategories);
const StageConfigMapSchema = z.record(StageIdSchema, z.record(z.any()));

export const PipelineTemplateEditingCapabilitiesSchema = z.object({
  canReorderStages: z.boolean(),
  canInsertOptionalStages: z.boolean(),
  canRemoveOptionalStages: z.boolean(),
  canToggleOptionalStages: z.boolean(),
  canEditStageConfiguration: z.boolean(),
});

export const PipelineTemplatePreviewSupportMetadataSchema = z.object({
  supportsPipelinePreview: z.boolean(),
  supportsStagePreview: z.boolean(),
  supportedPreviewKinds: z.array(ShapeKindSchema).min(1),
});

export const PipelineTemplateWizardMetadataSchema = z.object({
  guidedStageIds: z.array(StageIdSchema),
  autoConfiguredStageIds: z.array(StageIdSchema),
  progressiveDisclosureStageIds: z.array(StageIdSchema),
  stageRationaleById: z.record(StageIdSchema, z.string().trim().min(1)),
});

export const PipelineTemplateDefinitionSchema = z.object({
  id: PipelineTemplateIdSchema,
  category: PipelineTemplateCategorySchema,
  displayName: z.string().trim().min(1),
  description: z.string().trim().min(1),
  intendedUseCase: z.string().trim().min(1),
  defaultStageIds: z.array(StageIdSchema).min(1),
  optionalStageIds: z.array(StageIdSchema),
  defaultStageConfigs: StageConfigMapSchema,
  supportedInputShapeKinds: z.array(ShapeKindSchema).min(1),
  supportedOutputShapeKinds: z.array(ShapeKindSchema).min(1),
  editingCapabilities: PipelineTemplateEditingCapabilitiesSchema,
  previewSupport: PipelineTemplatePreviewSupportMetadataSchema,
  wizardMetadata: PipelineTemplateWizardMetadataSchema,
});

export const PipelineTemplateInstantiationOptionsSchema = z.object({
  stageConfigOverrides: StageConfigMapSchema.optional(),
  enabledOptionalStageIds: z.array(StageIdSchema).optional(),
  disabledOptionalStageIds: z.array(StageIdSchema).optional(),
  stageOrder: z.array(StageIdSchema).optional(),
});

function dedupeStageIds(value: ReadonlyArray<PipelineStageId>): ReadonlyArray<PipelineStageId> {
  return Object.freeze([...new Set(value)]);
}

function freezeConfigMap(
  value: Readonly<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>>,
): Readonly<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>> {
  return Object.freeze(
    Object.entries(value).reduce<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>>((acc, [stageId, stageConfig]) => {
      acc[stageId as PipelineStageId] = Object.freeze({ ...stageConfig });
      return acc;
    }, {}),
  );
}

function assertSubset(
  values: ReadonlyArray<PipelineStageId>,
  scope: ReadonlySet<PipelineStageId>,
  label: string,
): void {
  for (const stageId of values) {
    if (!scope.has(stageId)) {
      throw new Error(`${label} references stage '${stageId}' outside template stage scope.`);
    }
  }
}

export function validatePipelineTemplateDefinition(
  definition: PipelineTemplateDefinition,
): PipelineTemplateDefinition {
  const parsed = PipelineTemplateDefinitionSchema.parse(definition) as PipelineTemplateDefinition;
  const defaultStageIds = dedupeStageIds(parsed.defaultStageIds);
  const optionalStageIds = dedupeStageIds(parsed.optionalStageIds);
  const stageScope = new Set<PipelineStageId>([...defaultStageIds, ...optionalStageIds]);
  const optionalSet = new Set(optionalStageIds);

  for (const stageId of optionalStageIds) {
    if (defaultStageIds.includes(stageId)) {
      throw new Error(`Template '${parsed.id}' cannot declare optional stage '${stageId}' as default stage.`);
    }
  }

  for (const stageId of Object.keys(parsed.defaultStageConfigs)) {
    if (!stageScope.has(stageId as PipelineStageId)) {
      throw new Error(`Template '${parsed.id}' has default stage config for unknown stage '${stageId}'.`);
    }
  }

  assertSubset(parsed.wizardMetadata.guidedStageIds, stageScope, `${parsed.id}.wizardMetadata.guidedStageIds`);
  assertSubset(
    parsed.wizardMetadata.autoConfiguredStageIds,
    stageScope,
    `${parsed.id}.wizardMetadata.autoConfiguredStageIds`,
  );
  assertSubset(
    parsed.wizardMetadata.progressiveDisclosureStageIds,
    stageScope,
    `${parsed.id}.wizardMetadata.progressiveDisclosureStageIds`,
  );
  assertSubset(
    Object.keys(parsed.wizardMetadata.stageRationaleById) as PipelineStageId[],
    stageScope,
    `${parsed.id}.wizardMetadata.stageRationaleById`,
  );

  for (const stageId of parsed.wizardMetadata.autoConfiguredStageIds) {
    if (!optionalSet.has(stageId)) {
      continue;
    }
    if (!parsed.wizardMetadata.guidedStageIds.includes(stageId)) {
      throw new Error(
        `Template '${parsed.id}' auto-configured stage '${stageId}' must still be present in guided stage ids.`,
      );
    }
  }

  return Object.freeze({
    ...parsed,
    defaultStageIds,
    optionalStageIds,
    defaultStageConfigs: freezeConfigMap(parsed.defaultStageConfigs),
    supportedInputShapeKinds: Object.freeze([...new Set(parsed.supportedInputShapeKinds)]),
    supportedOutputShapeKinds: Object.freeze([...new Set(parsed.supportedOutputShapeKinds)]),
    wizardMetadata: Object.freeze({
      ...parsed.wizardMetadata,
      guidedStageIds: dedupeStageIds(parsed.wizardMetadata.guidedStageIds),
      autoConfiguredStageIds: dedupeStageIds(parsed.wizardMetadata.autoConfiguredStageIds),
      progressiveDisclosureStageIds: dedupeStageIds(parsed.wizardMetadata.progressiveDisclosureStageIds),
      stageRationaleById: Object.freeze({ ...parsed.wizardMetadata.stageRationaleById }),
    }),
  });
}

export function validatePipelineTemplateInstantiationOptions(
  options: PipelineTemplateInstantiationOptions,
): PipelineTemplateInstantiationOptions {
  const parsed = PipelineTemplateInstantiationOptionsSchema.parse(options) as PipelineTemplateInstantiationOptions;
  const enabledOptionalStageIds = dedupeStageIds(parsed.enabledOptionalStageIds ?? Object.freeze([]));
  const disabledOptionalStageIds = dedupeStageIds(parsed.disabledOptionalStageIds ?? Object.freeze([]));
  const conflict = enabledOptionalStageIds.find((stageId) => disabledOptionalStageIds.includes(stageId));
  if (conflict) {
    throw new Error(`Template instantiation cannot both enable and disable optional stage '${conflict}'.`);
  }

  return Object.freeze({
    stageConfigOverrides: freezeConfigMap(parsed.stageConfigOverrides ?? {}),
    enabledOptionalStageIds,
    disabledOptionalStageIds,
    stageOrder: parsed.stageOrder ? dedupeStageIds(parsed.stageOrder) : undefined,
  });
}
