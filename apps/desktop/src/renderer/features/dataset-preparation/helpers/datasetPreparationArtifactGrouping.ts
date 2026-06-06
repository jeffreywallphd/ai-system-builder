import { isGeneratedArtifact, isUploadedArtifact } from "../../artifact-browser/helpers/artifactStorageGrouping";
import type { DatasetPreparationTaskType } from "../../../../../../../modules/contracts/runtime";

export interface DatasetPreparationSourceArtifact {
  artifactId: string;
  label: string;
  storageKey: string;
  mediaType?: string;
  sourceKind?: string;
}

const TEXT_SOURCE_EXTENSIONS = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".html",
  ".htm",
  ".json",
  ".jsonl",
  ".md",
  ".pdf",
  ".txt",
  ".parquet",
  ".tsv",
  ".xlsx",
  ".xls",
]);

const TEXT_SOURCE_MEDIA_TYPES = new Set([
  "application/csv",
  "application/json",
  "application/jsonl",
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-ndjson",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/tab-separated-values",
]);

const IMAGE_SOURCE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp",
]);

const STRUCTURED_MANIFEST_EXTENSIONS = new Set([".csv", ".json", ".jsonl", ".parquet"]);
const STRUCTURED_MANIFEST_MEDIA_TYPES = new Set([
  "application/csv",
  "application/json",
  "application/jsonl",
  "application/vnd.apache.parquet",
  "application/x-ndjson",
  "text/csv",
]);

function normalizeMediaType(mediaType: string | undefined): string {
  return mediaType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function extensionOf(artifact: DatasetPreparationSourceArtifact): string {
  const source = artifact.label || artifact.storageKey;
  const withoutQuery = source.split("?")[0] ?? source;
  const dotIndex = withoutQuery.lastIndexOf(".");
  return dotIndex >= 0 ? withoutQuery.slice(dotIndex).toLowerCase() : "";
}

function isTextLikeArtifact(artifact: DatasetPreparationSourceArtifact): boolean {
  const mediaType = normalizeMediaType(artifact.mediaType);
  return mediaType.startsWith("text/")
    || TEXT_SOURCE_MEDIA_TYPES.has(mediaType)
    || TEXT_SOURCE_EXTENSIONS.has(extensionOf(artifact));
}

function isImageLikeArtifact(artifact: DatasetPreparationSourceArtifact): boolean {
  const mediaType = normalizeMediaType(artifact.mediaType);
  return mediaType.startsWith("image/") || IMAGE_SOURCE_EXTENSIONS.has(extensionOf(artifact));
}

function isStructuredManifestArtifact(artifact: DatasetPreparationSourceArtifact): boolean {
  const mediaType = normalizeMediaType(artifact.mediaType);
  return STRUCTURED_MANIFEST_MEDIA_TYPES.has(mediaType) || STRUCTURED_MANIFEST_EXTENSIONS.has(extensionOf(artifact));
}

function expectsImageSources(taskType: DatasetPreparationTaskType): boolean {
  return taskType === "diffusion-lora"
    || taskType === "vision-classification"
    || taskType === "vision-detection"
    || taskType === "vision-segmentation";
}

export function filterUploadedDatasetPreparationArtifacts(
  artifacts: DatasetPreparationSourceArtifact[],
): DatasetPreparationSourceArtifact[] {
  return artifacts.filter(isUploadedArtifact);
}

export function filterGeneratedDatasetPreparationArtifacts(
  artifacts: DatasetPreparationSourceArtifact[],
): DatasetPreparationSourceArtifact[] {
  return artifacts.filter(isGeneratedArtifact);
}

export function filterTaskRelevantDatasetPreparationArtifacts(
  artifacts: DatasetPreparationSourceArtifact[],
  taskType: DatasetPreparationTaskType,
): DatasetPreparationSourceArtifact[] {
  if (expectsImageSources(taskType)) {
    return artifacts.filter((artifact) => isImageLikeArtifact(artifact) || isStructuredManifestArtifact(artifact));
  }

  return artifacts.filter(isTextLikeArtifact);
}
