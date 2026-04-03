import type { CanonicalRecordValue } from "../CanonicalDataShapes";

export const ImageAnnotationCoordinateSpaces = Object.freeze({
  pixel: "pixel",
} as const);

export type ImageAnnotationCoordinateSpace =
  typeof ImageAnnotationCoordinateSpaces[keyof typeof ImageAnnotationCoordinateSpaces];

export interface ImageAnnotationRegionReference {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly coordinateSpace?: ImageAnnotationCoordinateSpace;
  readonly referenceId?: string;
}

export interface ImageAnnotations {
  readonly caption?: string;
  readonly description?: string;
  readonly note?: string;
  readonly labels: ReadonlyArray<string>;
  readonly region?: ImageAnnotationRegionReference;
}

export type ImageAnnotationsRecord =
  Readonly<Record<string, CanonicalRecordValue>>
  & ImageAnnotations;

const ImageAnnotationLimits = Object.freeze({
  maxCaptionLength: 500,
  maxDescriptionLength: 2000,
  maxNoteLength: 2000,
  maxLabels: 32,
  maxLabelLength: 100,
} as const);

function normalizeOptionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string when provided.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} exceeds maximum length of ${maxLength}.`);
  }
  return normalized;
}

function normalizeLabels(value: unknown): ReadonlyArray<string> {
  if (value === undefined || value === null) {
    return Object.freeze([]);
  }
  if (!Array.isArray(value)) {
    throw new Error("ImageRecord.annotations.labels must be an array when provided.");
  }
  const labels = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, ImageAnnotationLimits.maxLabelLength));
  if (labels.length > ImageAnnotationLimits.maxLabels) {
    throw new Error(`ImageRecord.annotations.labels exceeds maximum count of ${ImageAnnotationLimits.maxLabels}.`);
  }
  return Object.freeze([...new Set(labels)]);
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function assertNonNegativeNumber(value: unknown, label: string): number {
  const numeric = assertFiniteNumber(value, label);
  if (numeric < 0) {
    throw new Error(`${label} must be >= 0.`);
  }
  return numeric;
}

function assertPositiveNumber(value: unknown, label: string): number {
  const numeric = assertFiniteNumber(value, label);
  if (numeric <= 0) {
    throw new Error(`${label} must be > 0.`);
  }
  return numeric;
}

function normalizeRegion(
  value: unknown,
): ImageAnnotationRegionReference | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ImageRecord.annotations.region must be an object when provided.");
  }
  const candidate = value as Readonly<Record<string, unknown>>;
  const coordinateSpace = typeof candidate.coordinateSpace === "string"
    ? candidate.coordinateSpace.trim().toLowerCase()
    : undefined;
  if (
    coordinateSpace
    && coordinateSpace !== ImageAnnotationCoordinateSpaces.pixel
  ) {
    throw new Error("ImageRecord.annotations.region.coordinateSpace is unsupported.");
  }
  return Object.freeze({
    x: assertNonNegativeNumber(candidate.x, "ImageRecord.annotations.region.x"),
    y: assertNonNegativeNumber(candidate.y, "ImageRecord.annotations.region.y"),
    width: assertPositiveNumber(candidate.width, "ImageRecord.annotations.region.width"),
    height: assertPositiveNumber(candidate.height, "ImageRecord.annotations.region.height"),
    coordinateSpace: coordinateSpace as ImageAnnotationCoordinateSpace | undefined,
    referenceId: normalizeOptionalText(
      candidate.referenceId,
      "ImageRecord.annotations.region.referenceId",
      ImageAnnotationLimits.maxLabelLength,
    ),
  });
}

function toCanonicalRecordValue(value: unknown): CanonicalRecordValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => toCanonicalRecordValue(entry)));
  }
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .map(([key, entry]) => [key, toCanonicalRecordValue(entry)]),
    ));
  }
  return String(value);
}

export function createImageAnnotations(
  input?: Readonly<Record<string, CanonicalRecordValue>>,
): ImageAnnotationsRecord | undefined {
  if (!input) {
    return undefined;
  }

  const caption = normalizeOptionalText(
    input.caption,
    "ImageRecord.annotations.caption",
    ImageAnnotationLimits.maxCaptionLength,
  );
  const description = normalizeOptionalText(
    input.description,
    "ImageRecord.annotations.description",
    ImageAnnotationLimits.maxDescriptionLength,
  );
  const note = normalizeOptionalText(
    input.note,
    "ImageRecord.annotations.note",
    ImageAnnotationLimits.maxNoteLength,
  );
  const labels = normalizeLabels(input.labels);
  const region = normalizeRegion(input.region);

  const hasContent = Boolean(caption || description || note || labels.length > 0 || region);
  if (!hasContent) {
    return undefined;
  }

  const normalized: Record<string, CanonicalRecordValue> = {};
  if (caption) {
    normalized.caption = caption;
  }
  if (description) {
    normalized.description = description;
  }
  if (note) {
    normalized.note = note;
  }
  if (labels.length > 0) {
    normalized.labels = labels;
  }
  if (region) {
    normalized.region = toCanonicalRecordValue(region);
  }

  return Object.freeze(normalized) as ImageAnnotationsRecord;
}
