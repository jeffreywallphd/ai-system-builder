/// <reference types="node" />
import type { CanonicalDataShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  UnifiedIngestionContractVersion,
  UnifiedIngestionIssueCodes,
  UnifiedIngestionIssueSeverities,
  UnifiedIngestionLineageStageKinds,
  UnifiedIngestionLineageStageStatuses,
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionReferenceKinds,
  type IUnifiedIngestionRouter,
  type IUnifiedIngestionSourceTypeDetector,
  type UnifiedIngestionConfiguration,
  type UnifiedIngestionExecutionMetadata,
  type UnifiedIngestionIssue,
  type UnifiedIngestionLineageRecord,
  type UnifiedIngestionLineageStageRecord,
  type UnifiedIngestionNormalizedOutput,
  type UnifiedIngestionRouteResult,
  type UnifiedIngestionRouteResolution,
  type UnifiedIngestionSourceReference,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import {
  UnifiedIngestionExecutionStages,
  classifyUnifiedIngestionFailure,
  deriveUnifiedIngestionFallbackDecisions,
  type UnifiedIngestionExecutionStage,
  type UnifiedIngestionFailureClassification,
  type UnifiedIngestionFallbackDecision,
} from "./UnifiedIngestionFailurePolicy";
import {
  DataConverterOperationKinds,
  type DataConverterOperationContext,
  type DataConverterResult,
  type DataConverterSuccessResult,
} from "./DataConverterContracts";
import { DataConverterCore } from "./DataConverterCore";
import { CsvIngestorAsset, type CsvIngestorExecutionResult } from "./CsvIngestorAsset";
import { DocumentPdfIngestorAsset, type DocumentPdfIngestorExecutionResult } from "./DocumentPdfIngestorAsset";
import { ImageIngestorAsset, type ImageIngestorExecutionResult } from "./ImageIngestorAsset";
import { JsonIngestorAsset, type JsonIngestorExecutionResult } from "./JsonIngestorAsset";
import { resolveUnifiedIngestionConfiguration } from "./UnifiedIngestionConfiguration";
import {
  UnifiedIngestionNormalizationPipeline,
} from "./UnifiedIngestionNormalizationPipeline";
import {
  UnifiedIngestionPreviewService,
  type UnifiedIngestionPreviewSuccessResult,
} from "./UnifiedIngestionPreviewService";
import { createUnifiedIngestionRoutingService } from "./UnifiedIngestionRoutingService";
import { createUnifiedSourceTypeDetectionService } from "./UnifiedSourceTypeDetectionService";

interface NodeFsPromisesRuntime {
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

export interface UnifiedIngestionRequest {
  readonly source: UnifiedIngestionSourceReference;
  readonly payload?: string | Uint8Array;
  readonly configuration?: UnifiedIngestionConfiguration;
  readonly converterContext?: DataConverterOperationContext;
}

export interface UnifiedIngestionSuccessResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly ok: true;
  readonly source: UnifiedIngestionSourceReference;
  readonly outputTarget: UnifiedIngestionConfiguration["outputTarget"];
  readonly detection: Awaited<ReturnType<IUnifiedIngestionSourceTypeDetector["detect"]>>;
  readonly route: UnifiedIngestionRouteResolution;
  readonly output: CanonicalDataShape;
  readonly normalized: UnifiedIngestionNormalizedOutput;
  readonly metadata: UnifiedIngestionExecutionMetadata;
  readonly lineage: UnifiedIngestionLineageRecord;
  readonly conversion: {
    readonly operation: DataConverterSuccessResult["operation"];
    readonly inputBoundary: DataConverterSuccessResult["contract"]["inputBoundary"];
  };
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
  readonly fallbacks: ReadonlyArray<UnifiedIngestionFallbackDecision>;
}

export interface UnifiedIngestionFailureResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly ok: false;
  readonly source: UnifiedIngestionSourceReference;
  readonly stage: UnifiedIngestionExecutionStage;
  readonly detection?: Awaited<ReturnType<IUnifiedIngestionSourceTypeDetector["detect"]>>;
  readonly route?: UnifiedIngestionRouteResult;
  readonly metadata: UnifiedIngestionExecutionMetadata;
  readonly lineage: UnifiedIngestionLineageRecord;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
  readonly failure: UnifiedIngestionFailureClassification;
  readonly fallbacks: ReadonlyArray<UnifiedIngestionFallbackDecision>;
  readonly partial: {
    readonly detectionResolved: boolean;
    readonly routeResolved: boolean;
    readonly outputTarget?: UnifiedIngestionConfiguration["outputTarget"];
  };
}

export type UnifiedIngestionResult = UnifiedIngestionSuccessResult | UnifiedIngestionFailureResult;

export interface UnifiedIngestionPreviewSuccess extends UnifiedIngestionSuccessResult {
  readonly preview: UnifiedIngestionPreviewSuccessResult;
}

export type UnifiedIngestionPreviewResult = UnifiedIngestionPreviewSuccess | UnifiedIngestionFailureResult;

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

function buildIssue(input: {
  readonly code: UnifiedIngestionIssue["code"];
  readonly message: string;
  readonly sourceId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly severity?: UnifiedIngestionIssue["severity"];
}): UnifiedIngestionIssue {
  return Object.freeze({
    code: input.code,
    severity: input.severity ?? UnifiedIngestionIssueSeverities.error,
    message: input.message,
    sourceId: normalizeOptional(input.sourceId),
    details: input.details,
  });
}

