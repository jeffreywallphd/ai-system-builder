import type { CanonicalRecordValue } from "./CanonicalDataShapes";
import type { DatasetPipelineStageDefinition, DatasetPipelineStageKind } from "./StagePipelineDomain";

export interface StageOrderPreference {
  readonly stageKind: DatasetPipelineStageKind;
  readonly afterStageId?: string;
  readonly beforeStageId?: string;
}

export interface IntentStageOverrides {
  readonly includeStageKinds?: ReadonlyArray<DatasetPipelineStageKind>;
  readonly excludeStageKinds?: ReadonlyArray<DatasetPipelineStageKind>;
  readonly orderedStageIds?: ReadonlyArray<string>;
  readonly stageOrderPreferences?: ReadonlyArray<StageOrderPreference>;
  readonly defaultStageConfiguration?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
}

export interface IntentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly associatedTemplateIds: ReadonlyArray<string>;
  readonly stageOverrides?: IntentStageOverrides;
  readonly stageBlueprints?: ReadonlyArray<DatasetPipelineStageDefinition>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function freezeConfigMap(
  value: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>,
): Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>> {
  return Object.freeze(
    Object.entries(value).reduce<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>((accumulator, [stageId, config]) => {
      accumulator[normalizeRequired(stageId, "IntentDefinition.stageOverrides.defaultStageConfiguration.stageId")] = Object.freeze({ ...config });
      return accumulator;
    }, {}),
  );
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createIntentDefinition(input: IntentDefinition): IntentDefinition {
  const id = normalizeRequired(input.id, "IntentDefinition.id");
  const name = normalizeRequired(input.name, "IntentDefinition.name");
  const description = normalizeRequired(input.description, "IntentDefinition.description");
  const associatedTemplateIds = Object.freeze(input.associatedTemplateIds
    .map((templateId) => normalizeRequired(templateId, "IntentDefinition.associatedTemplateIds.templateId")));
  if (associatedTemplateIds.length === 0) {
    throw new Error(`Intent '${id}' must reference at least one pipeline template.`);
  }

  const stageOverrides = input.stageOverrides
    ? Object.freeze({
      includeStageKinds: Object.freeze([...(input.stageOverrides.includeStageKinds ?? [])]),
      excludeStageKinds: Object.freeze([...(input.stageOverrides.excludeStageKinds ?? [])]),
      orderedStageIds: Object.freeze([...(input.stageOverrides.orderedStageIds ?? [])]),
      stageOrderPreferences: Object.freeze((input.stageOverrides.stageOrderPreferences ?? []).map((preference) => Object.freeze({
        stageKind: preference.stageKind,
        afterStageId: normalizeOptional(preference.afterStageId),
        beforeStageId: normalizeOptional(preference.beforeStageId),
      }))),
      defaultStageConfiguration: freezeConfigMap(input.stageOverrides.defaultStageConfiguration ?? {}),
    })
    : undefined;

  const stageBlueprints = Object.freeze((input.stageBlueprints ?? []).map((stage) => Object.freeze({
    ...stage,
    dataContract: Object.freeze({
      acceptedInputShapeKinds: Object.freeze([...stage.dataContract.acceptedInputShapeKinds]),
      producedOutputShapeKinds: Object.freeze([...stage.dataContract.producedOutputShapeKinds]),
    }),
    assetReferences: Object.freeze(stage.assetReferences.map((asset) => Object.freeze({ ...asset }))),
    executionPolicy: Object.freeze({ ...stage.executionPolicy }),
  })));

  return Object.freeze({
    id,
    name,
    description,
    associatedTemplateIds,
    stageOverrides,
    stageBlueprints,
  });
}
