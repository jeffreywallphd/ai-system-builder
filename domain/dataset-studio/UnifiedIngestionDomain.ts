import type { CanonicalDataShapeKind } from "./CanonicalDataShapes";

export const UnifiedIngestionContractVersion = "1.0.0";

export const UnifiedIngestionSourceKinds = Object.freeze({
  csv: "csv",
  json: "json",
  document: "document",
  image: "image",
  unknown: "unknown",
} as const);

export type UnifiedIngestionSourceKind = typeof UnifiedIngestionSourceKinds[keyof typeof UnifiedIngestionSourceKinds];

export const UnifiedIngestionReferenceKinds = Object.freeze({
  localPath: "local-path",
  remoteUrl: "remote-url",
  fileHandle: "file-handle",
  inMemory: "in-memory",
} as const);

export type UnifiedIngestionReferenceKind = typeof UnifiedIngestionReferenceKinds[keyof typeof UnifiedIngestionReferenceKinds];

export const UnifiedIngestionConfigModes = Object.freeze({
  simple: "simple",
  advanced: "advanced",
} as const);

export type UnifiedIngestionConfigMode = typeof UnifiedIngestionConfigModes[keyof typeof UnifiedIngestionConfigModes];

export const UnifiedIngestionOutputTargetKinds = Object.freeze({
  records: "canonical-records",
  textItems: "canonical-text-items",
  imageMetadataRecords: "canonical-image-metadata-records",
} as const);

export type UnifiedIngestionOutputTargetKind =
  typeof UnifiedIngestionOutputTargetKinds[keyof typeof UnifiedIngestionOutputTargetKinds];

export const UnifiedIngestionDetectionConfidenceLevels = Object.freeze({
  low: "low",
  medium: "medium",
  high: "high",
} as const);

export type UnifiedIngestionDetectionConfidenceLevel =
  typeof UnifiedIngestionDetectionConfidenceLevels[keyof typeof UnifiedIngestionDetectionConfidenceLevels];

export const UnifiedIngestionEvidenceKinds = Object.freeze({
  explicitMetadata: "explicit-metadata",
  extensionHeuristic: "extension-heuristic",
  mimeHeuristic: "mime-heuristic",
  signatureSniff: "signature-sniff",
  contentSniff: "content-sniff",
  conflictResolution: "conflict-resolution",
  fallback: "fallback",
} as const);

export type UnifiedIngestionEvidenceKind = typeof UnifiedIngestionEvidenceKinds[keyof typeof UnifiedIngestionEvidenceKinds];

export const UnifiedIngestionIssueSeverities = Object.freeze({
  warning: "warning",
  error: "error",
} as const);

export type UnifiedIngestionIssueSeverity = typeof UnifiedIngestionIssueSeverities[keyof typeof UnifiedIngestionIssueSeverities];

export const UnifiedIngestionIssueCodes = Object.freeze({
  invalidSourceReference: "invalid-source-reference",
  unsupportedSourceType: "unsupported-source-type",
  detectionConflict: "detection-conflict",
  detectionFailed: "detection-failed",
  routingUnsupported: "routing-unsupported",
  routingUnavailable: "routing-unavailable",
  ingestionFailed: "ingestion-failed",
  conversionFailed: "conversion-failed",
  sourceReadFailed: "source-read-failed",
} as const);

export type UnifiedIngestionIssueCode = typeof UnifiedIngestionIssueCodes[keyof typeof UnifiedIngestionIssueCodes];

