import type {
  IUnifiedIngestionFileSignatureSniffer,
  UnifiedIngestionFileSignature,
} from "@domain/dataset-studio/UnifiedIngestionDomain";

interface FileTypeResult {
  readonly ext?: string;
  readonly mime?: string;
}

type FileTypeFromBuffer = (buffer: Uint8Array) => Promise<FileTypeResult | undefined>;

async function resolveFileTypeFromBuffer(): Promise<FileTypeFromBuffer | undefined> {
  try {
    const moduleRecord = await import("file-type") as Readonly<Record<string, unknown>>;
    const candidate = moduleRecord.fileTypeFromBuffer as FileTypeFromBuffer | undefined;
    if (typeof candidate === "function") {
      return candidate;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeExtension(value?: string): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

function normalizeMimeType(value?: string): string | undefined {
  return normalizeOptional(value)?.toLowerCase();
}

export class FileTypeSignatureSniffer implements IUnifiedIngestionFileSignatureSniffer {
  public async sniff(payload: Uint8Array): Promise<UnifiedIngestionFileSignature | undefined> {
    const detector = await resolveFileTypeFromBuffer();
    if (!detector) {
      return undefined;
    }

    const result = await detector(payload);
    if (!result) {
      return undefined;
    }

    return Object.freeze({
      extension: normalizeExtension(result.ext),
      mimeType: normalizeMimeType(result.mime),
      detector: "file-type",
    });
  }
}

