import {
  normalizeIngestionSourceKind,
  type IngestionSourceKind,
} from "../ingestion";
import {
  type StorageObjectChecksum,
  type StorageObjectMetadata,
} from "../storage";
import {
  normalizeArtifactBrowserLocator,
  type ArtifactBrowserLocator,
} from "./artifact-browser-locator";
import {
  type ArtifactBrowseKind,
} from "./artifact-browse-read-model";

export interface ArtifactDetailReadModel<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
> {
  locator: ArtifactBrowserLocator;
  artifactKind: ArtifactBrowseKind;
  mediaType?: string;
  sizeBytes?: number;
  checksum?: StorageObjectChecksum;
  sourceKind?: IngestionSourceKind;
  originalName?: string;
  createdAt?: string;
  metadata?: TMetadata;
}

export interface ArtifactReadSuccessValue<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
> {
  artifact: ArtifactDetailReadModel<TMetadata>;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeArtifactKind(kind: ArtifactBrowseKind): ArtifactBrowseKind {
  const normalized = kind.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  throw new Error(
    `Artifact browse kind must be a non-empty string. Received "${kind}".`,
  );
}

export function normalizeArtifactDetailReadModel<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
>(
  model: ArtifactDetailReadModel<TMetadata>,
): ArtifactDetailReadModel<TMetadata> {
  return {
    ...model,
    locator: normalizeArtifactBrowserLocator(model.locator),
    artifactKind: normalizeArtifactKind(model.artifactKind),
    mediaType: normalizeOptionalText(model.mediaType),
    sourceKind:
      typeof model.sourceKind === "string"
        ? normalizeIngestionSourceKind(model.sourceKind)
        : undefined,
    originalName: normalizeOptionalText(model.originalName),
    createdAt: normalizeOptionalText(model.createdAt),
  };
}

export function normalizeArtifactReadSuccessValue<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
>(
  value: ArtifactReadSuccessValue<TMetadata>,
): ArtifactReadSuccessValue<TMetadata> {
  return {
    artifact: normalizeArtifactDetailReadModel(value.artifact),
  };
}
