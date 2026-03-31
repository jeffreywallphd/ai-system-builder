/// <reference types="node" />
import type { CanonicalDataShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  UnifiedIngestionContractVersion,
  UnifiedIngestionIssueCodes,
  UnifiedIngestionIssueSeverities,
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionReferenceKinds,
  type IUnifiedIngestionRouter,
  type IUnifiedIngestionSourceTypeDetector,
  type UnifiedIngestionConfiguration,
  type UnifiedIngestionIssue,
  type UnifiedIngestionNormalizedOutput,
  type UnifiedIngestionRouteResolution,
  type UnifiedIngestionSourceReference,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
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
  readonly conversion: {
    readonly operation: DataConverterSuccessResult["operation"];
    readonly inputBoundary: DataConverterSuccessResult["contract"]["inputBoundary"];
  };
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}

export interface UnifiedIngestionFailureResult {
  readonly contractVersion: typeof UnifiedIngestionContractVersion;
  readonly ok: false;
  readonly source: UnifiedIngestionSourceReference;
  readonly stage: "configuration" | "source-read" | "detection" | "routing" | "ingestion" | "conversion" | "normalization" | "preview";
  readonly detection?: Awaited<ReturnType<IUnifiedIngestionSourceTypeDetector["detect"]>>;
  readonly route?: UnifiedIngestionRouteResolution;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
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

  public async ingest(request: UnifiedIngestionRequest): Promise<UnifiedIngestionResult> {
    const resolvedConfiguration = resolveUnifiedIngestionConfiguration({
      mode: request.configuration?.mode,
      base: request.configuration,
    });
    if (resolvedConfiguration.issues.some((issue) => issue.severity === "error")) {
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: false,
        source: request.source,
        stage: "configuration",
        issues: Object.freeze(resolvedConfiguration.issues.map((issue) => buildIssue({
          code: UnifiedIngestionIssueCodes.invalidConfiguration,
          severity: issue.severity,
          message: issue.message,
          sourceId: request.source.sourceId,
          details: issue.path
            ? Object.freeze({ path: issue.path, code: issue.code })
            : Object.freeze({ code: issue.code }),
        }))),
      });
    }
    const configuration = resolvedConfiguration.configuration;

    let payload = request.payload;
    if (payload === undefined) {
      try {
        payload = await this.readPayloadForSource(request.source);
      } catch (error) {
        return Object.freeze({
          contractVersion: UnifiedIngestionContractVersion,
          ok: false,
          source: request.source,
          stage: "source-read",
          issues: Object.freeze([buildIssue({
            code: UnifiedIngestionIssueCodes.sourceReadFailed,
            message: "Unified ingestion could not read source payload.",
            sourceId: request.source.sourceId,
            details: Object.freeze({
              cause: error instanceof Error ? error.message : String(error),
              reference: request.source.reference,
            }),
          })]),
        });
      }
    }

    let detection: Awaited<ReturnType<IUnifiedIngestionSourceTypeDetector["detect"]>>;
    try {
      detection = await this.detector.detect({
        source: request.source,
        payload,
        explicitSourceKind: configuration.mode === "advanced" ? configuration.explicitSourceKind : undefined,
        enableContentSniffing: configuration.mode === "advanced"
          ? configuration.enableContentSniffing
          : undefined,
      });
    } catch (error) {
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: false,
        source: request.source,
        stage: "detection",
        issues: Object.freeze([buildIssue({
          code: UnifiedIngestionIssueCodes.detectionFailed,
          message: "Unified ingestion detection failed.",
          sourceId: request.source.sourceId,
          details: Object.freeze({
            cause: error instanceof Error ? error.message : String(error),
          }),
        })]),
      });
    }

    const route = this.router.route({
      source: request.source,
      detection,
      configuration,
    });
    if (route.status !== "resolved") {
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: false,
        source: request.source,
        stage: "routing",
        detection,
        issues: Object.freeze([buildIssue({
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
        })]),
      });
    }

    const ingestion = await this.executeRoutedIngestor({
      route,
      source: request.source,
      payload,
      configuration,
    });
    if (!ingestion.ok) {
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: false,
        source: request.source,
        stage: "ingestion",
        detection,
        route,
        issues: Object.freeze([ingestion.issue]),
      });
    }

    const conversion = this.convertRoutedIngestion({
      route,
      source: request.source,
      converterContext: request.converterContext,
      ingestion,
    });
    if (!conversion.ok) {
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: false,
        source: request.source,
        stage: "conversion",
        detection,
        route,
        issues: Object.freeze([conversion.issue]),
      });
    }

    const outputTarget = mapRouteKindToOutputTarget(route, configuration);
    const normalization = this.normalizationPipeline.normalize({
      source: request.source,
      detection,
      route,
      outputTarget,
      configurationMode: configuration.mode,
      output: conversion.result.output,
    });
    if (!normalization.ok) {
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: false,
        source: request.source,
        stage: "normalization",
        detection,
        route,
        issues: normalization.issues,
      });
    }
    return Object.freeze({
      contractVersion: UnifiedIngestionContractVersion,
      ok: true,
      source: request.source,
      outputTarget,
      detection,
      route,
      output: normalization.normalized.normalizedPayload,
      normalized: normalization.normalized,
      conversion: Object.freeze({
        operation: conversion.result.operation,
        inputBoundary: conversion.result.contract.inputBoundary,
      }),
      issues: normalization.issues,
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
      return Object.freeze({
        contractVersion: UnifiedIngestionContractVersion,
        ok: false,
        source: ingestion.source,
        stage: "preview",
        detection: ingestion.detection,
        route: ingestion.route,
        issues: preview.issues,
      });
    }

    return Object.freeze({
      ...ingestion,
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
