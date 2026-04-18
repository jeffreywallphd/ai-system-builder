export const ARTIFACT_INTAKE_FAMILIES = [
  "image",
  "text",
  "json",
  "binary",
] as const;

export type ArtifactIntakeFamily = (typeof ARTIFACT_INTAKE_FAMILIES)[number];
