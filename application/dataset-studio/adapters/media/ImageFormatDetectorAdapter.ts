import type {
  IImageFormatDetector,
  ImageFormatHint,
} from "../../../../domain/dataset-studio/interfaces/ImageMetadataExtraction";

interface FileTypeResult {
  readonly ext?: string;
  readonly mime?: string;
}

type FileTypeFromBuffer = (buffer: Uint8Array) => Promise<FileTypeResult | undefined>;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeExtension(value?: string): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return normalized.startsWith(".") ? normalized.slice(1) : normalized;
}

function normalizeMimeType(value?: string): string | undefined {
  return normalizeOptional(value)?.toLowerCase();
}

export class FileTypeImageFormatDetectorAdapter implements IImageFormatDetector {
  public async detect(payload: Uint8Array): Promise<ImageFormatHint | undefined> {
    let detector: FileTypeFromBuffer | undefined;
    try {
      const fileTypeRecord = await import("file-type") as Readonly<Record<string, unknown>>;
      detector = fileTypeRecord.fileTypeFromBuffer as FileTypeFromBuffer | undefined;
    } catch {
      detector = undefined;
    }

    if (!detector) {
      return undefined;
    }

    const result = await detector(payload);
    if (!result) {
      return undefined;
    }

    const format = normalizeExtension(result.ext);
    const mimeType = normalizeMimeType(result.mime);
    if (!format && !mimeType) {
      return undefined;
    }

    return Object.freeze({
      format,
      mimeType,
    });
  }
}
