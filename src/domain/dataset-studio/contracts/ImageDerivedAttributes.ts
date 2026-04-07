import type { CanonicalRecordValue } from "../CanonicalDataShapes";

export const ImageOrientationKinds = Object.freeze({
  portrait: "portrait",
  landscape: "landscape",
  square: "square",
} as const);

export type ImageOrientation =
  typeof ImageOrientationKinds[keyof typeof ImageOrientationKinds];

export interface ImageDerivedAttributes {
  readonly aspectRatio?: number;
  readonly orientation?: ImageOrientation;
  readonly isAnimated?: boolean;
  readonly pixelCount?: number;
  readonly megapixels?: number;
}

export type ImageDerivedAttributesRecord =
  Readonly<Record<string, CanonicalRecordValue>>
  & ImageDerivedAttributes;

function normalizeOptionalString(value?: string): string | undefined {
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

function assertPositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

function assertPositiveInteger(value: unknown, label: string): number {
  const numeric = assertPositiveNumber(value, label);
  if (!Number.isInteger(numeric)) {
    throw new Error(`${label} must be an integer.`);
  }
  return numeric;
}

export function createImageDerivedAttributes(
  input?: Readonly<Record<string, CanonicalRecordValue>>,
): ImageDerivedAttributesRecord {
  const normalized = { ...normalizeCanonicalRecord(input) } as Record<string, CanonicalRecordValue>;

  if ("aspectRatio" in normalized && normalized.aspectRatio !== undefined) {
    normalized.aspectRatio = assertPositiveNumber(normalized.aspectRatio, "ImageRecord.derived.aspectRatio");
  }

  if ("orientation" in normalized && normalized.orientation !== undefined) {
    const orientation = normalizeOptionalString(
      typeof normalized.orientation === "string" ? normalized.orientation : undefined,
    )?.toLowerCase();
    if (!orientation) {
      throw new Error("ImageRecord.derived.orientation must be a non-empty string when provided.");
    }
    if (!Object.values(ImageOrientationKinds).includes(orientation as ImageOrientation)) {
      throw new Error("ImageRecord.derived.orientation must be portrait, landscape, or square.");
    }
    normalized.orientation = orientation;
  }

  if ("isAnimated" in normalized && normalized.isAnimated !== undefined) {
    if (typeof normalized.isAnimated !== "boolean") {
      throw new Error("ImageRecord.derived.isAnimated must be a boolean.");
    }
  }

  if ("pixelCount" in normalized && normalized.pixelCount !== undefined) {
    normalized.pixelCount = assertPositiveInteger(normalized.pixelCount, "ImageRecord.derived.pixelCount");
  }

  if ("megapixels" in normalized && normalized.megapixels !== undefined) {
    normalized.megapixels = assertPositiveNumber(normalized.megapixels, "ImageRecord.derived.megapixels");
  }

  return Object.freeze(normalized) as ImageDerivedAttributesRecord;
}
