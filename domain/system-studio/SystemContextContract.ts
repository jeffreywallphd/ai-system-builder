export const SystemContextContractVersion = "1.0.0";

export interface SystemContextImageAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly recordId?: string;
  readonly uri?: string;
}

export interface SystemContextImageReference {
  readonly selectionId: string;
  readonly imageId?: string;
  readonly assetRef?: SystemContextImageAssetReference;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SystemContextDatasetReference {
  readonly referenceId: string;
  readonly instanceId?: string;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
  readonly role?: string;
  readonly systemAssetId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SystemContextRuntimeMetadata {
  readonly runtimeSessionId?: string;
  readonly workflowRunId?: string;
  readonly selectorSessionId?: string;
  readonly systemAssetId?: string;
  readonly workflowAssetId?: string;
  readonly sourceStudio?: string;
  readonly triggerEventId?: string;
  readonly triggerName?: string;
}

export interface SystemContextContract {
  readonly contractVersion: string;
  readonly selectedImages: ReadonlyArray<SystemContextImageReference>;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly datasets: ReadonlyArray<SystemContextDatasetReference>;
  readonly runtime: SystemContextRuntimeMetadata;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function freezeRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.freeze({ ...(value as Record<string, unknown>) });
}

export function createSystemContextContract(input?: Partial<SystemContextContract>): SystemContextContract {
  const selectedImages = (input?.selectedImages ?? [])
    .map((entry, index) => {
      const selectionId = normalizeOptionalString(entry.selectionId) ?? `selected-image-${index + 1}`;
      const imageId = normalizeOptionalString(entry.imageId);
      const assetRef = entry.assetRef && normalizeOptionalString(entry.assetRef.assetId)
        ? Object.freeze({
          assetId: normalizeOptionalString(entry.assetRef.assetId)!,
          versionId: normalizeOptionalString(entry.assetRef.versionId),
          recordId: normalizeOptionalString(entry.assetRef.recordId),
          uri: normalizeOptionalString(entry.assetRef.uri),
        })
        : undefined;

      return Object.freeze({
        selectionId,
        imageId,
        assetRef,
        metadata: freezeRecord(entry.metadata),
      } satisfies SystemContextImageReference);
    });

  const datasets = (input?.datasets ?? [])
    .map((entry, index) => Object.freeze({
      referenceId: normalizeOptionalString(entry.referenceId) ?? `dataset-ref-${index + 1}`,
      instanceId: normalizeOptionalString(entry.instanceId),
      datasetAssetId: normalizeOptionalString(entry.datasetAssetId),
      datasetVersionId: normalizeOptionalString(entry.datasetVersionId),
      role: normalizeOptionalString(entry.role),
      systemAssetId: normalizeOptionalString(entry.systemAssetId),
      metadata: freezeRecord(entry.metadata),
    } satisfies SystemContextDatasetReference));

  const runtime = Object.freeze({
    runtimeSessionId: normalizeOptionalString(input?.runtime?.runtimeSessionId),
    workflowRunId: normalizeOptionalString(input?.runtime?.workflowRunId),
    selectorSessionId: normalizeOptionalString(input?.runtime?.selectorSessionId),
    systemAssetId: normalizeOptionalString(input?.runtime?.systemAssetId),
    workflowAssetId: normalizeOptionalString(input?.runtime?.workflowAssetId),
    sourceStudio: normalizeOptionalString(input?.runtime?.sourceStudio),
    triggerEventId: normalizeOptionalString(input?.runtime?.triggerEventId),
    triggerName: normalizeOptionalString(input?.runtime?.triggerName),
  } satisfies SystemContextRuntimeMetadata);

  return Object.freeze({
    contractVersion: normalizeOptionalString(input?.contractVersion) ?? SystemContextContractVersion,
    selectedImages: Object.freeze(selectedImages),
    parameters: Object.freeze({ ...(input?.parameters ?? {}) }),
    datasets: Object.freeze(datasets),
    runtime,
    extensions: freezeRecord(input?.extensions),
  });
}
