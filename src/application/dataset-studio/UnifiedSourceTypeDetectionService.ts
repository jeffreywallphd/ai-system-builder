import {
  UnifiedIngestionContractVersion,
  UnifiedIngestionDetectionConfidenceLevels,
  UnifiedIngestionEvidenceKinds,
  UnifiedIngestionSourceKinds,
  type IUnifiedIngestionFileSignatureSniffer,
  type IUnifiedIngestionSourceTypeDetector,
  type UnifiedIngestionDetectionRequest,
  type UnifiedIngestionDetectionResult,
  type UnifiedIngestionNormalizedSourceMetadata,
  type UnifiedIngestionSourceDetectionEvidence,
  type UnifiedIngestionSourceKind,
} from "@domain/dataset-studio/UnifiedIngestionDomain";

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

function inferFileName(reference: string): string | undefined {
  const normalized = reference.trim().replace(/[?#].*$/, "");
  if (!normalized) {
    return undefined;
  }
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.at(-1);
}

function inferExtensionFromName(fileName?: string): string | undefined {
  const name = normalizeOptional(fileName)?.toLowerCase();
  if (!name) {
    return undefined;
  }
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) {
    return undefined;
  }
  return name.slice(index);
}

function extensionToKind(extension?: string): UnifiedIngestionSourceKind | undefined {
  switch (extension) {
    case ".csv":
    case ".tsv":
      return UnifiedIngestionSourceKinds.csv;
    case ".json":
    case ".jsonl":
      return UnifiedIngestionSourceKinds.json;
    case ".pdf":
    case ".txt":
    case ".md":
    case ".rtf":
    case ".doc":
    case ".docx":
      return UnifiedIngestionSourceKinds.document;
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".webp":
    case ".gif":
    case ".bmp":
    case ".tif":
    case ".tiff":
      return UnifiedIngestionSourceKinds.image;
    default:
      return undefined;
  }
}

function mimeToKind(mimeType?: string): UnifiedIngestionSourceKind | undefined {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) {
    return undefined;
  }
  if (normalized === "text/csv") {
    return UnifiedIngestionSourceKinds.csv;
  }
  if (normalized === "application/json" || normalized === "application/x-ndjson") {
    return UnifiedIngestionSourceKinds.json;
  }
  if (normalized === "application/pdf" || normalized.startsWith("text/")) {
    return UnifiedIngestionSourceKinds.document;
  }
  if (normalized.startsWith("image/")) {
    return UnifiedIngestionSourceKinds.image;
  }
  return undefined;
}

function bytesToText(payload: Uint8Array): string {
  return new TextDecoder().decode(payload);
}

