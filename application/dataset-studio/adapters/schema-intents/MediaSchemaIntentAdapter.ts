import type {
  CanonicalDataShape,
} from "../../../../domain/dataset-studio/CanonicalDataShapes";
import type { IMediaDatasetValidator } from "../../../../domain/dataset-studio/interfaces/MediaValidation";
import {
  createSchemaIntentValidationIssue,
  createSchemaIntentValidationResult,
  DatasetSchemaIntentIds,
  type IMediaSchemaIntent,
} from "../../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { ZodMediaDatasetValidator } from "../validation/MediaDatasetValidator";

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

  constructor(private readonly validator: IMediaDatasetValidator = new ZodMediaDatasetValidator()) {}

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

    const validation = this.validator.validateShape(shape);
    issues.push(...validation.issues.map((issue) => createSchemaIntentValidationIssue({
      code: issue.code.startsWith("schema-intent.media.")
        ? issue.code
        : issue.code.startsWith("media.")
          ? `schema-intent.media.${issue.code.slice("media.".length)}`
          : `schema-intent.media.${issue.code}`,
      message: issue.message,
      severity: issue.severity,
      path: issue.path,
    })));

    return createSchemaIntentValidationResult(issues);
  }
}
