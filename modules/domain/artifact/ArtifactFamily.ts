import path from "node:path";

export const ARTIFACT_FAMILIES = [
  "image",
  "document",
  "text",
  "structured-text",
  "tabular",
  "binary",
] as const;

export type ArtifactFamily = (typeof ARTIFACT_FAMILIES)[number];

const ARTIFACT_FAMILY_SET = new Set<string>(ARTIFACT_FAMILIES);

const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "rtf"]);
const TEXT_EXTENSIONS = new Set(["txt", "md"]);
const STRUCTURED_TEXT_EXTENSIONS = new Set(["json", "yaml", "yml"]);
const TABULAR_EXTENSIONS = new Set(["csv", "tsv", "xls", "xlsx", "parquet"]);

const DOCUMENT_MEDIA_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
]);

const STRUCTURED_TEXT_MEDIA_TYPES = new Set([
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
]);

const TABULAR_MEDIA_TYPES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/x-parquet",
]);

function normalizeExtension(extensionOrName: string | undefined): string | undefined {
  if (typeof extensionOrName !== "string") {
    return undefined;
  }

  const trimmed = extensionOrName.trim();
  if (!trimmed) {
    return undefined;
  }

  const ext = trimmed.includes(".") ? path.extname(trimmed) : `.${trimmed}`;
  if (!ext || ext === ".") {
    return undefined;
  }

  return ext.slice(1).toLowerCase();
}

export function normalizeArtifactFamily(value: string): ArtifactFamily {
  const normalized = value.trim().toLowerCase();
  if (ARTIFACT_FAMILY_SET.has(normalized)) {
    return normalized as ArtifactFamily;
  }

  throw new Error(`Artifact family must be one of: ${ARTIFACT_FAMILIES.join(", ")}. Received: ${value}`);
}

export function resolveArtifactFamily(input: {
  mediaType?: string;
  extension?: string;
  fileName?: string;
}): ArtifactFamily {
  const mediaType = input.mediaType?.trim().toLowerCase();
  const extension = normalizeExtension(input.extension ?? input.fileName);

  if (mediaType?.startsWith("image/")) {
    return "image";
  }

  if (mediaType && DOCUMENT_MEDIA_TYPES.has(mediaType)) {
    return "document";
  }

  if (mediaType === "text/plain" || mediaType === "text/markdown") {
    return "text";
  }

  if (mediaType && STRUCTURED_TEXT_MEDIA_TYPES.has(mediaType)) {
    return "structured-text";
  }

  if (mediaType && TABULAR_MEDIA_TYPES.has(mediaType)) {
    return "tabular";
  }

  if (mediaType?.startsWith("text/")) {
    return "text";
  }

  if (extension && DOCUMENT_EXTENSIONS.has(extension)) {
    return "document";
  }

  if (extension && TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  if (extension && STRUCTURED_TEXT_EXTENSIONS.has(extension)) {
    return "structured-text";
  }

  if (extension && TABULAR_EXTENSIONS.has(extension)) {
    return "tabular";
  }

  return "binary";
}