export interface UnifiedIngestionSourceReference {
  readonly sourceId: string;
  readonly referenceKind: UnifiedIngestionReferenceKind;
  readonly reference: string;
  readonly displayName?: string;
  readonly extension?: string;
  readonly mimeType?: string;
  readonly sizeInBytes?: number;
  readonly groupId?: string;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export interface UnifiedIngestionInputReferenceCollection {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly sources: ReadonlyArray<UnifiedIngestionSourceReference>;
}

export interface UnifiedIngestionSimpleConfiguration {
  readonly mode: typeof UnifiedIngestionConfigModes.simple;
  readonly outputTarget: UnifiedIngestionOutputTargetKind;
  readonly previewSampleLimit?: number;
}

export interface UnifiedIngestionAdvancedConfiguration {
  readonly mode: typeof UnifiedIngestionConfigModes.advanced;
  readonly outputTarget: UnifiedIngestionOutputTargetKind;
  readonly explicitSourceKind?: Exclude<UnifiedIngestionSourceKind, "unknown">;
  readonly delimiterHint?: string;
  readonly textEncoding?: string;
  readonly normalizeHeadersToLowercase?: boolean;
  readonly flattenJson?: boolean;
  readonly flattenJsonDepth?: number;
  readonly documentMaxPages?: number;
  readonly imageExtractExif?: boolean;
  readonly imageNormalizeOrientation?: boolean;
  readonly enableContentSniffing?: boolean;
}

export type UnifiedIngestionConfiguration = UnifiedIngestionSimpleConfiguration | UnifiedIngestionAdvancedConfiguration;

export interface UnifiedIngestionOutputTargetDescriptor {
  readonly target: UnifiedIngestionOutputTargetKind;
  readonly canonicalShapeKind: CanonicalDataShapeKind;
  readonly description: string;
}

export interface UnifiedIngestionSourceDetectionEvidence {
  readonly kind: UnifiedIngestionEvidenceKind;
  readonly message: string;
  readonly candidateKind: UnifiedIngestionSourceKind;
  readonly weight: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface UnifiedIngestionNormalizedSourceMetadata {
  readonly fileName?: string;
  readonly extension?: string;
  readonly mimeType?: string;
  readonly sizeInBytes?: number;
}

export interface UnifiedIngestionDetectionRequest {
  readonly source: UnifiedIngestionSourceReference;
  readonly payload?: string | Uint8Array;
  readonly explicitSourceKind?: Exclude<UnifiedIngestionSourceKind, "unknown">;
  readonly enableContentSniffing?: boolean;
}

export interface UnifiedIngestionDetectionResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly source: UnifiedIngestionSourceReference;
  readonly detectedKind: UnifiedIngestionSourceKind;
  readonly confidence: UnifiedIngestionDetectionConfidenceLevel;
  readonly normalizedMetadata: UnifiedIngestionNormalizedSourceMetadata;
  readonly candidateScores: Readonly<Record<UnifiedIngestionSourceKind, number>>;
  readonly evidence: ReadonlyArray<UnifiedIngestionSourceDetectionEvidence>;
}

export interface UnifiedIngestionPreviewResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly source: UnifiedIngestionSourceReference;
  readonly detection: UnifiedIngestionDetectionResult;
  readonly outputTarget: UnifiedIngestionOutputTargetKind;
  readonly summary: {
    readonly sampleCount: number;
    readonly truncated: boolean;
    readonly sourceCount: number;
  };
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}

