import { z } from "zod";
import { AssetId } from "../../../../domain/assets/AssetId";
import {
  createImageRecord,
  type IImageRecordValidator,
  type ImageRecord,
} from "../../../../domain/dataset-studio/contracts/ImageRecord";
import type { CanonicalRecordValue } from "../../../../domain/dataset-studio/CanonicalDataShapes";

const canonicalRecordValueSchema: z.ZodType<CanonicalRecordValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(canonicalRecordValueSchema),
  z.record(z.string(), canonicalRecordValueSchema),
]));

const imageAssetReferenceSchema = z.object({
  assetId: z.string().trim().min(1).refine((value) => value.startsWith("asset:"), {
    message: "ImageRecord.assetRef.assetId must use canonical 'asset:' identity.",
  }),
  assetVersionId: z.string().trim().min(1).optional(),
});

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
      assetRef: {
        assetId: new AssetId(parsed.assetRef.assetId),
        assetVersionId: parsed.assetRef.assetVersionId,
      },
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
