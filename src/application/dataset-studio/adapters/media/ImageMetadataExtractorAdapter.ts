import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import type {
  IImageDimensionReader,
  IImageExifReader,
  IImageFormatDetector,
  IImageMetadataExtractor,
  ImageExifMetadata,
  ImageMetadataExtractionResult,
} from "@domain/dataset-studio/interfaces/ImageMetadataExtraction";
import { ImageSizeDimensionReaderAdapter } from "./ImageDimensionReaderAdapter";
import { FileTypeImageFormatDetectorAdapter } from "./ImageFormatDetectorAdapter";

type ExifrParseFn = (input: Uint8Array, options?: Readonly<Record<string, unknown>>) => Promise<unknown>;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toIsoStringOrUndefined(value: unknown): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const normalized = normalizeOptional(value);
    return normalized;
  }
  return undefined;
}

function toCanonicalRecordValue(value: unknown): CanonicalRecordValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => toCanonicalRecordValue(entry)));
  }
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toCanonicalRecordValue(entry)]),
    ));
  }
  return String(value);
}

function toAdditionalExifMetadata(exif?: ImageExifMetadata): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!exif) {
    return undefined;
  }

  const entries = Object.entries({
    Make: exif.make,
    Model: exif.model,
    LensModel: exif.lensModel,
    DateTimeOriginal: exif.dateTimeOriginal,
    Orientation: exif.orientation,
    GPSLatitude: exif.gpsLatitude,
    GPSLongitude: exif.gpsLongitude,
  }).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(entries.map(([key, value]) => [key, toCanonicalRecordValue(value)])));
}

export class ExifrImageExifReaderAdapter implements IImageExifReader {
  public async readExif(payload: Uint8Array): Promise<ImageExifMetadata | undefined> {
    let parseFn: ExifrParseFn | undefined;
    try {
      const exifrRecord = await import("exifr") as Readonly<Record<string, unknown>>;
      parseFn = exifrRecord.parse as ExifrParseFn | undefined;
    } catch {
      parseFn = undefined;
    }

    if (!parseFn) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = await parseFn(payload, { translateValues: false });
    } catch {
      return undefined;
    }

    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    const record = parsed as Record<string, unknown>;

    const exif: ImageExifMetadata = Object.freeze({
      make: normalizeOptional(typeof record.Make === "string" ? record.Make : undefined),
      model: normalizeOptional(typeof record.Model === "string" ? record.Model : undefined),
      lensModel: normalizeOptional(typeof record.LensModel === "string" ? record.LensModel : undefined),
      dateTimeOriginal: toIsoStringOrUndefined(record.DateTimeOriginal),
      orientation: toNumberOrUndefined(record.Orientation),
      gpsLatitude: toNumberOrUndefined(record.GPSLatitude),
      gpsLongitude: toNumberOrUndefined(record.GPSLongitude),
    });

    return Object.values(exif).some((entry) => entry !== undefined) ? exif : undefined;
  }
}

export interface ImageMetadataExtractorAdapterOptions {
  readonly formatDetector?: IImageFormatDetector;
  readonly dimensionReader?: IImageDimensionReader;
  readonly exifReader?: IImageExifReader;
}

export class ImageMetadataExtractorAdapter implements IImageMetadataExtractor {
  private readonly formatDetector: IImageFormatDetector;
  private readonly dimensionReader: IImageDimensionReader;
  private readonly exifReader: IImageExifReader;

  constructor(options: ImageMetadataExtractorAdapterOptions = {}) {
    this.formatDetector = options.formatDetector ?? new FileTypeImageFormatDetectorAdapter();
    this.dimensionReader = options.dimensionReader ?? new ImageSizeDimensionReaderAdapter();
    this.exifReader = options.exifReader ?? new ExifrImageExifReaderAdapter();
  }

  public async extract(payload: Uint8Array): Promise<ImageMetadataExtractionResult> {
    const [dimensions, formatHint, exif] = await Promise.all([
      this.dimensionReader.readDimensions(payload),
      this.formatDetector.detect(payload),
      this.exifReader.readExif(payload),
    ]);

    return Object.freeze({
      dimensions,
      formatHint,
      orientation: exif?.orientation,
      exif,
      additionalMetadata: toAdditionalExifMetadata(exif),
    });
  }
}

