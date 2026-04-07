import type {
  CanonicalDataShape,
  CanonicalImageStructuredItem,
  CanonicalRecordValue,
} from "../../../../domain/dataset-studio/CanonicalDataShapes";
import type { ImageRecord, IImageRecordValidator } from "../../../../domain/dataset-studio/contracts/ImageRecord";
import type {
  IMediaDatasetValidator,
  IMediaRecordValidator,
  MediaValidationIssue,
  MediaValidationResult,
} from "../../../../domain/dataset-studio/interfaces/MediaValidation";
import {
  MediaValidationIssueSeverities,
  createMediaValidationIssue,
  createMediaValidationResult,
} from "../../../../domain/dataset-studio/interfaces/MediaValidation";
import {
  ZodImageRecordValidator,
  isAllowedMediaImageFormat,
} from "./ImageRecordValidator";
import { assessImageRecordVersionCompatibility } from "../../../../domain/dataset-studio/contracts/ImageRecordVersioning";

const MediaRecordLimits = Object.freeze({
  maxDimension: 100_000,
} as const);

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toStringArray(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }

  return Object.freeze(
    value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0),
  );
}

function isRecordValue(value: CanonicalRecordValue): value is Readonly<Record<string, CanonicalRecordValue>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toDerivedRecord(
  value: unknown,
): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Readonly<Record<string, CanonicalRecordValue>>;
  return isRecordValue(candidate) ? candidate : undefined;
}

function toAnnotationsRecord(
  value: unknown,
): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Readonly<Record<string, CanonicalRecordValue>>;
  return isRecordValue(candidate) ? candidate : undefined;
}

function toImageRecordCandidate(item: CanonicalImageStructuredItem): {
  readonly candidate?: unknown;
  readonly issues: ReadonlyArray<MediaValidationIssue>;
} {
  const metadata = item.metadata ?? {};
  const attributes = item.attributes ?? {};
  const structuredAssetRef = attributes.assetRef ?? metadata.assetRef;
  const width = toNumberOrUndefined(metadata.width) ?? toNumberOrUndefined(attributes.width);
  const height = toNumberOrUndefined(metadata.height) ?? toNumberOrUndefined(attributes.height);
  const format = toStringOrUndefined(metadata.format) ?? toStringOrUndefined(attributes.format);
  const assetId = toStringOrUndefined(metadata.assetId)
    ?? toStringOrUndefined(attributes.assetId)
    ?? toStringOrUndefined(item.imageId);
  const derived = toDerivedRecord(metadata.derived)
    ?? toDerivedRecord(attributes.derived)
    ?? undefined;
  const annotations = toAnnotationsRecord(metadata.annotations)
    ?? toAnnotationsRecord(attributes.annotations)
    ?? undefined;
  const tags = toStringArray(metadata.tags ?? attributes.tags);

  if (!structuredAssetRef && !assetId) {
    return Object.freeze({
      issues: Object.freeze([createMediaValidationIssue({
        code: "media.asset-ref.missing",
        severity: MediaValidationIssueSeverities.warning,
        message: "Image metadata item does not include a canonical asset reference.",
        path: "assetRef",
      })]),
    });
  }
  if (width === undefined || height === undefined || !format) {
    return Object.freeze({
      issues: Object.freeze([createMediaValidationIssue({
        code: "media.image-record.missing-core-fields",
        severity: MediaValidationIssueSeverities.warning,
        message: "Image metadata item is missing width, height, or format fields.",
        path: "metadata",
      })]),
    });
  }

  return Object.freeze({
    candidate: Object.freeze({
      assetRef: structuredAssetRef ?? Object.freeze({
        assetId,
        assetVersionId: toStringOrUndefined(metadata.assetVersionId) ?? toStringOrUndefined(attributes.assetVersionId),
      }),
      width,
      height,
      format,
      metadata,
      tags,
      annotations,
      derived,
    }),
    issues: Object.freeze([]),
  });
}

