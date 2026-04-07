import { ExecutionStatuses, ExecutionUnitKinds } from "../../src/domain/execution/ExecutionPlan";
import { DatasetPipelineStageKinds, type DatasetPipelineStageKind } from "../../src/domain/dataset-studio/StagePipelineDomain";
import { PipelineStageIds, type PipelineStageId } from "../../src/domain/dataset-studio/PipelineStageDomain";
import { createDataStudioPipelineExecutionProvenance, DataStudioPipelineExecutionArtifacts, type DataStudioPipelineExecutionResult, type DataStudioPipelineExecutionStageRecord, type DataStudioPipelineExecutionUnitInput } from "../../application/data-studio/DataStudioPipelineExecution";
import {
  buildPreparedDatasetLineage,
  buildPreparedDatasetReuseReference,
  validatePreparedDatasetLineageLinks,
} from "../../application/data-studio/DataStudioLineageAndReuseService";
import { PreparedStorageStageService } from "../../application/dataset-studio/PreparedStorageStageService";
import { StageAssetMappingService } from "../../application/dataset-studio/StageAssetMappingService";
import type {
  IExecutionUnitExecutionRequest,
  IExecutionUnitExecutionResult,
  IExecutionUnitHandler,
} from "../../application/execution/UnifiedExecutionEngine";

const StageKindByPipelineStageId: Readonly<Record<PipelineStageId, DatasetPipelineStageKind | undefined>> = Object.freeze({
  [PipelineStageIds.SourceSelection]: DatasetPipelineStageKinds.sourceSelection,
  [PipelineStageIds.UnifiedIngestion]: DatasetPipelineStageKinds.ingestion,
  [PipelineStageIds.StorageRaw]: DatasetPipelineStageKinds.rawStorage,
  [PipelineStageIds.Profiling]: DatasetPipelineStageKinds.profiling,
  [PipelineStageIds.Classification]: DatasetPipelineStageKinds.classification,
  [PipelineStageIds.Normalization]: DatasetPipelineStageKinds.normalization,
  [PipelineStageIds.Cleaning]: DatasetPipelineStageKinds.cleaning,
  [PipelineStageIds.Transformation]: DatasetPipelineStageKinds.transformation,
  [PipelineStageIds.Enrichment]: undefined,
  [PipelineStageIds.FeatureEngineering]: DatasetPipelineStageKinds.featureEngineering,
  [PipelineStageIds.Extraction]: DatasetPipelineStageKinds.extraction,
  [PipelineStageIds.Chunking]: DatasetPipelineStageKinds.chunking,
  [PipelineStageIds.Aggregation]: DatasetPipelineStageKinds.aggregation,
  [PipelineStageIds.Labeling]: undefined,
  [PipelineStageIds.StoragePrepared]: DatasetPipelineStageKinds.preparedStorage,
});

function nowIso(): string {
  return new Date().toISOString();
}

function toStatus(result: DataStudioPipelineExecutionResult): IExecutionUnitExecutionResult["status"] {
  return result.status === "completed" ? ExecutionStatuses.completed : ExecutionStatuses.failed;
}

export class DataStudioPipelineExecutionUnitHandler implements IExecutionUnitHandler {
  private readonly stageAssetMappingService: StageAssetMappingService;
  private readonly preparedStorageService: PreparedStorageStageService;

  constructor(
    stageAssetMappingService: StageAssetMappingService = new StageAssetMappingService(),
    preparedStorageService: PreparedStorageStageService = new PreparedStorageStageService(),
  ) {
    this.stageAssetMappingService = stageAssetMappingService;
    this.preparedStorageService = preparedStorageService;
  }

  public canHandle(unit: IExecutionUnitExecutionRequest["unit"]): boolean {
    return unit.kind === ExecutionUnitKinds.dataPipeline;
  }

