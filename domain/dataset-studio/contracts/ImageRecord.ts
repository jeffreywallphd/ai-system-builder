import type { CanonicalRecordValue } from "../CanonicalDataShapes";
import {
  createImageAssetReference,
  type ImageAssetReference,
  type ImageAssetReferenceInput,
} from "./ImageAssetReference";
import {
  createImageDerivedAttributes,
  type ImageDerivedAttributesRecord,
} from "./ImageDerivedAttributes";
import {
  createImageAnnotations,
  type ImageAnnotationsRecord,
} from "./ImageAnnotations";
import { resolveImageRecordSchemaVersion } from "./ImageRecordVersioning";

export interface ImageRecord {
  readonly assetRef: ImageAssetReference;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly mimeType?: string;
  readonly metadata: Readonly<Record<string, CanonicalRecordValue>>;
  readonly tags: ReadonlyArray<string>;
  readonly annotations?: ImageAnnotationsRecord;
  readonly derived: ImageDerivedAttributesRecord;
  readonly schemaVersion?: string;
}

export interface IImageRecordValidator {
  validateImageRecord(input: unknown): ImageRecord;
  validateImageRecords(input: unknown): ReadonlyArray<ImageRecord>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeCanonicalRecord(
  value?: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  if (!value) {
    return Object.freeze({});
  }

  const normalizedEntries = Object.entries(value)
    .map(([key, entry]) => [key.trim(), entry] as const)
    .filter(([key]) => key.length > 0);

  return Object.freeze(Object.fromEntries(normalizedEntries));
}

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  if (!tags) {
    return Object.freeze([]);
  }

  return Object.freeze([...new Set(tags.map((entry) => entry.trim()).filter(Boolean))]);
}

function normalizeFormat(format: string): string {
  const normalized = format.trim().toLowerCase();
  if (!normalized) {
    throw new Error("ImageRecord.format cannot be empty.");
  }

  return normalized;
}

function normalizeMimeType(mimeType?: string): string | undefined {
  const normalized = normalizeOptional(mimeType)?.toLowerCase();
  return normalized;
}

function assertPositiveDimension(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }

  return value;
}

export function createImageRecord(input: {
  readonly assetRef: ImageAssetReferenceInput;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly mimeType?: string;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly tags?: ReadonlyArray<string>;
  readonly annotations?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly derived?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly schemaVersion?: string;
}): ImageRecord {
  const schemaVersion = resolveImageRecordSchemaVersion(input.schemaVersion);
  return Object.freeze({
    assetRef: createImageAssetReference(input.assetRef),
    width: assertPositiveDimension(input.width, "ImageRecord.width"),
    height: assertPositiveDimension(input.height, "ImageRecord.height"),
    format: normalizeFormat(input.format),
    mimeType: normalizeMimeType(input.mimeType),
    metadata: normalizeCanonicalRecord(input.metadata),
    tags: normalizeTags(input.tags),
    annotations: createImageAnnotations(input.annotations),
    derived: createImageDerivedAttributes(input.derived),
    schemaVersion: normalizeOptional(schemaVersion),
  });
}
