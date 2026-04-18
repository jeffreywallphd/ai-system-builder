import {
  normalizeIngestionSourceKind,
  type IngestionSourceKind,
} from "../ingestion";
import {
  normalizeStorageArtifactKey,
  type StorageArtifactKey,
} from "../storage";
import type { StorageObjectMetadata } from "../storage";

export const ARTIFACT_BROWSE_KINDS = ["image", "data"] as const;

export type ArtifactBrowseKind = (typeof ARTIFACT_BROWSE_KINDS)[number];

export interface ArtifactBrowseItem {
  storageKey: StorageArtifactKey;
  artifactKind: ArtifactBrowseKind;
  mediaType?: string;
  sizeBytes?: number;
  sourceKind?: IngestionSourceKind;
  originalName?: string;
  createdAt?: string;
  metadata?: StorageObjectMetadata;
}

export interface ArtifactBrowseSuccessValue {
  items: ArtifactBrowseItem[];
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeArtifactBrowseKind(kind: ArtifactBrowseKind): ArtifactBrowseKind {
  return kind;
}

export function normalizeArtifactBrowseItem(item: ArtifactBrowseItem): ArtifactBrowseItem {
  return {
    ...item,
    storageKey: normalizeStorageArtifactKey(item.storageKey),
    artifactKind: normalizeArtifactBrowseKind(item.artifactKind),
    mediaType: normalizeOptionalText(item.mediaType),
    sourceKind:
      typeof item.sourceKind === "string"
        ? normalizeIngestionSourceKind(item.sourceKind)
        : undefined,
    originalName: normalizeOptionalText(item.originalName),
    createdAt: normalizeOptionalText(item.createdAt),
  };
}

export function normalizeArtifactBrowseSuccessValue(
  value: ArtifactBrowseSuccessValue,
): ArtifactBrowseSuccessValue {
  return {
    items: value.items.map((item) => normalizeArtifactBrowseItem(item)),
  };
}
