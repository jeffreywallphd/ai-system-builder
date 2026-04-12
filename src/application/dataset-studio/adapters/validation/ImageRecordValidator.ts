import { z } from "zod";
import { AssetId } from "@domain/assets/AssetId";
import {
  createImageRecord,
  type IImageRecordValidator,
  type ImageRecord,
} from "@domain/dataset-studio/contracts/ImageRecord";
import { ImageOrientationKinds } from "@domain/dataset-studio/contracts/ImageDerivedAttributes";
import {
  ImageAssetReferenceKinds,
  type ImageAssetReferenceInput,
} from "@domain/dataset-studio/contracts/ImageAssetReference";
import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import { ImageAnnotationCoordinateSpaces } from "@domain/dataset-studio/contracts/ImageAnnotations";

export const MediaImageFormatAllowList = Object.freeze([
  "png",
  "jpeg",
  "jpg",
  "webp",
] as const);

export type MediaImageFormat = typeof MediaImageFormatAllowList[number];

export function isAllowedMediaImageFormat(format: string): boolean {
  const normalized = format.trim().toLowerCase();
  return (MediaImageFormatAllowList as ReadonlyArray<string>).includes(normalized);
}

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
  assetId: z.union([
    z.string().trim().min(1),
    z.instanceof(AssetId).transform((value) => value.toString()),
  ]),
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
  mimeType: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), canonicalRecordValueSchema).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  annotations: z.object({
    caption: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    note: z.string().trim().min(1).max(2000).optional(),
    labels: z.array(z.string().trim().min(1).max(100)).max(32).default([]),
    region: z.object({
      x: z.number().min(0),
      y: z.number().min(0),
      width: z.number().positive(),
      height: z.number().positive(),
      coordinateSpace: z.enum([
        ImageAnnotationCoordinateSpaces.pixel,
      ]).optional(),
      referenceId: z.string().trim().min(1).max(100).optional(),
    }).optional(),
  }).superRefine((value, ctx) => {
    const hasContent = Boolean(
      value.caption
      || value.description
      || value.note
      || value.labels.length > 0
      || value.region,
    );
    if (!hasContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Image annotations must include caption, description, note, labels, or region.",
      });
    }
  }).optional(),
  derived: z.object({
    aspectRatio: z.number().positive().optional(),
    orientation: z.enum([
      ImageOrientationKinds.portrait,
      ImageOrientationKinds.landscape,
      ImageOrientationKinds.square,
    ]).optional(),
    isAnimated: z.boolean().optional(),
    pixelCount: z.number().int().positive().optional(),
    megapixels: z.number().positive().optional(),
  }).catchall(canonicalRecordValueSchema).optional(),
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
      mimeType: parsed.mimeType,
      metadata: parsed.metadata,
      tags: parsed.tags,
      annotations: parsed.annotations,
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