function validateWidthHeightAndFormat(
  record: ImageRecord,
  basePath?: string,
): ReadonlyArray<MediaValidationIssue> {
  const issues: MediaValidationIssue[] = [];
  const pathPrefix = normalizeOptional(basePath);

  if (record.width > MediaRecordLimits.maxDimension) {
    issues.push(createMediaValidationIssue({
      code: "media.dimension.width.out-of-range",
      message: `Image width exceeds the maximum supported value of ${MediaRecordLimits.maxDimension}.`,
      path: pathPrefix ? `${pathPrefix}.width` : "width",
    }));
  }

  if (record.height > MediaRecordLimits.maxDimension) {
    issues.push(createMediaValidationIssue({
      code: "media.dimension.height.out-of-range",
      message: `Image height exceeds the maximum supported value of ${MediaRecordLimits.maxDimension}.`,
      path: pathPrefix ? `${pathPrefix}.height` : "height",
    }));
  }

  if (!isAllowedMediaImageFormat(record.format)) {
    issues.push(createMediaValidationIssue({
      code: "media.format.unsupported",
      message: `Image format '${record.format}' is not supported by the media ingestion conventions.`,
      path: pathPrefix ? `${pathPrefix}.format` : "format",
      details: Object.freeze({
        allowedFormats: ["png", "jpeg", "jpg", "webp"],
      }),
    }));
  }

  const schemaVersionCompatibility = assessImageRecordVersionCompatibility(record.schemaVersion);
  if (!schemaVersionCompatibility.compatible) {
    issues.push(createMediaValidationIssue({
      code: "media.schema-version.incompatible",
      message: `Image record schema version '${schemaVersionCompatibility.resolvedSchemaVersion}' is not compatible with supported media image record contracts.`,
      path: pathPrefix ? `${pathPrefix}.schemaVersion` : "schemaVersion",
      details: Object.freeze({
        reason: schemaVersionCompatibility.reason,
        resolvedSchemaVersion: schemaVersionCompatibility.resolvedSchemaVersion,
      }),
    }));
  }

  return Object.freeze(issues);
}

export class ZodMediaRecordValidator implements IMediaRecordValidator {
  constructor(private readonly imageRecordValidator: IImageRecordValidator = new ZodImageRecordValidator()) {}

  public validateRecord(input: unknown, path = "record"): MediaValidationResult<ImageRecord> {
    try {
      const record = this.imageRecordValidator.validateImageRecord(input);
      const postIssues = validateWidthHeightAndFormat(record, path);
      return createMediaValidationResult(postIssues, record);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media record validation failed.";
      return createMediaValidationResult([createMediaValidationIssue({
        code: "media.record.invalid",
        message,
        path,
      })]);
    }
  }

  public validateRecords(input: unknown, path = "records"): MediaValidationResult<ReadonlyArray<ImageRecord>> {
    if (!Array.isArray(input)) {
      return createMediaValidationResult([createMediaValidationIssue({
        code: "media.records.input-not-array",
        message: "Media record validation requires an array of records.",
        path,
      })]);
    }

    const records: ImageRecord[] = [];
    const issues: MediaValidationIssue[] = [];
    for (let index = 0; index < input.length; index += 1) {
      const recordPath = `${path}[${index}]`;
      const result = this.validateRecord(input[index], recordPath);
      issues.push(...result.issues);
      if (result.value) {
        records.push(result.value);
      }
    }

    return createMediaValidationResult(Object.freeze(issues), Object.freeze(records));
  }
}

export class ZodMediaDatasetValidator implements IMediaDatasetValidator {
  constructor(private readonly recordValidator: IMediaRecordValidator = new ZodMediaRecordValidator()) {}

  public validateShape(shape: CanonicalDataShape): MediaValidationResult<ReadonlyArray<ImageRecord>> {
    const issues: MediaValidationIssue[] = [];
    const candidates: unknown[] = [];

    if (shape.kind === "records") {
      shape.records.forEach((record, index) => {
        candidates.push(record.fields);
        if (Object.keys(record.fields).length === 0) {
          issues.push(createMediaValidationIssue({
            code: "media.record.empty-fields",
            severity: MediaValidationIssueSeverities.warning,
            message: "Media record candidate is empty.",
            path: `shape.records[${index}].fields`,
          }));
        }
      });
    } else if (shape.kind === "image-metadata-records") {
      shape.items.forEach((item, index) => {
        const candidateResult = toImageRecordCandidate(item);
        issues.push(...candidateResult.issues.map((issue) => createMediaValidationIssue({
          ...issue,
          path: issue.path ? `shape.items[${index}].${issue.path}` : `shape.items[${index}]`,
        })));
        if (candidateResult.candidate) {
          candidates.push(candidateResult.candidate);
        }
      });
    } else {
      issues.push(createMediaValidationIssue({
        code: "media.shape.kind-unsupported",
        message: `Media dataset validation does not support shape kind '${shape.kind}'.`,
        path: "shape.kind",
      }));
      return createMediaValidationResult(Object.freeze(issues), Object.freeze([]));
    }

    const recordValidation = this.recordValidator.validateRecords(
      candidates,
      shape.kind === "records" ? "shape.records" : "shape.items",
    );
    issues.push(...recordValidation.issues);
    return createMediaValidationResult(Object.freeze(issues), recordValidation.value ?? Object.freeze([]));
  }
}
