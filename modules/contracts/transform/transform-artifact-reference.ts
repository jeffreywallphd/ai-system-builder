import {
  normalizeStorageArtifactKey,
  type StorageArtifactKey,
} from "../storage";

export interface TransformArtifactReference {
  key: StorageArtifactKey;
  role?: string;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeTransformArtifactReference(
  reference: TransformArtifactReference,
): TransformArtifactReference {
  return {
    ...reference,
    key: normalizeStorageArtifactKey(reference.key),
    role: normalizeOptionalText(reference.role),
  };
}
