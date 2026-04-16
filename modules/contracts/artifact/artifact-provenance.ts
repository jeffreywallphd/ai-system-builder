import {
  normalizeIngestionSourceKind,
  type IngestionSourceKind,
} from "../ingestion";
import {
  normalizeStorageArtifactKey,
  type StorageArtifactKey,
} from "../storage";

export interface ArtifactProvenance {
  sourceKind?: IngestionSourceKind;
  sourceId?: string;
  parentArtifactKeys?: StorageArtifactKey[];
  transformId?: string;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeArtifactProvenance(
  provenance?: ArtifactProvenance,
): ArtifactProvenance | undefined {
  if (!provenance) {
    return undefined;
  }

  return {
    sourceKind:
      typeof provenance.sourceKind === "string"
        ? normalizeIngestionSourceKind(provenance.sourceKind)
        : undefined,
    sourceId: normalizeOptionalText(provenance.sourceId),
    parentArtifactKeys: provenance.parentArtifactKeys?.map((key) =>
      normalizeStorageArtifactKey(key)
    ),
    transformId: normalizeOptionalText(provenance.transformId),
  };
}