  public async execute(
    request: IExecutionUnitExecutionRequest,
  ): Promise<IExecutionUnitExecutionResult> {
    const input = request.unitInputs?.[request.unit.id] as DataStudioPipelineExecutionUnitInput | undefined;
    if (!input) {
      throw new Error(`Execution unit '${request.unit.id}' is missing Data Studio pipeline execution input.`);
    }

    const startedAt = nowIso();
    const warnings: string[] = [];
    const errors: string[] = [];
    const stageResults: DataStudioPipelineExecutionStageRecord[] = [];
    let preparedOutput: DataStudioPipelineExecutionResult["preparedOutput"];
    let lineageId: string | undefined;
    let reusableAssetId: string | undefined;

    try {
      const orderedStages = [...input.pipelineState.stages].sort((left, right) => left.order - right.order);
      const extractionEnabled = orderedStages.some((stage) => stage.stageId === PipelineStageIds.Extraction && stage.enabled);

      for (const stage of orderedStages) {
        const stageStartedAt = nowIso();
        const enabled = stage.enabled && stage.activation.mode !== "disabled";
        if (!enabled) {
          stageResults.push(Object.freeze({
            stageId: stage.stageId,
            order: stage.order,
            status: "skipped",
            message: `Stage '${stage.stageId}' is disabled or skipped in authoring state.`,
            resolvedAssetIds: Object.freeze([]),
            startedAt: stageStartedAt,
            completedAt: nowIso(),
          }));
          continue;
        }

        if (stage.stageId === PipelineStageIds.Chunking && !extractionEnabled) {
          const message = "Chunking requires Extraction to execute first.";
          errors.push(message);
          stageResults.push(Object.freeze({
            stageId: stage.stageId,
            order: stage.order,
            status: "failed",
            message,
            resolvedAssetIds: Object.freeze([]),
            startedAt: stageStartedAt,
            completedAt: nowIso(),
          }));
          break;
        }

        const mappedStageKind = StageKindByPipelineStageId[stage.stageId];
        let resolvedAssetIds: ReadonlyArray<string> = Object.freeze([]);
        if (mappedStageKind) {
          const mapped = this.stageAssetMappingService.resolveStage({
            stageKind: mappedStageKind,
            detectedSourceKind: undefined,
            outputTarget: undefined,
            strategy: undefined,
          });
          if (mapped.status === "resolved") {
            resolvedAssetIds = Object.freeze(mapped.assets.map((asset) => asset.assetId));
          } else {
            warnings.push(`No mapped assets were resolved for stage '${stage.stageId}' (${mapped.reason}).`);
          }
        } else {
          warnings.push(`Stage '${stage.stageId}' does not currently map to a concrete stage-asset resolver kind.`);
        }

        stageResults.push(Object.freeze({
          stageId: stage.stageId,
          order: stage.order,
          status: "completed",
          message: `Stage '${stage.stageId}' executed with ${resolvedAssetIds.length} resolved asset mapping(s).`,
          resolvedAssetIds,
          startedAt: stageStartedAt,
          completedAt: nowIso(),
        }));
      }

      if (errors.length === 0) {
        const preparedStorageStage = orderedStages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared);
        if (preparedStorageStage && preparedStorageStage.enabled && preparedStorageStage.activation.mode !== "disabled") {
          const preparedAssetVersionId = input.pipelineState.unifiedPreparationAsset.output.preparedAssetVersionId
            ?? input.pipelineState.identity.assetVersionId;
          const targetId = (typeof preparedStorageStage.options.destination === "string" && preparedStorageStage.options.destination.trim())
            || input.pipelineState.unifiedPreparationAsset.storageTarget?.targetId
            || input.pipelineState.preparedDatasetLineage.output.storageTargetId;

          if (!targetId) {
            errors.push("Prepared Storage target is not configured.");
          } else {
            const persistenceResult = await this.preparedStorageService.persistPreparedDataset({
              preparedDataset: Object.freeze({
                preparedAssetId: input.pipelineState.unifiedPreparationAsset.output.preparedAssetId,
                preparedAssetVersionId,
                outputShapeKind: input.pipelineState.unifiedPreparationAsset.output.outputShapeKind,
              }),
              storageTarget: Object.freeze({
                targetId,
                destinationReference: input.pipelineState.unifiedPreparationAsset.storageTarget?.locationReference,
              }),
              pipeline: Object.freeze({
                pipelineAssetId: input.pipelineState.identity.assetId,
                pipelineVersionId: input.pipelineState.identity.assetVersionId,
                pipelineDraftId: input.pipelineState.identity.draftId,
              }),
              upstream: Object.freeze({
                upstreamAssetIds: Object.freeze(input.pipelineState.preparedDatasetLineage.upstream.assets.map((asset) => asset.assetId)),
                upstreamPipelineAssetIds: Object.freeze(input.pipelineState.preparedDatasetLineage.upstream.pipelines.map((pipeline) => pipeline.pipelineAssetId)),
                upstreamSourceReferences: Object.freeze(input.pipelineState.preparedDatasetLineage.upstream.sources.map((source) => source.sourceReference ?? source.referenceId)),
              }),
              stageLineage: Object.freeze(
                orderedStages.map((stage) => Object.freeze({
                  stageId: stage.stageId,
                  order: stage.order,
                  status: stage.status,
                })),
              ),
              preparationContext: Object.freeze({
                authoringMode: input.pipelineState.flow.authoringMode,
                presentationMode: input.pipelineState.flow.presentationMode,
                currentStageId: input.pipelineState.flow.currentStageId,
              }),
              reuse: Object.freeze({
                reusableAsAsset: input.pipelineState.unifiedPreparationAsset.lineage.reusableAsAsset,
                reusableLabel: input.pipelineState.unifiedPreparationAsset.lineage.reusableLabel,
              }),
              traceability: Object.freeze({
                executionId: request.runId,
                operationId: request.unit.id,
              }),
              metadata: Object.freeze({
                executionKind: "data-pipeline",
                initiatedBy: input.initiatedBy,
              }),
            });

            const rebuiltLineage = buildPreparedDatasetLineage({
              identity: input.pipelineState.identity,
              asset: input.pipelineState.unifiedPreparationAsset,
              stages: input.pipelineState.stages,
              transitions: input.pipelineState.transitions,
              flow: input.pipelineState.flow,
              templateIntent: input.pipelineState.preparedDatasetLineage.preparationContext.templateIntent,
              preparedStorageReference: persistenceResult.output.persistence.storageReference,
            });
            const linkageIssues = validatePreparedDatasetLineageLinks(rebuiltLineage);
            const blockingLinkageIssue = linkageIssues.find((issue) => issue.severity === "error");
            if (blockingLinkageIssue) {
              errors.push(blockingLinkageIssue.message);
            } else {
              const reuse = buildPreparedDatasetReuseReference(rebuiltLineage, {
                displayName: input.pipelineState.identity.name,
                reusable: input.pipelineState.unifiedPreparationAsset.lineage.reusableAsAsset,
                additionalTags: input.pipelineState.unifiedPreparationAsset.lineage.reuseTags,
              });
              preparedOutput = Object.freeze({
                preparedAssetId: persistenceResult.output.dataset.preparedAssetId,
                preparedAssetVersionId: persistenceResult.output.dataset.preparedAssetVersionId,
                storageTargetId: persistenceResult.output.persistence.targetId,
                storageReference: persistenceResult.output.persistence.storageReference,
                lineageId: persistenceResult.output.lineage.lineageId,
              });
              lineageId = rebuiltLineage.lineageId;
              reusableAssetId = reuse.assetId;
            }
          }
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const completedAt = nowIso();
    const result: DataStudioPipelineExecutionResult = Object.freeze({
      pipelineId: input.pipelineState.identity.pipelineId,
      pipelineAssetId: input.pipelineState.identity.assetId,
      status: errors.length === 0 ? "completed" : "failed",
      stageResults: Object.freeze(stageResults),
      preparedOutput,
      lineageId,
      reusableAssetId,
      startedAt,
      completedAt,
      warnings: Object.freeze(warnings),
      errors: Object.freeze(errors),
    });

    return Object.freeze({
      unitId: request.unit.id,
      status: toStatus(result),
      outputMetadata: Object.freeze({
        pipelineId: result.pipelineId,
        pipelineAssetId: result.pipelineAssetId,
        stageCount: result.stageResults.length,
        completedStageCount: result.stageResults.filter((stage) => stage.status === "completed").length,
        warningCount: result.warnings.length,
        errorCount: result.errors.length,
        lineageId: result.lineageId,
      }),
      outputSummary: Object.freeze({
        headline: result.status === "completed" ? "Data pipeline completed" : "Data pipeline failed",
        detail: result.status === "completed"
          ? `Executed ${result.stageResults.filter((stage) => stage.status === "completed").length} stage(s) and persisted prepared output.`
          : result.errors[0] ?? "Data pipeline execution failed.",
      }),
      errorMessage: result.errors[0],
      provenance: createDataStudioPipelineExecutionProvenance(result),
      diagnostics: Object.freeze([
        ...result.warnings.map((message) => Object.freeze({
          code: "data-pipeline-warning",
          severity: "warning" as const,
          message,
        })),
        ...result.errors.map((message) => Object.freeze({
          code: "data-pipeline-error",
          severity: "error" as const,
          message,
        })),
      ]),
      artifacts: Object.freeze([
        Object.freeze({
          kind: DataStudioPipelineExecutionArtifacts.pipelineExecutionResult,
          value: result,
        }),
      ]),
    });
  }
}