export interface UnifiedIngestionIssue {
  readonly code: UnifiedIngestionIssueCode;
  readonly severity: UnifiedIngestionIssueSeverity;
  readonly message: string;
  readonly sourceId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface UnifiedIngestionExecutionSuccess {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly ok: true;
  readonly source: UnifiedIngestionSourceReference;
  readonly detection: UnifiedIngestionDetectionResult;
  readonly outputTarget: UnifiedIngestionOutputTargetKind;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}

export interface UnifiedIngestionExecutionFailure {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly ok: false;
  readonly source: UnifiedIngestionSourceReference;
  readonly detection?: UnifiedIngestionDetectionResult;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}

export type UnifiedIngestionExecutionResult = UnifiedIngestionExecutionSuccess | UnifiedIngestionExecutionFailure;

export interface UnifiedIngestionFileSignature {
  readonly extension?: string;
  readonly mimeType?: string;
  readonly detector: string;
}

export interface IUnifiedIngestionFileSignatureSniffer {
  sniff(payload: Uint8Array): Promise<UnifiedIngestionFileSignature | undefined>;
}

export interface IUnifiedIngestionSourceTypeDetector {
  detect(request: UnifiedIngestionDetectionRequest): Promise<UnifiedIngestionDetectionResult>;
}

export const UnifiedIngestionRoutePolicyKinds = Object.freeze({
  detectedKind: "detected-kind",
  outputTargetFallback: "output-target-fallback",
} as const);

export type UnifiedIngestionRoutePolicyKind =
  typeof UnifiedIngestionRoutePolicyKinds[keyof typeof UnifiedIngestionRoutePolicyKinds];

export const UnifiedIngestionRouteFailureCodes = Object.freeze({
  unsupportedSourceKind: "unsupported-source-kind",
  missingRouteMapping: "missing-route-mapping",
} as const);

export type UnifiedIngestionRouteFailureCode =
  typeof UnifiedIngestionRouteFailureCodes[keyof typeof UnifiedIngestionRouteFailureCodes];

export const UnifiedIngestionRouteHandlerKinds = Object.freeze({
  csv: "csv",
  json: "json",
  document: "document",
  image: "image",
} as const);

export type UnifiedIngestionRouteHandlerKind =
  typeof UnifiedIngestionRouteHandlerKinds[keyof typeof UnifiedIngestionRouteHandlerKinds];

export interface UnifiedIngestionRouteRequest {
  readonly source: UnifiedIngestionSourceReference;
  readonly detection: UnifiedIngestionDetectionResult;
  readonly configuration?: UnifiedIngestionConfiguration;
}

export interface UnifiedIngestionRouteResolution {
  readonly status: "resolved";
  readonly sourceKind: UnifiedIngestionSourceKind;
  readonly handlerKind: UnifiedIngestionRouteHandlerKind;
  readonly assetId: string;
  readonly assetVersion?: string;
  readonly policy: UnifiedIngestionRoutePolicyKind;
  readonly fallbackUsed: boolean;
  readonly reason: string;
}

export interface UnifiedIngestionRouteFailure {
  readonly status: "unsupported";
  readonly sourceKind: UnifiedIngestionSourceKind;
  readonly failureCode: UnifiedIngestionRouteFailureCode;
  readonly fallbackUsed: boolean;
  readonly reason: string;
}

export type UnifiedIngestionRouteResult = UnifiedIngestionRouteResolution | UnifiedIngestionRouteFailure;

export interface IUnifiedIngestionRouter {
  route(request: UnifiedIngestionRouteRequest): UnifiedIngestionRouteResult;
}

const UnifiedIngestionOutputTargets: ReadonlyArray<UnifiedIngestionOutputTargetDescriptor> = Object.freeze([
  Object.freeze({
    target: UnifiedIngestionOutputTargetKinds.records,
    canonicalShapeKind: "records",
    description: "Structured record output for CSV and JSON ingestion.",
  }),
  Object.freeze({
    target: UnifiedIngestionOutputTargetKinds.textItems,
    canonicalShapeKind: "text-items",
    description: "Text item output for document and PDF extraction.",
  }),
  Object.freeze({
    target: UnifiedIngestionOutputTargetKinds.imageMetadataRecords,
    canonicalShapeKind: "image-metadata-records",
    description: "Image metadata records output for multimodal image sources.",
  }),
]);

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

export function getUnifiedIngestionOutputTargets(): ReadonlyArray<UnifiedIngestionOutputTargetDescriptor> {
  return UnifiedIngestionOutputTargets;
}

export function normalizeUnifiedIngestionSourceReference(
  source: UnifiedIngestionSourceReference,
): UnifiedIngestionSourceReference {
  const sourceId = source.sourceId.trim();
  if (!sourceId) {
    throw new Error("Unified ingestion sources require a non-empty sourceId.");
  }
  const reference = source.reference.trim();
  if (!reference) {
    throw new Error("Unified ingestion sources require a non-empty reference.");
  }

  return Object.freeze({
    sourceId,
    referenceKind: source.referenceKind,
    reference,
    displayName: normalizeOptional(source.displayName),
    extension: normalizeExtension(source.extension),
    mimeType: normalizeMimeType(source.mimeType),
    sizeInBytes: source.sizeInBytes,
    groupId: normalizeOptional(source.groupId),
    sourceAssetId: normalizeOptional(source.sourceAssetId),
    sourceVersionId: normalizeOptional(source.sourceVersionId),
  });
}

export function createUnifiedIngestionInputCollection(input: {
  readonly sources: ReadonlyArray<UnifiedIngestionSourceReference>;
}): UnifiedIngestionInputReferenceCollection {
  if (input.sources.length === 0) {
    throw new Error("Unified ingestion input collections require at least one source.");
  }

  return Object.freeze({
    contractVersion: UnifiedIngestionContractVersion,
    sources: Object.freeze(input.sources.map((source) => normalizeUnifiedIngestionSourceReference(source))),
  });
}
