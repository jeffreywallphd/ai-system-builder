import type {
  CanonicalDataShape,
  CanonicalImageStructuredItem,
} from "../../../../domain/dataset-studio/CanonicalDataShapes";
import type {
  IImageRecordValidator,
} from "../../../../domain/dataset-studio/contracts/ImageRecord";
import {
  createSchemaIntentValidationIssue,
  createSchemaIntentValidationResult,
  DatasetSchemaIntentIds,
  DatasetSchemaIntentValidationSeverities,
  type IMediaSchemaIntent,
} from "../../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { ZodImageRecordValidator } from "../validation/ImageRecordValidator";

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

  return Object.freeze(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0));
}

function toImageRecordCandidate(item: CanonicalImageStructuredItem) {
  const metadata = item.metadata ?? {};
  const attributes = item.attributes ?? {};
  const structuredAssetRef = (attributes.assetRef ?? metadata.assetRef);
  const width = toNumberOrUndefined(metadata.width) ?? toNumberOrUndefined(attributes.width);
  const height = toNumberOrUndefined(metadata.height) ?? toNumberOrUndefined(attributes.height);
  const format = toStringOrUndefined(metadata.format) ?? toStringOrUndefined(attributes.format);
  const assetId = toStringOrUndefined(metadata.assetId)
    ?? toStringOrUndefined(attributes.assetId)
    ?? toStringOrUndefined(item.imageId);

  if (!structuredAssetRef && !assetId) {
    return undefined;
  }
  if (width === undefined || height === undefined || !format) {
    return undefined;
  }

  return Object.freeze({
    assetRef: structuredAssetRef ?? Object.freeze({
      assetId,
      assetVersionId: toStringOrUndefined(metadata.assetVersionId) ?? toStringOrUndefined(attributes.assetVersionId),
    }),
    width,
    height,
    format,
    metadata,
    tags: toStringArray(metadata.tags),
    derived: attributes,
  });
}

function toImageRecordCandidatesFromShape(shape: CanonicalDataShape): ReadonlyArray<unknown> {
  if (shape.kind === "records") {
    return Object.freeze(shape.records.map((record) => record.fields));
  }

  if (shape.kind !== "image-metadata-records") {
    return Object.freeze([]);
  }

  return Object.freeze(shape.items
    .map((item) => toImageRecordCandidate(item))
    .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate)));
}

export class MediaSchemaIntentAdapter implements IMediaSchemaIntent {
  public readonly descriptor: IMediaSchemaIntent["descriptor"] = Object.freeze({
    id: DatasetSchemaIntentIds.media,
    name: "Media",
    description: "Image-first media datasets with canonical image record semantics.",
    contractVersion: "1.0.0",
    supportedShapeKinds: Object.freeze(["records", "image-metadata-records"] as const),
    metadata: Object.freeze({
      previewHint: "dimensions-format-tags",
      recordContract: "image-record",
    }),
  });

  constructor(private readonly validator: IImageRecordValidator = new ZodImageRecordValidator()) {}

  public validateShape(shape: CanonicalDataShape) {
    const issues = [] as ReturnType<typeof createSchemaIntentValidationIssue>[];

    if (!this.descriptor.supportedShapeKinds.includes(shape.kind)) {
      issues.push(createSchemaIntentValidationIssue({
        code: "schema-intent.media.unsupported-shape-kind",
        message: `Media schema intent requires shape kind ${this.descriptor.supportedShapeKinds.join(" or ")}, received '${shape.kind}'.`,
        path: "shape.kind",
      }));
      return createSchemaIntentValidationResult(issues);
    }

    const candidates = toImageRecordCandidatesFromShape(shape);
    if (shape.kind === "image-metadata-records" && candidates.length === 0 && shape.items.length > 0) {
      issues.push(createSchemaIntentValidationIssue({
        code: "schema-intent.media.metadata-contract-missing",
        message: "Image metadata records did not expose canonical image-record fields (assetRef/assetId, width, height, format).",
        severity: DatasetSchemaIntentValidationSeverities.warning,
        path: "shape.items",
      }));
    }

    for (let index = 0; index < candidates.length; index += 1) {
      try {
        this.validator.validateImageRecord(candidates[index]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Media schema intent validation failed.";
        issues.push(createSchemaIntentValidationIssue({
          code: "schema-intent.media.record-invalid",
          message,
          path: `shape.items[${index}]`,
        }));
      }
    }

    return createSchemaIntentValidationResult(issues);
  }
}
