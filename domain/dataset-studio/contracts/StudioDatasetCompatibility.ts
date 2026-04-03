export interface DatasetAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
}

export interface DatasetInstanceReference {
  readonly systemId: string;
  readonly instanceId: string;
  readonly dataset: DatasetAssetReference;
}

export interface DatasetRecordReference {
  readonly dataset: DatasetAssetReference;
  readonly selectionId: string;
  readonly recordId: string;
  readonly instance?: DatasetInstanceReference;
  readonly imageReference?: string;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createDatasetAssetReference(input: {
  readonly assetId: string;
  readonly versionId?: string;
}): DatasetAssetReference {
  return Object.freeze({
    assetId: normalizeRequired(input.assetId, "Dataset asset reference assetId"),
    versionId: normalizeOptional(input.versionId),
  });
}

export function createDatasetInstanceReference(input: {
  readonly systemId: string;
  readonly instanceId: string;
  readonly dataset: DatasetAssetReference;
}): DatasetInstanceReference {
  return Object.freeze({
    systemId: normalizeRequired(input.systemId, "Dataset instance reference systemId"),
    instanceId: normalizeRequired(input.instanceId, "Dataset instance reference instanceId"),
    dataset: createDatasetAssetReference(input.dataset),
  });
}

export function createDatasetRecordReference(input: {
  readonly dataset: DatasetAssetReference;
  readonly selectionId: string;
  readonly recordId: string;
  readonly instance?: DatasetInstanceReference;
  readonly imageReference?: string;
}): DatasetRecordReference {
  return Object.freeze({
    dataset: createDatasetAssetReference(input.dataset),
    selectionId: normalizeRequired(input.selectionId, "Dataset record reference selectionId"),
    recordId: normalizeRequired(input.recordId, "Dataset record reference recordId"),
    instance: input.instance ? createDatasetInstanceReference(input.instance) : undefined,
    imageReference: normalizeOptional(input.imageReference),
  });
}
