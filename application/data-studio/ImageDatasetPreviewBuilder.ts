import type {
  CanonicalImageMetadataRecordsShape,
  CanonicalImageStructuredItem,
  CanonicalRecordValue,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  createImageAssetReference,
  ImageAssetReferenceKinds,
} from "../../domain/dataset-studio/contracts/ImageAssetReference";
import {
  createDataConverterDiagnostic,
  DataConverterDiagnosticSeverities,
  type DataConverterDiagnostic,
} from "../dataset-studio/DataConverterContracts";

export interface ImageDatasetPreviewItem {
  readonly itemId: string;
  readonly selectionId: string;
  readonly imageId?: string;
  readonly imageReference?: string;
  readonly thumbnailSource?: string;
  readonly width?: number;
  readonly height?: number;
  readonly format?: string;
  readonly metadataSummary: Readonly<Record<string, CanonicalRecordValue>>;
  readonly tags: ReadonlyArray<string>;
  readonly annotations: Readonly<Record<string, CanonicalRecordValue>>;
  readonly derived: Readonly<Record<string, CanonicalRecordValue>>;
  readonly issues: ReadonlyArray<string>;
}

export interface ImageDatasetPreviewBuildResult {
  readonly items: ReadonlyArray<ImageDatasetPreviewItem>;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
  readonly totalCount: number;
  readonly offset: number;
  readonly limit: number;
}

export interface ImageDatasetPreviewWindow {
  readonly offset?: number;
  readonly limit: number;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toRecordValueRecord(
  value: unknown,
): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, CanonicalRecordValue>>;
}

function toStringArray(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    [...new Set(
      value
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim()),
    )],
  );
}

function toThumbnailSource(pathOrUri?: string): string | undefined {
  const normalized = normalizeOptional(pathOrUri);
  if (!normalized) {
    return undefined;
  }
  if (/^[a-z]+:\/\//i.test(normalized) || normalized.startsWith("data:")) {
    return normalized;
  }
  const withForwardSlashes = normalized.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(withForwardSlashes)) {
    return `file:///${withForwardSlashes}`;
  }
  if (withForwardSlashes.startsWith("/")) {
    return `file://${withForwardSlashes}`;
  }
  return normalized;
}

function getRecordValue(
  item: CanonicalImageStructuredItem,
  key: string,
): CanonicalRecordValue | undefined {
  const attributesValue = item.attributes?.[key];
  if (attributesValue !== undefined) {
    return attributesValue;
  }
  return item.metadata?.[key];
}

function extractImageReference(
  item: CanonicalImageStructuredItem,
): {
  readonly imageReference?: string;
  readonly thumbnailSource?: string;
  readonly issue?: string;
} {
  const rawRef = getRecordValue(item, "assetRef");
  if (rawRef !== undefined) {
    try {
      const imageRef = createImageAssetReference(rawRef as Parameters<typeof createImageAssetReference>[0]);
      if (imageRef.kind === ImageAssetReferenceKinds.localFile) {
        return Object.freeze({
          imageReference: imageRef.path,
          thumbnailSource: toThumbnailSource(imageRef.path),
        });
      }
      if (imageRef.kind === ImageAssetReferenceKinds.externalUri) {
        return Object.freeze({
          imageReference: imageRef.uri,
          thumbnailSource: imageRef.uri,
        });
      }
      if (imageRef.kind === ImageAssetReferenceKinds.canonicalAsset) {
        return Object.freeze({
          imageReference: imageRef.assetId.toString(),
        });
      }
      return Object.freeze({
        imageReference: imageRef.outputId ?? imageRef.path ?? imageRef.stableId,
        thumbnailSource: toThumbnailSource(imageRef.path),
      });
    } catch {
      return Object.freeze({
        issue: "Invalid image asset reference.",
      });
    }
  }

  const fallbackImageId = normalizeOptional(item.imageId);
  if (fallbackImageId) {
    return Object.freeze({
      imageReference: fallbackImageId,
    });
  }

  return Object.freeze({
    issue: "Missing image reference.",
  });
}

function normalizeImageFormat(item: CanonicalImageStructuredItem): string | undefined {
  const format = toString(getRecordValue(item, "format"))
    ?? normalizeOptional(item.label);
  return format?.toLowerCase();
}

function normalizeSelectedMetadata(
  item: CanonicalImageStructuredItem,
): Readonly<Record<string, CanonicalRecordValue>> {
  const selectedKeys = [
    "fileName",
    "mimeType",
    "contentType",
    "sourceReference",
    "fileSizeInBytes",
    "exifOrientation",
    "annotationsCaption",
    "annotationsDescription",
    "annotationsNote",
    "annotationLabelCount",
    "annotationRegion",
  ] as const;
  const summary: Record<string, CanonicalRecordValue> = {};
  for (const key of selectedKeys) {
    const value = getRecordValue(item, key);
    if (value !== undefined) {
      summary[key] = value;
    }
  }
  return Object.freeze(summary);
}

