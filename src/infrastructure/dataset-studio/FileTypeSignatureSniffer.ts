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

function detectFallbackSignature(payload: Uint8Array): FileTypeResult | undefined {
  if (
    payload.length >= 8
    && payload[0] === 0x89
    && payload[1] === 0x50
    && payload[2] === 0x4e
    && payload[3] === 0x47
    && payload[4] === 0x0d
    && payload[5] === 0x0a
    && payload[6] === 0x1a
    && payload[7] === 0x0a
  ) {
    return Object.freeze({ ext: "png", mime: "image/png" });
  }
  if (payload.length >= 3 && payload[0] === 0xff && payload[1] === 0xd8 && payload[2] === 0xff) {
    return Object.freeze({ ext: "jpg", mime: "image/jpeg" });
  }
  if (
    payload.length >= 4
    && payload[0] === 0x47
    && payload[1] === 0x49
    && payload[2] === 0x46
    && payload[3] === 0x38
  ) {
    return Object.freeze({ ext: "gif", mime: "image/gif" });
  }
  return undefined;
}

export class FileTypeSignatureSniffer implements IUnifiedIngestionFileSignatureSniffer {
  public async sniff(payload: Uint8Array): Promise<UnifiedIngestionFileSignature | undefined> {
    const detector = await resolveFileTypeFromBuffer();
    const result = detector ? await detector(payload) : detectFallbackSignature(payload);
    const normalized = result ?? detectFallbackSignature(payload);
    if (!normalized) {
      return undefined;
    }

    return Object.freeze({
      extension: normalizeExtension(normalized.ext),
      mimeType: normalizeMimeType(normalized.mime),
      detector: "file-type",
    });
  }
}
