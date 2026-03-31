import type { CanonicalDataShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { DataPreviewModel } from "../data-studio/DataPreviewEngine";
import {
  UnifiedIngestionIssueCodes,
  UnifiedIngestionIssueSeverities,
  UnifiedIngestionReferenceKinds,
  type UnifiedIngestionConfiguration,
  type UnifiedIngestionIssue,
  type UnifiedIngestionNormalizedOutput,
  type UnifiedIngestionRouteHandlerKind,
  type UnifiedIngestionSourceKind,
  type UnifiedIngestionSourceReference,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import {
  SourceDescriptorKinds,
  SourceLocatorInputAbstraction,
  type SourceDescriptor,
  type SourceLocatorIssue,
  type SourceLocatorRequest,
} from "./SourceLocatorInputAbstraction";
import { UnifiedIngestionOrchestrationService } from "./UnifiedIngestionOrchestrationService";

export const UnifiedIngestionBatchItemStatuses = Object.freeze({
  succeeded: "succeeded",
  failed: "failed",
  skipped: "skipped",
} as const);

export type UnifiedIngestionBatchItemStatus =
  typeof UnifiedIngestionBatchItemStatuses[keyof typeof UnifiedIngestionBatchItemStatuses];

export interface UnifiedIngestionBatchSummary {
  readonly totalItems: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly skipped: number;
  readonly partialSuccess: boolean;
  readonly empty: boolean;
  readonly sourceKindDistribution: Readonly<Record<string, number>>;
}

export interface UnifiedIngestionBatchItemResult {
  readonly source: UnifiedIngestionSourceReference;
  readonly status: UnifiedIngestionBatchItemStatus;
  readonly detectionKind?: UnifiedIngestionSourceKind;
  readonly routeHandler?: UnifiedIngestionRouteHandlerKind;
  readonly output?: CanonicalDataShape;
  readonly normalized?: UnifiedIngestionNormalizedOutput;
  readonly preview?: UnifiedIngestionPreviewLike;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
  readonly stage?: string;
}

export interface UnifiedIngestionPreviewLike {
  readonly outputKind: string;
  readonly model: DataPreviewModel;
  readonly summary: {
    readonly totalCount: number;
    readonly sampleCount: number;
    readonly truncated: boolean;
  };
}

export interface UnifiedIngestionBatchResult {
  readonly summary: UnifiedIngestionBatchSummary;
  readonly items: ReadonlyArray<UnifiedIngestionBatchItemResult>;
  readonly outputs: ReadonlyArray<{
    readonly sourceId: string;
    readonly output: CanonicalDataShape;
  }>;
  readonly normalizedOutputs: ReadonlyArray<UnifiedIngestionNormalizedOutput>;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
  readonly sourceIssues: ReadonlyArray<SourceLocatorIssue>;
}

export interface UnifiedIngestionBatchRequest {
  readonly sourceRequest?: SourceLocatorRequest;
  readonly sources?: ReadonlyArray<UnifiedIngestionSourceReference>;
  readonly payloadBySourceId?: Readonly<Record<string, string | Uint8Array>>;
  readonly configuration: UnifiedIngestionConfiguration;
  readonly converterContext?: {
    readonly operationId?: string;
    readonly initiatedBy?: string;
    readonly requestId?: string;
    readonly pipelineId?: string;
    readonly stageId?: string;
    readonly lineageAssetId?: string;
  };
  readonly options?: {
    readonly continueOnError?: boolean;
    readonly maxItems?: number;
    readonly concurrency?: number;
  };
}

function toIssue(input: {
  readonly code: UnifiedIngestionIssue["code"];
  readonly message: string;
  readonly severity?: UnifiedIngestionIssue["severity"];
  readonly sourceId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}): UnifiedIngestionIssue {
  return Object.freeze({
    code: input.code,
    severity: input.severity ?? UnifiedIngestionIssueSeverities.error,
    message: input.message,
    sourceId: input.sourceId,
    details: input.details,
  });
}

function toUnifiedSource(descriptor: SourceDescriptor): UnifiedIngestionSourceReference {
  return Object.freeze({
    sourceId: descriptor.sourceId,
    referenceKind: descriptor.kind === SourceDescriptorKinds.localFile
      ? UnifiedIngestionReferenceKinds.localPath
      : UnifiedIngestionReferenceKinds.remoteUrl,
    reference: descriptor.normalizedReference,
    displayName: descriptor.displayName,
    extension: descriptor.extension,
    mimeType: descriptor.mediaType,
    sizeInBytes: descriptor.sizeInBytes,
    groupId: descriptor.groupId,
  });
}

async function mapWithConcurrency<T, TResult>(
  items: ReadonlyArray<T>,
  concurrency: number,
  mapFn: (item: T, index: number) => Promise<TResult>,
): Promise<ReadonlyArray<TResult>> {
  if (items.length === 0) {
    return Object.freeze([]);
  }
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const results: TResult[] = new Array(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) {
        return;
      }
      results[current] = await mapFn(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return Object.freeze(results);
}

export class UnifiedIngestionBatchOrchestrationService {
  private readonly sourceLocator: SourceLocatorInputAbstraction;
  private readonly orchestration: UnifiedIngestionOrchestrationService;

  constructor(options?: {
    readonly sourceLocator?: SourceLocatorInputAbstraction;
    readonly orchestration?: UnifiedIngestionOrchestrationService;
  }) {
    this.sourceLocator = options?.sourceLocator ?? new SourceLocatorInputAbstraction();
    this.orchestration = options?.orchestration ?? new UnifiedIngestionOrchestrationService();
  }

  public async executeBatch(request: UnifiedIngestionBatchRequest): Promise<UnifiedIngestionBatchResult> {
    return this.runBatch(request, false);
  }

  public async previewBatch(request: UnifiedIngestionBatchRequest): Promise<UnifiedIngestionBatchResult> {
    return this.runBatch(request, true);
  }

  private async runBatch(
    request: UnifiedIngestionBatchRequest,
    preview: boolean,
  ): Promise<UnifiedIngestionBatchResult> {
    const sourceResolution = await this.resolveSources(request);
    const boundedSources = request.options?.maxItems && request.options.maxItems > 0
      ? sourceResolution.sources.slice(0, request.options.maxItems)
      : sourceResolution.sources;

    if (boundedSources.length === 0) {
      return Object.freeze({
        summary: Object.freeze({
          totalItems: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          partialSuccess: false,
          empty: true,
          sourceKindDistribution: Object.freeze({}),
        }),
        items: Object.freeze([]),
        outputs: Object.freeze([]),
        normalizedOutputs: Object.freeze([]),
        sourceIssues: sourceResolution.issues,
        issues: Object.freeze([
          toIssue({
            code: UnifiedIngestionIssueCodes.invalidBatchInput,
            message: "Unified batch ingestion requires at least one source.",
            severity: UnifiedIngestionIssueSeverities.error,
          }),
        ]),
      });
    }

    const continueOnError = request.options?.continueOnError ?? true;
    const payloadBySourceId = request.payloadBySourceId ?? {};
    const concurrency = request.options?.concurrency ?? 4;

    let failedOnce = false;
    const itemResults = await mapWithConcurrency(
      boundedSources,
      continueOnError ? concurrency : 1,
      async (source) => {
        if (!continueOnError && failedOnce) {
          return Object.freeze({
            source,
            status: UnifiedIngestionBatchItemStatuses.skipped,
            issues: Object.freeze([
              toIssue({
                code: UnifiedIngestionIssueCodes.batchItemSkipped,
                message: "Item skipped due to fail-fast policy after an earlier failure.",
                severity: UnifiedIngestionIssueSeverities.warning,
                sourceId: source.sourceId,
              }),
            ]),
            stage: "batch",
          } satisfies UnifiedIngestionBatchItemResult);
        }

        const payload = payloadBySourceId[source.sourceId];
        if (preview) {
          const result = await this.orchestration.ingestWithPreview({
            source,
            payload,
            configuration: request.configuration,
            converterContext: request.converterContext,
          });
          if (!result.ok) {
            failedOnce = true;
            return Object.freeze({
              source,
              status: UnifiedIngestionBatchItemStatuses.failed,
              detectionKind: result.detection?.detectedKind,
              routeHandler: result.route?.status === "resolved" ? result.route.handlerKind : undefined,
              issues: result.issues,
              stage: result.stage,
            } satisfies UnifiedIngestionBatchItemResult);
          }
          return Object.freeze({
            source,
            status: UnifiedIngestionBatchItemStatuses.succeeded,
            detectionKind: result.detection.detectedKind,
            routeHandler: result.route.handlerKind,
            output: result.output,
            normalized: result.normalized,
            preview: Object.freeze({
              outputKind: result.preview.outputKind,
              model: result.preview.preview,
              summary: Object.freeze({
                totalCount: result.preview.summary.totalCount,
                sampleCount: result.preview.summary.sampleCount,
                truncated: result.preview.summary.truncated,
              }),
            }),
            issues: result.preview.issues,
          } satisfies UnifiedIngestionBatchItemResult);
        }

        const result = await this.orchestration.ingest({
          source,
          payload,
          configuration: request.configuration,
          converterContext: request.converterContext,
        });
        if (!result.ok) {
          failedOnce = true;
          return Object.freeze({
            source,
            status: UnifiedIngestionBatchItemStatuses.failed,
            detectionKind: result.detection?.detectedKind,
            routeHandler: result.route?.status === "resolved" ? result.route.handlerKind : undefined,
            issues: result.issues,
            stage: result.stage,
          } satisfies UnifiedIngestionBatchItemResult);
        }
        return Object.freeze({
          source,
          status: UnifiedIngestionBatchItemStatuses.succeeded,
          detectionKind: result.detection.detectedKind,
          routeHandler: result.route.handlerKind,
          output: result.output,
          normalized: result.normalized,
          issues: result.issues,
        } satisfies UnifiedIngestionBatchItemResult);
      },
    );

    const succeeded = itemResults.filter((item) => item.status === UnifiedIngestionBatchItemStatuses.succeeded);
    const failed = itemResults.filter((item) => item.status === UnifiedIngestionBatchItemStatuses.failed);
    const skipped = itemResults.filter((item) => item.status === UnifiedIngestionBatchItemStatuses.skipped);
    const kindSummary: Record<string, number> = {};
    for (const item of itemResults) {
      if (!item.detectionKind) {
        continue;
      }
      kindSummary[item.detectionKind] = (kindSummary[item.detectionKind] ?? 0) + 1;
    }

    const outputs = Object.freeze(succeeded
      .filter((item): item is UnifiedIngestionBatchItemResult & { readonly output: CanonicalDataShape } => Boolean(item.output))
      .map((item) => Object.freeze({
        sourceId: item.source.sourceId,
        output: item.output,
      })));
    const normalizedOutputs = Object.freeze(succeeded
      .filter((item): item is UnifiedIngestionBatchItemResult & { readonly normalized: UnifiedIngestionNormalizedOutput } => Boolean(item.normalized))
      .map((item) => item.normalized));
    const batchIssues: UnifiedIngestionIssue[] = [];
    if (failed.length > 0 && succeeded.length > 0) {
      batchIssues.push(toIssue({
        code: UnifiedIngestionIssueCodes.batchPartialFailure,
        severity: UnifiedIngestionIssueSeverities.warning,
        message: "Batch completed with partial failures.",
      }));
    }
    if (skipped.length > 0) {
      batchIssues.push(toIssue({
        code: UnifiedIngestionIssueCodes.batchItemSkipped,
        severity: UnifiedIngestionIssueSeverities.warning,
        message: `${skipped.length} batch item(s) were skipped due to fail-fast policy.`,
      }));
    }

    return Object.freeze({
      summary: Object.freeze({
        totalItems: itemResults.length,
        succeeded: succeeded.length,
        failed: failed.length,
        skipped: skipped.length,
        partialSuccess: succeeded.length > 0 && (failed.length > 0 || skipped.length > 0),
        empty: itemResults.length === 0,
        sourceKindDistribution: Object.freeze(kindSummary),
      }),
      items: itemResults,
      outputs,
      normalizedOutputs,
      sourceIssues: sourceResolution.issues,
      issues: Object.freeze(batchIssues),
    });
  }

  private async resolveSources(
    request: UnifiedIngestionBatchRequest,
  ): Promise<{
    readonly sources: ReadonlyArray<UnifiedIngestionSourceReference>;
    readonly issues: ReadonlyArray<SourceLocatorIssue>;
  }> {
    if (request.sources && request.sources.length > 0) {
      return Object.freeze({
        sources: Object.freeze([...request.sources]),
        issues: Object.freeze([]),
      });
    }
    if (!request.sourceRequest) {
      return Object.freeze({
        sources: Object.freeze([]),
        issues: Object.freeze([]),
      });
    }
    const resolution = await this.sourceLocator.resolve(request.sourceRequest);
    return Object.freeze({
      sources: Object.freeze(resolution.descriptors.map((entry) => toUnifiedSource(entry))),
      issues: resolution.issues,
    });
  }
}