function mapRouteKindToOutputTarget(
  route: UnifiedIngestionRouteResolution,
  configuration?: UnifiedIngestionConfiguration,
): UnifiedIngestionConfiguration["outputTarget"] {
  if (configuration?.outputTarget) {
    return configuration.outputTarget;
  }
  if (route.handlerKind === "document") {
    return UnifiedIngestionOutputTargetKinds.textItems;
  }
  if (route.handlerKind === "image") {
    return UnifiedIngestionOutputTargetKinds.imageMetadataRecords;
  }
  return UnifiedIngestionOutputTargetKinds.records;
}

function toErrorType(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return "Error";
  }
  return "unknown";
}

function nowIso(): string {
  return new Date().toISOString();
}

function createLineageId(sourceId: string): string {
  const compactSourceId = sourceId.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 64) || "source";
  const suffix = Date.now().toString(36);
  return `unified-lineage-${compactSourceId}-${suffix}`;
}

function summarizeShapeCounts(shape?: CanonicalDataShape): {
  readonly totalCount: number;
  readonly recordCount: number;
  readonly textItemCount: number;
  readonly imageItemCount: number;
} {
  if (!shape) {
    return Object.freeze({
      totalCount: 0,
      recordCount: 0,
      textItemCount: 0,
      imageItemCount: 0,
    });
  }
  if (shape.kind === "records") {
    return Object.freeze({
      totalCount: shape.records.length,
      recordCount: shape.records.length,
      textItemCount: 0,
      imageItemCount: 0,
    });
  }
  if (shape.kind === "text-items") {
    return Object.freeze({
      totalCount: shape.items.length,
      recordCount: 0,
      textItemCount: shape.items.length,
      imageItemCount: 0,
    });
  }
  if (shape.kind === "image-metadata-records") {
    return Object.freeze({
      totalCount: shape.items.length,
      recordCount: 0,
      textItemCount: 0,
      imageItemCount: shape.items.length,
    });
  }
  return Object.freeze({
    totalCount: shape.rows.length,
    recordCount: shape.rows.length,
    textItemCount: 0,
    imageItemCount: 0,
  });
}

function buildRouteMetadata(route?: UnifiedIngestionRouteResult): UnifiedIngestionExecutionMetadata["route"] | undefined {
  if (!route) {
    return undefined;
  }
  if (route.status === "resolved") {
    return Object.freeze({
      status: route.status,
      sourceKind: route.sourceKind,
      handlerKind: route.handlerKind,
      assetId: route.assetId,
      assetVersion: route.assetVersion,
      policy: route.policy,
      fallbackUsed: route.fallbackUsed,
    });
  }
  return Object.freeze({
    status: route.status,
    sourceKind: route.sourceKind,
    fallbackUsed: route.fallbackUsed,
  });
}

function buildExecutionMetadata(input: {
  readonly source: UnifiedIngestionSourceReference;
  readonly configuration: UnifiedIngestionConfiguration;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
  readonly fallbacks: ReadonlyArray<UnifiedIngestionFallbackDecision>;
  readonly stages: ReadonlyArray<UnifiedIngestionLineageStageRecord>;
  readonly detection?: Awaited<ReturnType<IUnifiedIngestionSourceTypeDetector["detect"]>>;
  readonly route?: UnifiedIngestionRouteResult;
  readonly conversion?: UnifiedIngestionSuccessResult["conversion"];
  readonly normalized?: UnifiedIngestionNormalizedOutput;
  readonly preview?: UnifiedIngestionPreviewSuccessResult;
}): UnifiedIngestionExecutionMetadata {
  const counts = summarizeShapeCounts(input.normalized?.normalizedPayload);
  const warningCount = input.issues.filter((issue) => issue.severity === UnifiedIngestionIssueSeverities.warning).length;
  const errorCount = input.issues.filter((issue) => issue.severity === UnifiedIngestionIssueSeverities.error).length;
  return Object.freeze({
    contractVersion: UnifiedIngestionContractVersion,
    metadataVersion: "1.0.0",
    source: Object.freeze({
      sourceId: input.source.sourceId,
      reference: input.source.reference,
      referenceKind: input.source.referenceKind,
      displayName: input.source.displayName,
      extension: input.source.extension,
      mimeType: input.source.mimeType,
      sizeInBytes: input.source.sizeInBytes,
      sourceAssetId: input.source.sourceAssetId,
      sourceVersionId: input.source.sourceVersionId,
      groupId: input.source.groupId,
    }),
    detection: input.detection
      ? Object.freeze({
        detectedKind: input.detection.detectedKind,
        confidence: input.detection.confidence,
        candidateScores: input.detection.candidateScores,
        evidenceCount: input.detection.evidence.length,
        normalizedMetadata: input.detection.normalizedMetadata,
      })
      : undefined,
    route: buildRouteMetadata(input.route),
    conversion: input.conversion
      ? Object.freeze({
        operation: input.conversion.operation,
        inputBoundary: input.conversion.inputBoundary,
        outputKind: input.normalized?.canonicalOutputKind,
      })
      : undefined,
    normalization: input.normalized
      ? Object.freeze({
        normalizationVersion: input.normalized.normalizationVersion,
        outputTarget: input.normalized.metadata.outputTarget,
        canonicalOutputKind: input.normalized.canonicalOutputKind,
        totalCount: input.normalized.metadata.totalCount,
        isEmpty: input.normalized.metadata.isEmpty,
        recordCount: counts.recordCount || undefined,
        textItemCount: counts.textItemCount || undefined,
        imageItemCount: counts.imageItemCount || undefined,
      })
      : undefined,
    preview: input.preview
      ? Object.freeze({
        degraded: input.preview.degraded,
        totalCount: input.preview.summary.totalCount,
        sampleCount: input.preview.summary.sampleCount,
        truncated: input.preview.summary.truncated,
        outputKind: input.preview.outputKind,
      })
      : undefined,
    processing: Object.freeze({
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      configurationMode: input.configuration.mode,
      outputTarget: input.configuration.outputTarget,
      stageCount: input.stages.length,
      warningCount,
      errorCount,
      fallbackCount: input.fallbacks.length,
    }),
  });
}