function normalizeAnnotations(
  item: CanonicalImageStructuredItem,
): Readonly<Record<string, CanonicalRecordValue>> {
  const annotations = toRecordValueRecord(getRecordValue(item, "annotations"));
  if (!annotations) {
    return Object.freeze({});
  }

  const labels = Array.isArray(annotations.labels)
    ? annotations.labels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const summary = Object.freeze({
    caption: toString(annotations.caption),
    description: toString(annotations.description),
    note: toString(annotations.note),
    labels: Object.freeze(labels),
    region: toRecordValueRecord(annotations.region) ?? undefined,
  });

  return Object.freeze(Object.fromEntries(
    Object.entries(summary).filter(([, value]) => value !== undefined),
  )) as Readonly<Record<string, CanonicalRecordValue>>;
}

function normalizeDerived(
  item: CanonicalImageStructuredItem,
): Readonly<Record<string, CanonicalRecordValue>> {
  const derived = toRecordValueRecord(getRecordValue(item, "derived"));
  return Object.freeze({
    ...(derived ?? {}),
  });
}

function buildItem(
  item: CanonicalImageStructuredItem,
  index: number,
): {
  readonly item: ImageDatasetPreviewItem;
  readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
} {
  const diagnostics: DataConverterDiagnostic[] = [];
  const issues: string[] = [];
  const pathPrefix = `items[${index}]`;
  const width = toNumber(getRecordValue(item, "width"));
  const height = toNumber(getRecordValue(item, "height"));
  const format = normalizeImageFormat(item);
  const imageReference = extractImageReference(item);

  if (imageReference.issue) {
    issues.push(imageReference.issue);
    diagnostics.push(createDataConverterDiagnostic({
      code: "preview.image.reference-missing-or-invalid",
      severity: DataConverterDiagnosticSeverities.warning,
      message: imageReference.issue,
      path: `${pathPrefix}.assetRef`,
    }));
  }

  if (width === undefined || height === undefined) {
    issues.push("Missing width or height.");
    diagnostics.push(createDataConverterDiagnostic({
      code: "preview.image.dimensions-missing",
      severity: DataConverterDiagnosticSeverities.warning,
      message: "Image preview item is missing width or height.",
      path: pathPrefix,
    }));
  }

  if (!format) {
    issues.push("Missing format.");
    diagnostics.push(createDataConverterDiagnostic({
      code: "preview.image.format-missing",
      severity: DataConverterDiagnosticSeverities.warning,
      message: "Image preview item is missing a format value.",
      path: `${pathPrefix}.format`,
    }));
  }

  if ((width !== undefined && width <= 0) || (height !== undefined && height <= 0)) {
    issues.push("Invalid image dimensions.");
    diagnostics.push(createDataConverterDiagnostic({
      code: "preview.image.dimensions-invalid",
      severity: DataConverterDiagnosticSeverities.warning,
      message: "Image preview item has non-positive width or height.",
      path: pathPrefix,
    }));
  }

  const previewItem = Object.freeze({
    itemId: item.itemId,
    selectionId: item.itemId,
    imageId: normalizeOptional(item.imageId),
    imageReference: imageReference.imageReference,
    thumbnailSource: imageReference.thumbnailSource,
    width,
    height,
    format,
    metadataSummary: normalizeSelectedMetadata(item),
    tags: toStringArray(getRecordValue(item, "tags")),
    annotations: normalizeAnnotations(item),
    derived: normalizeDerived(item),
    issues: Object.freeze(issues),
  } satisfies ImageDatasetPreviewItem);

  return Object.freeze({
    item: previewItem,
    diagnostics: Object.freeze(diagnostics),
  });
}

export function buildImageDatasetPreview(
  shape: CanonicalImageMetadataRecordsShape,
  window: number | ImageDatasetPreviewWindow,
): ImageDatasetPreviewBuildResult {
  const normalizedWindow = typeof window === "number"
    ? Object.freeze({ offset: 0, limit: window })
    : window;
  const offset = Math.max(0, Math.floor(normalizedWindow.offset ?? 0));
  const limit = Math.max(1, Math.floor(normalizedWindow.limit));
  const sampled = shape.items.slice(offset, offset + limit);
  const items: ImageDatasetPreviewItem[] = [];
  const diagnostics: DataConverterDiagnostic[] = [];
  for (let index = 0; index < sampled.length; index += 1) {
    const built = buildItem(sampled[index], index);
    items.push(built.item);
    diagnostics.push(...built.diagnostics);
  }

  return Object.freeze({
    items: Object.freeze(items),
    diagnostics: Object.freeze(diagnostics),
    totalCount: shape.items.length,
    offset,
    limit,
  });
}
