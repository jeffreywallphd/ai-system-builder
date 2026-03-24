import { ExecutionStatuses, ExecutionUnitKinds } from "../../domain/execution/ExecutionPlan";
import type {
  DatasetGenerationRequest,
  DatasetGenerationResult,
  DatasetGenerationService,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import {
  createDatasetGenerationExecutionArtifact,
  DatasetGenerationExecutionArtifacts,
  toDatasetGenerationExecutionProvenance,
} from "../../application/execution/DatasetGenerationExecutionAdapter";
import type {
  IExecutionUnitExecutionRequest,
  IExecutionUnitExecutionResult,
  IExecutionUnitHandler,
} from "../../application/execution/UnifiedExecutionEngine";
import type { ExecutionAssetLineageRecorder } from "../../application/assets-system/ExecutionAssetLineageRecorder";

function toExecutionStatus(result: DatasetGenerationResult): IExecutionUnitExecutionResult["status"] {
  switch (result.status) {
    case "completed":
    case "partial":
    case "degraded":
      return ExecutionStatuses.completed;
    case "cancelled":
      return ExecutionStatuses.cancelled;
    case "failed":
    default:
      return ExecutionStatuses.failed;
  }
}

export class DatasetGenerationExecutionUnitHandler implements IExecutionUnitHandler {
  constructor(
    private readonly datasetGenerationService: DatasetGenerationService,
    private readonly executionAssetLineageRecorder?: ExecutionAssetLineageRecorder,
  ) {}

  public canHandle(unit: IExecutionUnitExecutionRequest["unit"]): boolean {
    return unit.kind === ExecutionUnitKinds.datasetGeneration;
  }

  public async execute(
    request: IExecutionUnitExecutionRequest,
  ): Promise<IExecutionUnitExecutionResult> {
    const input = request.unitInputs?.[request.unit.id] as DatasetGenerationRequest | undefined;

    if (!input) {
      throw new Error(`Execution unit '${request.unit.id}' is missing dataset generation input.`);
    }

    const result = await this.datasetGenerationService.generate(input);
    await this.executionAssetLineageRecorder?.recordDatasetGeneration({
      request: input,
      result,
    });

    return Object.freeze({
      unitId: request.unit.id,
      status: toExecutionStatus(result),
      outputMetadata: Object.freeze({
        batchId: result.batchId,
        generatedCount: result.generatedCount,
        skippedCount: result.skippedCount,
        taskType: result.taskType,
      }),
      outputSummary: Object.freeze({
        headline: `Generated ${result.generatedCount} ${result.taskType.replace(/_/g, " ")} example${result.generatedCount === 1 ? "" : "s"}` ,
        detail: result.provenance.detail ?? `Skipped ${result.skippedCount} source document${result.skippedCount === 1 ? "" : "s"}.`,
        metadata: Object.freeze({
          batchId: result.batchId,
          generatedCount: result.generatedCount,
          skippedCount: result.skippedCount,
        }),
      }),
      provenance: toDatasetGenerationExecutionProvenance(result.provenance),
      artifacts: Object.freeze([
        createDatasetGenerationExecutionArtifact(DatasetGenerationExecutionArtifacts.datasetGenerationResult, result),
      ]),
      errorMessage: result.status === "failed"
        ? result.provenance.detail ?? result.provenance.fallbackReason ?? "Dataset generation failed."
        : undefined,
    });
  }
}