function buildLineageRecord(input: {
  readonly lineageId: string;
  readonly capturedAt: string;
  readonly source: UnifiedIngestionSourceReference;
  readonly stages: ReadonlyArray<UnifiedIngestionLineageStageRecord>;
  readonly metadata: UnifiedIngestionExecutionMetadata;
}): UnifiedIngestionLineageRecord {
  return Object.freeze({
    contractVersion: UnifiedIngestionContractVersion,
    lineageVersion: "1.0.0",
    lineageId: input.lineageId,
    capturedAt: input.capturedAt,
    source: Object.freeze({
      sourceId: input.source.sourceId,
      reference: input.source.reference,
      referenceKind: input.source.referenceKind,
      displayName: input.source.displayName,
      sourceAssetId: input.source.sourceAssetId,
      sourceVersionId: input.source.sourceVersionId,
    }),
    stages: input.stages,
    detection: input.metadata.detection,
    route: input.metadata.route,
    conversion: input.metadata.conversion,
    normalization: input.metadata.normalization,
    preview: input.metadata.preview,
  });
}

export class UnifiedIngestionOrchestrationService {
  private readonly detector: IUnifiedIngestionSourceTypeDetector;
  private readonly router: IUnifiedIngestionRouter;
  private readonly converter: DataConverterCore;
  private readonly csvIngestor: CsvIngestorAsset;
  private readonly jsonIngestor: JsonIngestorAsset;
  private readonly documentIngestor: DocumentPdfIngestorAsset;
  private readonly imageIngestor: ImageIngestorAsset;
  private readonly normalizationPipeline: UnifiedIngestionNormalizationPipeline;
  private readonly previewService: UnifiedIngestionPreviewService;

  constructor(options?: {
    readonly detector?: IUnifiedIngestionSourceTypeDetector;
    readonly router?: IUnifiedIngestionRouter;
    readonly converter?: DataConverterCore;
    readonly csvIngestor?: CsvIngestorAsset;
    readonly jsonIngestor?: JsonIngestorAsset;
    readonly documentIngestor?: DocumentPdfIngestorAsset;
    readonly imageIngestor?: ImageIngestorAsset;
    readonly normalizationPipeline?: UnifiedIngestionNormalizationPipeline;
    readonly previewService?: UnifiedIngestionPreviewService;
  }) {
    this.detector = options?.detector ?? createUnifiedSourceTypeDetectionService();
    this.router = options?.router ?? createUnifiedIngestionRoutingService();
    this.converter = options?.converter ?? new DataConverterCore();
    this.csvIngestor = options?.csvIngestor ?? new CsvIngestorAsset();
    this.jsonIngestor = options?.jsonIngestor ?? new JsonIngestorAsset();
    this.documentIngestor = options?.documentIngestor ?? new DocumentPdfIngestorAsset();
    this.imageIngestor = options?.imageIngestor ?? new ImageIngestorAsset();
    this.normalizationPipeline = options?.normalizationPipeline ?? new UnifiedIngestionNormalizationPipeline();
    this.previewService = options?.previewService ?? new UnifiedIngestionPreviewService();
  }

