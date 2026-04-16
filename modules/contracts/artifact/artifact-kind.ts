export const ARTIFACT_KINDS = [
  "raw-staged",
  "derived",
  "materialized",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export function isArtifactKind(value: string): value is ArtifactKind {
  return ARTIFACT_KINDS.includes(value as ArtifactKind);
}

export function normalizeArtifactKind(value: string): ArtifactKind {
  const normalized = value.trim().toLowerCase();

  if (!isArtifactKind(normalized)) {
    throw new Error(
      `Artifact kind must be one of ${ARTIFACT_KINDS.join(", ")}. Received "${value}".`,
    );
  }

  return normalized;
}
