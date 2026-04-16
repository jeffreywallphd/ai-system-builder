import {
  normalizeStorageArtifactKey,
  type StorageArtifactKey,
} from "../storage";
import {
  normalizeDatasetMaterializationDescriptor,
  type DatasetMaterializationDescriptor,
} from "./dataset-materialization-descriptor";
import {
  normalizeDatasetSchemaSummary,
  type DatasetSchemaSummary,
} from "./dataset-schema-summary";

export type DatasetMetadata = Readonly<Record<string, unknown>>;

export interface DatasetDescriptor<
  TMetadata extends DatasetMetadata = DatasetMetadata,
> {
  id: string;
  name?: string;
  schema?: DatasetSchemaSummary;
  sourceArtifactKeys?: StorageArtifactKey[];
  transformIds?: string[];
  materializations?: DatasetMaterializationDescriptor[];
  createdAt?: string;
  metadata?: TMetadata;
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = value.trim();

  if (normalized.length < 1) {
    throw new Error(`${label} must be a non-empty string. Received "${value}".`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeDatasetDescriptor<
  TMetadata extends DatasetMetadata = DatasetMetadata,
>(
  descriptor: DatasetDescriptor<TMetadata>,
): DatasetDescriptor<TMetadata> {
  return {
    ...descriptor,
    id: normalizeRequiredText(descriptor.id, "Dataset id"),
    name: normalizeOptionalText(descriptor.name),
    schema: normalizeDatasetSchemaSummary(descriptor.schema),
    sourceArtifactKeys: descriptor.sourceArtifactKeys?.map((key) =>
      normalizeStorageArtifactKey(key)
    ),
    transformIds: descriptor.transformIds?.map((id) =>
      normalizeRequiredText(id, "Dataset transform id")
    ),
    materializations: descriptor.materializations?.map(
      normalizeDatasetMaterializationDescriptor,
    ),
    createdAt: normalizeOptionalText(descriptor.createdAt),
  };
}
