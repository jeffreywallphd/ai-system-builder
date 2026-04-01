import { z } from "zod";
import {
  createImageRecord,
  type IImageRecordValidator,
  type ImageRecord,
} from "../../../../domain/dataset-studio/contracts/ImageRecord";
import {
  ImageAssetReferenceKinds,
  type ImageAssetReferenceInput,
} from "../../../../domain/dataset-studio/contracts/ImageAssetReference";
import type { CanonicalRecordValue } from "../../../../domain/dataset-studio/CanonicalDataShapes";

const canonicalRecordValueSchema: z.ZodType<CanonicalRecordValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(canonicalRecordValueSchema),
  z.record(z.string(), canonicalRecordValueSchema),
]));

const sourceContextSchema = z.record(z.string().trim().min(1), z.string().trim().min(1));

const canonicalAssetReferenceSchema = z.object({
  kind: z.literal(ImageAssetReferenceKinds.canonicalAsset).optional(),
  stableId: z.string().trim().min(1).optional(),
  assetId: z.string().trim().min(1),
  assetVersionId: z.string().trim().min(1).optional(),
  sourceSystem: z.string().trim().min(1).optional(),
  sourceContext: sourceContextSchema.optional(),
  mimeTypeHint: z.string().trim().min(1).optional(),
  formatHint: z.string().trim().min(1).optional(),
});

const localFileReferenceSchema = z.object({
  kind: z.literal(ImageAssetReferenceKinds.localFile),
  stableId: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1),
  sourceSystem: z.string().trim().min(1).optional(),
  sourceContext: sourceContextSchema.optional(),
  mimeTypeHint: z.string().trim().min(1).optional(),
  formatHint: z.string().trim().min(1).optional(),
});

const generatedOutputReferenceSchema = z.object({
  kind: z.literal(ImageAssetReferenceKinds.generatedOutput),
  stableId: z.string().trim().min(1).optional(),
  outputId: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1).optional(),
  sourceSystem: z.string().trim().min(1).optional(),
  sourceContext: sourceContextSchema.optional(),
  mimeTypeHint: z.string().trim().min(1).optional(),
  formatHint: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(value.outputId || value.path), {
  message: "Generated image asset references require outputId or path.",
});

const externalUriReferenceSchema = z.object({
  kind: z.literal(ImageAssetReferenceKinds.externalUri),
  stableId: z.string().trim().min(1).optional(),
  uri: z.string().trim().min(1),
  sourceSystem: z.string().trim().min(1).optional(),
  sourceContext: sourceContextSchema.optional(),
  mimeTypeHint: z.string().trim().min(1).optional(),
  formatHint: z.string().trim().min(1).optional(),
});

const imageAssetReferenceSchema: z.ZodType<ImageAssetReferenceInput> = z.union([
  z.string().trim().min(1),
  canonicalAssetReferenceSchema,
  localFileReferenceSchema,
  generatedOutputReferenceSchema,
  externalUriReferenceSchema,
]);

const imageRecordSchema = z.object({
  assetRef: imageAssetReferenceSchema,
  width: z.number().positive(),
  height: z.number().positive(),
  format: z.string().trim().min(1),
  metadata: z.record(z.string(), canonicalRecordValueSchema).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  derived: z.record(z.string(), canonicalRecordValueSchema).optional(),
  schemaVersion: z.string().trim().min(1).optional(),
});

const imageRecordArraySchema = z.array(imageRecordSchema);

export class ZodImageRecordValidator implements IImageRecordValidator {
  public validateImageRecord(input: unknown): ImageRecord {
    const parsed = imageRecordSchema.parse(input);
    return createImageRecord({
      assetRef: parsed.assetRef,
      width: parsed.width,
      height: parsed.height,
      format: parsed.format,
      metadata: parsed.metadata,
      tags: parsed.tags,
      derived: parsed.derived,
      schemaVersion: parsed.schemaVersion,
    });
  }

  public validateImageRecords(input: unknown): ReadonlyArray<ImageRecord> {
    const parsed = imageRecordArraySchema.parse(input);
    return Object.freeze(parsed.map((record) => this.validateImageRecord(record)));
  }
}

const defaultImageRecordValidator = new ZodImageRecordValidator();

export function validateImageRecord(
  input: unknown,
  validator: IImageRecordValidator = defaultImageRecordValidator,
): ImageRecord {
  return validator.validateImageRecord(input);
}