function sniffKindFromBinarySignature(payload: Uint8Array): UnifiedIngestionSourceKind | undefined {
  if (payload.length >= 5 && payload[0] === 0x25 && payload[1] === 0x50 && payload[2] === 0x44 && payload[3] === 0x46 && payload[4] === 0x2d) {
    return UnifiedIngestionSourceKinds.document;
  }
  if (
    payload.length >= 8
    && payload[0] === 0x89
    && payload[1] === 0x50
    && payload[2] === 0x4e
    && payload[3] === 0x47
  ) {
    return UnifiedIngestionSourceKinds.image;
  }
  if (payload.length >= 3 && payload[0] === 0xff && payload[1] === 0xd8 && payload[2] === 0xff) {
    return UnifiedIngestionSourceKinds.image;
  }
  if (payload.length >= 4 && payload[0] === 0x47 && payload[1] === 0x49 && payload[2] === 0x46 && payload[3] === 0x38) {
    return UnifiedIngestionSourceKinds.image;
  }
  if (
    payload.length >= 12
    && payload[0] === 0x52
    && payload[1] === 0x49
    && payload[2] === 0x46
    && payload[3] === 0x46
    && payload[8] === 0x57
    && payload[9] === 0x45
    && payload[10] === 0x42
    && payload[11] === 0x50
  ) {
    return UnifiedIngestionSourceKinds.image;
  }
  return undefined;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || !(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function looksLikeCsv(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 6);
  if (lines.length < 2) {
    return false;
  }
  const delimiters: ReadonlyArray<"," | "\t" | ";" | "|"> = [",", "\t", ";", "|"];
  for (const delimiter of delimiters) {
    const counts = lines.map((line) => line.split(delimiter).length - 1);
    if (counts[0] < 1) {
      continue;
    }
    if (counts.every((count) => count === counts[0])) {
      return true;
    }
  }
  return false;
}

export class UnifiedSourceTypeDetectionService implements IUnifiedIngestionSourceTypeDetector {
  private readonly signatureSniffer?: IUnifiedIngestionFileSignatureSniffer;

  constructor(options?: { readonly signatureSniffer?: IUnifiedIngestionFileSignatureSniffer }) {
    this.signatureSniffer = options?.signatureSniffer;
  }

  public async detect(request: UnifiedIngestionDetectionRequest): Promise<UnifiedIngestionDetectionResult> {
    const source = request.source;
    const fileName = normalizeOptional(source.displayName) ?? inferFileName(source.reference);
    const extension = normalizeExtension(source.extension) ?? inferExtensionFromName(fileName);
    let mimeType = normalizeMimeType(source.mimeType);

    const mutableScores: Record<UnifiedIngestionSourceKind, number> = {
      csv: 0,
      json: 0,
      document: 0,
      image: 0,
      unknown: 0,
    };
    const evidence: UnifiedIngestionSourceDetectionEvidence[] = [];

    const addEvidence = (
      candidateKind: UnifiedIngestionSourceKind,
      kind: UnifiedIngestionSourceDetectionEvidence["kind"],
      message: string,
      weight: number,
      details?: Readonly<Record<string, unknown>>,
    ): void => {
      mutableScores[candidateKind] += weight;
      evidence.push(Object.freeze({
        kind,
        message,
        candidateKind,
        weight,
        details,
      }));
    };

    if (request.explicitSourceKind) {
      addEvidence(
        request.explicitSourceKind,
        UnifiedIngestionEvidenceKinds.explicitMetadata,
        `Explicit source kind '${request.explicitSourceKind}' provided by caller.`,
        120,
      );
    }

    if (extension) {
      const kind = extensionToKind(extension);
      if (kind) {
        addEvidence(
          kind,
          UnifiedIngestionEvidenceKinds.extensionHeuristic,
          `File extension '${extension}' maps to '${kind}'.`,
          45,
          Object.freeze({ extension }),
        );
      }
    }

    if (mimeType) {
      const kind = mimeToKind(mimeType);
      if (kind) {
        addEvidence(
          kind,
          UnifiedIngestionEvidenceKinds.mimeHeuristic,
          `MIME type '${mimeType}' maps to '${kind}'.`,
          40,
          Object.freeze({ mimeType }),
        );
      }
    }

    let payloadBytes: Uint8Array | undefined;
    if (request.payload !== undefined) {
      payloadBytes = typeof request.payload === "string"
        ? new TextEncoder().encode(request.payload)
        : request.payload;
    }

    if (payloadBytes && payloadBytes.length > 0 && this.signatureSniffer) {
      const sniffed = await this.signatureSniffer.sniff(payloadBytes);
      if (sniffed) {
        const sniffedExtension = normalizeExtension(sniffed.extension);
        const sniffedMime = normalizeMimeType(sniffed.mimeType);
        if (!mimeType && sniffedMime) {
          mimeType = sniffedMime;
        }

        const kindFromSignature = extensionToKind(sniffedExtension) ?? mimeToKind(sniffedMime);
        if (kindFromSignature) {
          addEvidence(
            kindFromSignature,
            UnifiedIngestionEvidenceKinds.signatureSniff,
            `Binary signature detected by '${sniffed.detector}'.`,
            70,
            Object.freeze({
              detector: sniffed.detector,
              extension: sniffedExtension,
              mimeType: sniffedMime,
            }),
          );
        }
      }
    }

    const shouldSniffContent = request.enableContentSniffing !== false;
    if (payloadBytes && payloadBytes.length > 0 && shouldSniffContent) {
      const binaryKind = sniffKindFromBinarySignature(payloadBytes);
      if (binaryKind) {
        addEvidence(
          binaryKind,
          UnifiedIngestionEvidenceKinds.contentSniff,
          "Binary content signature matched a known source kind.",
          60,
        );
      }

      const textSample = bytesToText(payloadBytes.slice(0, 32_768));
      if (looksLikeJson(textSample)) {
        addEvidence(
          UnifiedIngestionSourceKinds.json,
          UnifiedIngestionEvidenceKinds.contentSniff,
          "Content sample is valid JSON.",
          110,
        );
      } else if (looksLikeCsv(textSample)) {
        addEvidence(
          UnifiedIngestionSourceKinds.csv,
          UnifiedIngestionEvidenceKinds.contentSniff,
          "Content sample resembles a delimited table.",
          35,
        );
      }
    }

    const scoreEntries = Object.entries(mutableScores)
      .filter(([key]) => key !== UnifiedIngestionSourceKinds.unknown)
      .sort((left, right) => right[1] - left[1]) as ReadonlyArray<[UnifiedIngestionSourceKind, number]>;

    const [topKind, topScore] = scoreEntries[0] ?? [UnifiedIngestionSourceKinds.unknown, 0];
    const secondScore = scoreEntries[1]?.[1] ?? 0;
    let detectedKind: UnifiedIngestionSourceKind = topKind;

    if (topScore <= 0) {
      detectedKind = UnifiedIngestionSourceKinds.unknown;
      addEvidence(
        UnifiedIngestionSourceKinds.unknown,
        UnifiedIngestionEvidenceKinds.fallback,
        "No reliable detection signal was available.",
        1,
      );
    } else if (secondScore > 0 && Math.abs(topScore - secondScore) <= 10) {
      addEvidence(
        topKind,
        UnifiedIngestionEvidenceKinds.conflictResolution,
        "Conflicting detection signals were resolved by score priority.",
        5,
        Object.freeze({ topScore, secondScore }),
      );
    }

    const confidence = (() => {
      if (detectedKind === UnifiedIngestionSourceKinds.unknown) {
        return UnifiedIngestionDetectionConfidenceLevels.low;
      }
      const gap = topScore - secondScore;
      if (topScore >= 90 && gap >= 20) {
        return UnifiedIngestionDetectionConfidenceLevels.high;
      }
      if (topScore >= 45 && gap >= 5) {
        return UnifiedIngestionDetectionConfidenceLevels.medium;
      }
      return UnifiedIngestionDetectionConfidenceLevels.low;
    })();

    const candidateScores = Object.freeze({
      csv: mutableScores.csv,
      json: mutableScores.json,
      document: mutableScores.document,
      image: mutableScores.image,
      unknown: mutableScores.unknown,
    });

    const normalizedMetadata: UnifiedIngestionNormalizedSourceMetadata = Object.freeze({
      fileName,
      extension,
      mimeType,
      sizeInBytes: source.sizeInBytes,
    });

    return Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      source,
      detectedKind,
      confidence,
      normalizedMetadata,
      candidateScores,
      evidence: Object.freeze(evidence),
    });
  }
}

export function createUnifiedSourceTypeDetectionService(options?: {
  readonly signatureSniffer?: IUnifiedIngestionFileSignatureSniffer;
}): IUnifiedIngestionSourceTypeDetector {
  return new UnifiedSourceTypeDetectionService(options);
}