  private buildFailureResult(input: {
    readonly source: UnifiedIngestionSourceReference;
    readonly configuration: UnifiedIngestionConfiguration;
    readonly lineageId: string;
    readonly startedAt: string;
    readonly stage: UnifiedIngestionExecutionStage;
    readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
    readonly stages: ReadonlyArray<UnifiedIngestionLineageStageRecord>;
    readonly detection?: Awaited<ReturnType<IUnifiedIngestionSourceTypeDetector["detect"]>>;
    readonly route?: UnifiedIngestionRouteResult;
    readonly outputTarget?: UnifiedIngestionConfiguration["outputTarget"];
  }): UnifiedIngestionFailureResult {
    const completedAt = nowIso();
    const fallbacks = deriveUnifiedIngestionFallbackDecisions({
      detection: input.detection,
      route: input.route,
      includePartialMetadataFallback: Boolean(input.detection || input.route || input.outputTarget),
    });
    const metadata = buildExecutionMetadata({
      source: input.source,
      configuration: input.configuration,
      startedAt: input.startedAt,
      completedAt,
      issues: input.issues,
      fallbacks,
      stages: input.stages,
      detection: input.detection,
      route: input.route,
    });
    const lineage = buildLineageRecord({
      lineageId: input.lineageId,
      capturedAt: completedAt,
      source: input.source,
      stages: input.stages,
      metadata,
    });
    return Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      ok: false,
      source: input.source,
      stage: input.stage,
      detection: input.detection,
      route: input.route,
      metadata,
      lineage,
      issues: input.issues,
      failure: classifyUnifiedIngestionFailure({
        stage: input.stage,
        issues: input.issues,
      }),
      fallbacks,
      partial: Object.freeze({
        detectionResolved: Boolean(input.detection),
        routeResolved: Boolean(input.route),
        outputTarget: input.outputTarget,
      }),
    });
  }

  public async ingest(request: UnifiedIngestionRequest): Promise<UnifiedIngestionResult> {
    const startedAt = nowIso();
    const lineageId = createLineageId(request.source.sourceId);
    const stageRecords: UnifiedIngestionLineageStageRecord[] = [];
    const appendStage = (input: {
      readonly stage: UnifiedIngestionLineageStageRecord["stage"];
      readonly status: UnifiedIngestionLineageStageRecord["status"];
      readonly startedAt?: string;
      readonly issues?: ReadonlyArray<UnifiedIngestionIssue>;
      readonly details?: Readonly<Record<string, unknown>>;
    }): void => {
      stageRecords.push(Object.freeze({
        stage: input.stage,
        status: input.status,
        startedAt: input.startedAt ?? startedAt,
        completedAt: nowIso(),
        issues: input.issues,
        details: input.details,
      }));
    };
    appendStage({
      stage: UnifiedIngestionLineageStageKinds.sourceRegistration,
      status: UnifiedIngestionLineageStageStatuses.succeeded,
      details: Object.freeze({
        sourceId: request.source.sourceId,
        referenceKind: request.source.referenceKind,
      }),
    });

    const configurationStageStartedAt = nowIso();
    const resolvedConfiguration = resolveUnifiedIngestionConfiguration({
      mode: request.configuration?.mode,
      base: request.configuration,
    });
    appendStage({
      stage: UnifiedIngestionLineageStageKinds.configuration,
      status: resolvedConfiguration.issues.some((issue) => issue.severity === "error")
        ? UnifiedIngestionLineageStageStatuses.failed
        : UnifiedIngestionLineageStageStatuses.succeeded,
      startedAt: configurationStageStartedAt,
      details: Object.freeze({
        mode: resolvedConfiguration.configuration.mode,
        outputTarget: resolvedConfiguration.configuration.outputTarget,
      }),
    });
    if (resolvedConfiguration.issues.some((issue) => issue.severity === "error")) {
      const issues = Object.freeze(resolvedConfiguration.issues.map((issue) => buildIssue({
        code: UnifiedIngestionIssueCodes.invalidConfiguration,
        severity: issue.severity,
        message: issue.message,
        sourceId: request.source.sourceId,
        details: issue.path
          ? Object.freeze({ path: issue.path, code: issue.code })
          : Object.freeze({ code: issue.code }),
      })));
      return this.buildFailureResult({
        source: request.source,
        configuration: resolvedConfiguration.configuration,
        lineageId,
        startedAt,
        stage: UnifiedIngestionExecutionStages.configuration,
        issues,
        stages: Object.freeze(stageRecords),
        outputTarget: resolvedConfiguration.configuration.outputTarget,
      });
    }
    const configuration = resolvedConfiguration.configuration;

    let payload = request.payload;
    if (payload === undefined) {
      const sourceReadStageStartedAt = nowIso();
      try {
        payload = await this.readPayloadForSource(request.source);
        appendStage({
          stage: UnifiedIngestionLineageStageKinds.sourceRead,
          status: UnifiedIngestionLineageStageStatuses.succeeded,
          startedAt: sourceReadStageStartedAt,
          details: Object.freeze({ sourceRead: payload !== undefined }),
        });
      } catch (error) {
        const sourceReadIssue = buildIssue({
          code: UnifiedIngestionIssueCodes.sourceReadFailed,
          message: "Unified ingestion could not read source payload.",
          sourceId: request.source.sourceId,
          details: Object.freeze({
            errorType: toErrorType(error),
            reference: request.source.reference,
          }),
        });
        appendStage({
          stage: UnifiedIngestionLineageStageKinds.sourceRead,
          status: UnifiedIngestionLineageStageStatuses.failed,
          startedAt: sourceReadStageStartedAt,
          issues: Object.freeze([sourceReadIssue]),
        });
        return this.buildFailureResult({
          source: request.source,
          configuration,
          lineageId,
          startedAt,
          stage: UnifiedIngestionExecutionStages.sourceRead,
          issues: Object.freeze([sourceReadIssue]),
          stages: Object.freeze(stageRecords),
          outputTarget: configuration.outputTarget,
        });
      }
    }

    let detection: Awaited<ReturnType<IUnifiedIngestionSourceTypeDetector["detect"]>>;
    const detectionStageStartedAt = nowIso();
    try {
      detection = await this.detector.detect({
        source: request.source,
        payload,
        explicitSourceKind: configuration.mode === "advanced" ? configuration.explicitSourceKind : undefined,
        enableContentSniffing: configuration.mode === "advanced"
          ? configuration.enableContentSniffing
          : undefined,
      });
      appendStage({
        stage: UnifiedIngestionLineageStageKinds.detection,
        status: UnifiedIngestionLineageStageStatuses.succeeded,
        startedAt: detectionStageStartedAt,
        details: Object.freeze({
          detectedKind: detection.detectedKind,
          confidence: detection.confidence,
          evidenceCount: detection.evidence.length,
        }),
      });
    } catch (error) {
      const detectionIssue = buildIssue({
        code: UnifiedIngestionIssueCodes.detectionFailed,
        message: "Unified ingestion detection failed.",
        sourceId: request.source.sourceId,
        details: Object.freeze({
          errorType: toErrorType(error),
        }),
      });
      appendStage({
        stage: UnifiedIngestionLineageStageKinds.detection,
        status: UnifiedIngestionLineageStageStatuses.failed,
        startedAt: detectionStageStartedAt,
        issues: Object.freeze([detectionIssue]),
      });
      return this.buildFailureResult({
        source: request.source,
        configuration,
        lineageId,
        startedAt,
        stage: UnifiedIngestionExecutionStages.detection,
        issues: Object.freeze([detectionIssue]),
        stages: Object.freeze(stageRecords),
        outputTarget: configuration.outputTarget,
      });
    }

    const routingStageStartedAt = nowIso();
    const route = this.router.route({
      source: request.source,
      detection,
      configuration,
    });
    appendStage({
      stage: UnifiedIngestionLineageStageKinds.routing,
      status: route.status === "resolved"
        ? UnifiedIngestionLineageStageStatuses.succeeded
        : UnifiedIngestionLineageStageStatuses.failed,
      startedAt: routingStageStartedAt,
      details: Object.freeze(
        route.status === "resolved"
          ? {
            handlerKind: route.handlerKind,
            policy: route.policy,
            fallbackUsed: route.fallbackUsed,
          }
          : {
            failureCode: route.failureCode,
            fallbackUsed: route.fallbackUsed,
          },
      ),
    });
    if (route.status !== "resolved") {
      const routeIssue = buildIssue({
        code: route.failureCode === "missing-route-mapping"
          ? UnifiedIngestionIssueCodes.routingUnavailable
          : UnifiedIngestionIssueCodes.routingUnsupported,
        message: route.reason,
        sourceId: request.source.sourceId,
        details: Object.freeze({
          failureCode: route.failureCode,
          detectedKind: detection.detectedKind,
          fallbackUsed: route.fallbackUsed,
        }),
      });
      return this.buildFailureResult({
        source: request.source,
        configuration,
        lineageId,
        startedAt,
        stage: UnifiedIngestionExecutionStages.routing,
        detection,
        route,
        issues: Object.freeze([routeIssue]),
        stages: Object.freeze(stageRecords),
        outputTarget: configuration.outputTarget,
      });
    }

    const ingestionStageStartedAt = nowIso();
    const ingestion = await this.executeRoutedIngestor({
      route,
      source: request.source,
      payload,
      configuration,
    });
    if (!ingestion.ok) {
      appendStage({
        stage: UnifiedIngestionLineageStageKinds.ingestion,
        status: UnifiedIngestionLineageStageStatuses.failed,
        startedAt: ingestionStageStartedAt,
        issues: Object.freeze([ingestion.issue]),
        details: Object.freeze({
          handlerKind: route.handlerKind,
          assetId: route.assetId,
        }),
      });
      return this.buildFailureResult({
        source: request.source,
        configuration,
        lineageId,
        startedAt,
        stage: UnifiedIngestionExecutionStages.ingestion,
        detection,
        route,
        issues: Object.freeze([ingestion.issue]),
        stages: Object.freeze(stageRecords),
        outputTarget: configuration.outputTarget,
      });
    }
    appendStage({
      stage: UnifiedIngestionLineageStageKinds.ingestion,
      status: UnifiedIngestionLineageStageStatuses.succeeded,
      startedAt: ingestionStageStartedAt,
      details: Object.freeze({
        handlerKind: route.handlerKind,
        assetId: route.assetId,
      }),
    });

    const conversionStageStartedAt = nowIso();
    const conversion = this.convertRoutedIngestion({
      route,
      source: request.source,
      converterContext: request.converterContext,
      ingestion,
    });
    if (!conversion.ok) {
      appendStage({
        stage: UnifiedIngestionLineageStageKinds.conversion,
        status: UnifiedIngestionLineageStageStatuses.failed,
        startedAt: conversionStageStartedAt,
        issues: Object.freeze([conversion.issue]),
        details: Object.freeze({
          handlerKind: route.handlerKind,
        }),
      });
      return this.buildFailureResult({
        source: request.source,
        configuration,
        lineageId,
        startedAt,
        stage: UnifiedIngestionExecutionStages.conversion,
        detection,
        route,
        issues: Object.freeze([conversion.issue]),
        stages: Object.freeze(stageRecords),
        outputTarget: configuration.outputTarget,
      });
    }
    appendStage({
      stage: UnifiedIngestionLineageStageKinds.conversion,
      status: UnifiedIngestionLineageStageStatuses.succeeded,
      startedAt: conversionStageStartedAt,
      details: Object.freeze({
        operation: conversion.result.operation,
        inputBoundary: conversion.result.contract.inputBoundary,
      }),
    });

    const outputTarget = mapRouteKindToOutputTarget(route, configuration);
    const normalizationStageStartedAt = nowIso();
    const normalization = this.normalizationPipeline.normalize({
      source: request.source,
      detection,
      route,
      outputTarget,
      configurationMode: configuration.mode,
      output: conversion.result.output,
    });
    if (!normalization.ok) {
      appendStage({
        stage: UnifiedIngestionLineageStageKinds.normalization,
        status: UnifiedIngestionLineageStageStatuses.failed,
        startedAt: normalizationStageStartedAt,
        issues: normalization.issues,
        details: Object.freeze({
          outputTarget,
        }),
      });
      return this.buildFailureResult({
        source: request.source,
        configuration,
        lineageId,
        startedAt,
        stage: UnifiedIngestionExecutionStages.normalization,
        detection,
        route,
        issues: normalization.issues,
        stages: Object.freeze(stageRecords),
        outputTarget,
      });
    }
    appendStage({
      stage: UnifiedIngestionLineageStageKinds.normalization,
      status: UnifiedIngestionLineageStageStatuses.succeeded,
      startedAt: normalizationStageStartedAt,
      issues: normalization.issues,
      details: Object.freeze({
        outputKind: normalization.normalized.canonicalOutputKind,
        totalCount: normalization.normalized.metadata.totalCount,
      }),
    });
    const fallbacks = deriveUnifiedIngestionFallbackDecisions({
      detection,
      route,
    });
    const completedAt = nowIso();
    const metadata = buildExecutionMetadata({
      source: request.source,
      configuration,
      startedAt,
      completedAt,
      issues: normalization.issues,
      fallbacks,
      stages: Object.freeze(stageRecords),
      detection,
      route,
      conversion: Object.freeze({
        operation: conversion.result.operation,
        inputBoundary: conversion.result.contract.inputBoundary,
      }),
      normalized: normalization.normalized,
    });
    const lineage = buildLineageRecord({
      lineageId,
      capturedAt: completedAt,
      source: request.source,
      stages: Object.freeze(stageRecords),
      metadata,
    });
    return Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      ok: true,
      source: request.source,
      outputTarget,
      detection,
      route,
      output: normalization.normalized.normalizedPayload,
      normalized: normalization.normalized,
      metadata,
      lineage,
      conversion: Object.freeze({
        operation: conversion.result.operation,
        inputBoundary: conversion.result.contract.inputBoundary,
      }),
      issues: normalization.issues,
      fallbacks,
    });
  }

  public async ingestWithPreview(request: UnifiedIngestionRequest): Promise<UnifiedIngestionPreviewResult> {
    const ingestion = await this.ingest(request);
    if (!ingestion.ok) {
      return ingestion;
    }

    const resolvedConfiguration = resolveUnifiedIngestionConfiguration({
      mode: request.configuration?.mode,
      base: request.configuration,
    });
    const preview = this.previewService.generate({
      source: ingestion.source,
      normalized: ingestion.normalized,
      issues: ingestion.issues,
      sampleLimit: resolvedConfiguration.configuration.previewSampleLimit,
    });
    if (!preview.ok) {
      const previewIssue = preview.issues[0] ?? buildIssue({
        code: UnifiedIngestionIssueCodes.previewGenerationFailed,
        sourceId: ingestion.source.sourceId,
        message: "Unified ingestion preview generation failed.",
      });
      return this.buildFailureResult({
        source: ingestion.source,
        configuration: resolvedConfiguration.configuration,
        lineageId: ingestion.lineage.lineageId,
        startedAt: ingestion.metadata.processing.startedAt,
        stage: UnifiedIngestionExecutionStages.preview,
        detection: ingestion.detection,
        route: ingestion.route,
        issues: Object.freeze([previewIssue]),
        stages: Object.freeze([
          ...ingestion.lineage.stages,
          Object.freeze({
            stage: UnifiedIngestionLineageStageKinds.preview,
            status: UnifiedIngestionLineageStageStatuses.failed,
            startedAt: nowIso(),
            completedAt: nowIso(),
            issues: Object.freeze([previewIssue]),
          }),
        ]),
        outputTarget: ingestion.outputTarget,
      });
    }

    const previewStage: UnifiedIngestionLineageStageRecord = Object.freeze({
      stage: UnifiedIngestionLineageStageKinds.preview,
      status: preview.degraded ? UnifiedIngestionLineageStageStatuses.degraded : UnifiedIngestionLineageStageStatuses.succeeded,
      startedAt: nowIso(),
      completedAt: nowIso(),
      issues: preview.issues,
      details: Object.freeze({
        degraded: preview.degraded,
        sampleCount: preview.summary.sampleCount,
        totalCount: preview.summary.totalCount,
      }),
    });
    const combinedFallbacks = Object.freeze([
      ...ingestion.fallbacks,
      ...deriveUnifiedIngestionFallbackDecisions({
        previewDegraded: preview.degraded,
      }),
    ]);
    const previewCompletedAt = nowIso();
    const metadata = buildExecutionMetadata({
      source: ingestion.source,
      configuration: resolvedConfiguration.configuration,
      startedAt: ingestion.metadata.processing.startedAt,
      completedAt: previewCompletedAt,
      issues: preview.issues,
      fallbacks: combinedFallbacks,
      stages: Object.freeze([...ingestion.lineage.stages, previewStage]),
      detection: ingestion.detection,
      route: ingestion.route,
      conversion: ingestion.conversion,
      normalized: ingestion.normalized,
      preview,
    });
    const lineage = buildLineageRecord({
      lineageId: ingestion.lineage.lineageId,
      capturedAt: previewCompletedAt,
      source: ingestion.source,
      stages: Object.freeze([...ingestion.lineage.stages, previewStage]),
      metadata,
    });

    return Object.freeze({
      ...ingestion,
      metadata,
      lineage,
      fallbacks: combinedFallbacks,
      preview,
    });
  }

  private async executeRoutedIngestor(input: {
    readonly route: UnifiedIngestionRouteResolution;
    readonly source: UnifiedIngestionSourceReference;
    readonly payload?: string | Uint8Array;
    readonly configuration?: UnifiedIngestionConfiguration;
  }): Promise<{
    readonly ok: true;
    readonly rawResult: CsvIngestorExecutionResult | JsonIngestorExecutionResult | DocumentPdfIngestorExecutionResult | ImageIngestorExecutionResult;
  } | {
    readonly ok: false;
    readonly issue: UnifiedIngestionIssue;
  }> {
    if (input.payload === undefined) {
      return Object.freeze({
        ok: false,
        issue: buildIssue({
          code: UnifiedIngestionIssueCodes.ingestionFailed,
          sourceId: input.source.sourceId,
          message: "Unified ingestion requires a payload for routed execution.",
          details: Object.freeze({ handlerKind: input.route.handlerKind }),
        }),
      });
    }

    if (input.route.handlerKind === "csv") {
      const result = this.csvIngestor.execute({
        payload: input.payload,
        config: input.configuration?.mode === "advanced"
          ? {
            delimiter: input.configuration.delimiterHint,
            encoding: input.configuration.textEncoding,
            normalizeHeadersToLowercase: input.configuration.normalizeHeadersToLowercase,
          }
          : undefined,
        sourceId: input.source.sourceId,
        sourceReference: input.source.reference,
        fileName: input.source.displayName,
        contentType: input.source.mimeType,
        sourceAssetId: input.source.sourceAssetId,
        sourceVersionId: input.source.sourceVersionId,
        groupId: input.source.groupId,
      });
      if (!result.ok) {
        return Object.freeze({
          ok: false,
          issue: buildIssue({
            code: UnifiedIngestionIssueCodes.ingestionFailed,
            sourceId: input.source.sourceId,
            message: result.diagnostics[0]?.message ?? "CSV ingestion failed.",
            details: Object.freeze({
              handlerKind: input.route.handlerKind,
              diagnostics: result.diagnostics,
            }),
          }),
        });
      }
      return Object.freeze({ ok: true, rawResult: result });
    }

    if (input.route.handlerKind === "json") {
      const result = this.jsonIngestor.execute({
        payload: input.payload,
        config: input.configuration?.mode === "advanced"
          ? {
            flatten: input.configuration.flattenJson,
            maxDepth: input.configuration.flattenJsonDepth,
          }
          : undefined,
        sourceId: input.source.sourceId,
        sourceReference: input.source.reference,
        fileName: input.source.displayName,
        contentType: input.source.mimeType,
        sourceAssetId: input.source.sourceAssetId,
        sourceVersionId: input.source.sourceVersionId,
        groupId: input.source.groupId,
      });
      if (!result.ok) {
        return Object.freeze({
          ok: false,
          issue: buildIssue({
            code: UnifiedIngestionIssueCodes.ingestionFailed,
            sourceId: input.source.sourceId,
            message: result.diagnostics[0]?.message ?? "JSON ingestion failed.",
            details: Object.freeze({
              handlerKind: input.route.handlerKind,
              diagnostics: result.diagnostics,
            }),
          }),
        });
      }
      return Object.freeze({ ok: true, rawResult: result });
    }

    const resolvedKind = input.source.referenceKind === UnifiedIngestionReferenceKinds.remoteUrl
      ? "url"
      : input.source.referenceKind === UnifiedIngestionReferenceKinds.localPath
        ? "local-file"
        : "in-memory";
    const resolvedSource = Object.freeze({
      kind: resolvedKind,
      reference: input.source.reference,
      sourceId: input.source.sourceId,
      payload: input.payload,
      fileName: input.source.displayName,
      contentType: input.source.mimeType,
      sourceAssetId: input.source.sourceAssetId,
      sourceVersionId: input.source.sourceVersionId,
      groupId: input.source.groupId,
      diagnostics: Object.freeze([]),
    } as const);

    if (input.route.handlerKind === "document") {
      const result = await this.documentIngestor.execute({
        source: resolvedSource,
        config: input.configuration?.mode === "advanced"
          ? {
            maxPages: input.configuration.documentMaxPages,
          }
          : undefined,
      });
      if (!result.ok) {
        return Object.freeze({
          ok: false,
          issue: buildIssue({
            code: UnifiedIngestionIssueCodes.ingestionFailed,
            sourceId: input.source.sourceId,
            message: result.diagnostics[0]?.message ?? "Document ingestion failed.",
            details: Object.freeze({
              handlerKind: input.route.handlerKind,
              diagnostics: result.diagnostics,
            }),
          }),
        });
      }
      return Object.freeze({ ok: true, rawResult: result });
    }

    const imageResult = await this.imageIngestor.execute({
      source: resolvedSource,
      config: input.configuration?.mode === "advanced"
        ? {
          extractExif: input.configuration.imageExtractExif,
          normalizeOrientation: input.configuration.imageNormalizeOrientation,
        }
        : undefined,
    });
    if (!imageResult.ok) {
      return Object.freeze({
        ok: false,
        issue: buildIssue({
          code: UnifiedIngestionIssueCodes.ingestionFailed,
          sourceId: input.source.sourceId,
          message: imageResult.diagnostics[0]?.message ?? "Image ingestion failed.",
          details: Object.freeze({
            handlerKind: input.route.handlerKind,
            diagnostics: imageResult.diagnostics,
          }),
        }),
      });
    }
    return Object.freeze({ ok: true, rawResult: imageResult });
  }

  private convertRoutedIngestion(input: {
    readonly route: UnifiedIngestionRouteResolution;
    readonly source: UnifiedIngestionSourceReference;
    readonly converterContext?: DataConverterOperationContext;
    readonly ingestion: {
      readonly ok: true;
      readonly rawResult: CsvIngestorExecutionResult | JsonIngestorExecutionResult | DocumentPdfIngestorExecutionResult | ImageIngestorExecutionResult;
    };
  }): {
    readonly ok: true;
    readonly result: DataConverterSuccessResult;
  } | {
    readonly ok: false;
    readonly issue: UnifiedIngestionIssue;
  } {
    let conversion: DataConverterResult;
    const raw = input.ingestion.rawResult;

    if (input.route.handlerKind === "csv") {
      const csvResult = raw as CsvIngestorExecutionResult;
      const rawRecords = csvResult.ok ? csvResult.records : [];
      conversion = this.converter.convert({
        operation: DataConverterOperationKinds.sourceToRecords,
        context: input.converterContext,
        source: Object.freeze({
          kind: "in-memory",
          reference: input.source.reference,
          payload: rawRecords,
          fileName: input.source.displayName,
          contentType: input.source.mimeType,
          sourceId: input.source.sourceId,
          groupId: input.source.groupId,
          sourceAssetId: input.source.sourceAssetId,
          sourceVersionId: input.source.sourceVersionId,
          diagnostics: Object.freeze([]),
        }),
        formatHint: "csv",
      });
    } else if (input.route.handlerKind === "json") {
      const jsonResult = raw as JsonIngestorExecutionResult;
      const rawRecords = jsonResult.ok ? jsonResult.records : [];
      conversion = this.converter.convert({
        operation: DataConverterOperationKinds.sourceToRecords,
        context: input.converterContext,
        source: Object.freeze({
          kind: "in-memory",
          reference: input.source.reference,
          payload: rawRecords,
          fileName: input.source.displayName,
          contentType: input.source.mimeType,
          sourceId: input.source.sourceId,
          groupId: input.source.groupId,
          sourceAssetId: input.source.sourceAssetId,
          sourceVersionId: input.source.sourceVersionId,
          diagnostics: Object.freeze([]),
        }),
        formatHint: "json",
      });
    } else if (input.route.handlerKind === "document") {
      const documentResult = raw as DocumentPdfIngestorExecutionResult;
      conversion = this.converter.convert({
        operation: DataConverterOperationKinds.documentToTextItems,
        context: input.converterContext,
        text: documentResult.ok ? documentResult.fullText : "",
        documentId: normalizeOptional(input.source.displayName) ?? input.source.sourceId,
        sourceAssetId: input.source.sourceAssetId,
        sourceVersionId: input.source.sourceVersionId,
      });
    } else {
      const imageResult = raw as ImageIngestorExecutionResult;
      conversion = this.converter.convert({
        operation: DataConverterOperationKinds.imageMetadataToRecords,
        context: input.converterContext,
        imageId: normalizeOptional(input.source.displayName) ?? input.source.sourceId,
        metadata: imageResult.ok ? imageResult.metadata : Object.freeze({}),
        sourceAssetId: input.source.sourceAssetId,
        sourceVersionId: input.source.sourceVersionId,
      });
    }

    if (!conversion.ok) {
      return Object.freeze({
        ok: false,
        issue: buildIssue({
          code: UnifiedIngestionIssueCodes.conversionFailed,
          sourceId: input.source.sourceId,
          message: conversion.diagnostics[0]?.message ?? "Data conversion failed.",
          details: Object.freeze({
            operation: conversion.operation,
            diagnostics: conversion.diagnostics,
          }),
        }),
      });
    }

    return Object.freeze({
      ok: true,
      result: conversion,
    });
  }

  private async readPayloadForSource(source: UnifiedIngestionSourceReference): Promise<string | Uint8Array | undefined> {
    if (source.referenceKind !== UnifiedIngestionReferenceKinds.localPath) {
      return undefined;
    }

    let fsPromises: NodeFsPromisesRuntime;
    try {
      const fsModule = await import("node:fs");
      if (!fsModule.promises) {
        throw new Error("Node filesystem promises API is unavailable.");
      }
      fsPromises = fsModule.promises as NodeFsPromisesRuntime;
    } catch (error) {
      throw new Error(
        `Local source reads require a Node.js filesystem runtime (${error instanceof Error ? error.message : String(error)}).`,
      );
    }

    const extension = normalizeExtension(source.extension);
    const isBinary = extension === ".pdf"
      || extension === ".png"
      || extension === ".jpg"
      || extension === ".jpeg"
      || extension === ".webp"
      || extension === ".gif"
      || extension === ".bmp"
      || extension === ".tif"
      || extension === ".tiff";
    if (isBinary) {
      const bytes = await fsPromises.readFile(source.reference);
      return new Uint8Array(bytes);
    }

    return fsPromises.readFile(source.reference, "utf-8");
  }
}
