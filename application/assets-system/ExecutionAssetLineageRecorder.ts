import type { IWorkflowExecutionResult } from "../ports/interfaces/IWorkflowExecutor";
import type { IWorkflowExecutionInput } from "../ports/interfaces/IWorkflowExecutor";
import { ProjectArtifactToAssetSystemUseCase } from "./ProjectArtifactToAssetSystemUseCase";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";
import type { DatasetGenerationRequest, DatasetGenerationResult } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";
import type { SubmitModelTrainingJobRequest } from "../ports/interfaces/IModelTrainingRuntime";
import type { CanonicalAssetIdentityService } from "./CanonicalAssetIdentityService";

function toAssetId(executionId: string, assetId: string): string {
  return `workflow-output:${executionId}:${assetId}`;
}

export class ExecutionAssetLineageRecorder {
  constructor(
    private readonly projectionUseCase: ProjectArtifactToAssetSystemUseCase,
    private readonly versionRepository: IAssetVersionRepository,
    private readonly canonicalIdentityService?: CanonicalAssetIdentityService,
  ) {}

  public async recordWorkflowExecution(params: {
    readonly input: IWorkflowExecutionInput;
    readonly result: IWorkflowExecutionResult;
  }): Promise<void> {
    const inputVersionIds = await this.resolveInputVersionIds(params.input);

    for (let index = 0; index < params.result.outputAssets.length; index += 1) {
      const outputAsset = params.result.outputAssets[index];
      const outputAssetId = toAssetId(params.result.executionId, outputAsset.id || `asset-${index + 1}`);
      await this.projectionUseCase.execute({
        projectionKind: "workflow-output",
        assetId: outputAssetId,
        name: outputAsset.name,
        executionId: params.result.executionId,
        workflowId: params.input.workflow.id,
        nodeId: outputAsset.source.nodeId,
        location: outputAsset.location.location ?? `${params.result.executionId}:${outputAsset.id}`,
        contentType: outputAsset.location.contentType,
        format: outputAsset.location.format,
        checksum: outputAsset.technicalMetadata?.sha256,
        byteLength: outputAsset.technicalMetadata?.sizeBytes,
        inputVersionIds,
        transformationStatus: params.result.status === "failed"
          ? "failed"
          : params.result.provenance?.classification && params.result.provenance.classification !== "real"
            ? "degraded"
            : "success",
      });
    }
  }

  public async recordDatasetGeneration(params: {
    readonly request: DatasetGenerationRequest;
    readonly result: DatasetGenerationResult;
  }): Promise<void> {
    const sourceVersionIds = await this.resolveDatasetSourceVersionIds(params.request);
    await this.projectionUseCase.execute({
      projectionKind: "dataset-export",
      assetId: `dataset-generation:${params.result.datasetId}:${params.result.versionId}:${params.result.batchId}`,
      name: `${params.result.taskType} dataset generation batch`,
      datasetId: params.result.datasetId,
      datasetVersionId: params.result.versionId,
      location: `dataset://${params.result.datasetId}/${params.result.versionId}/batches/${params.result.batchId}`,
      format: "canonical_json",
      contentType: "application/vnd.ai-loom.dataset-generation+json",
      sourceVersionIds,
    });
  }

  public async recordModelTraining(params: {
    readonly request: SubmitModelTrainingJobRequest;
    readonly job: ModelTrainingJob;
  }): Promise<void> {
    const sourceVersionIds = await this.resolveModelTrainingSourceVersionIds(params.request);
    const terminalStatus = params.job.status;
    const transformationStatus = terminalStatus === "failed"
      ? "failed"
      : terminalStatus === "partially-completed" || terminalStatus === "cancelled"
        ? "partial"
        : params.job.provenance.truthfulness === "fallback" || params.job.provenance.truthfulness === "preparation-only"
          ? "degraded"
          : "success";

    for (const artifact of params.job.artifacts) {
      if (artifact.kind !== "trained-model" && artifact.kind !== "checkpoint" && artifact.kind !== "prepared-bundle") {
        continue;
      }

      await this.projectionUseCase.execute({
        projectionKind: "model-artifact",
        assetId: `${params.request.assetLineage?.outputAssetNamespace ?? "model-artifact"}:${params.job.id}:${artifact.id}`,
        name: artifact.label,
        modelTrainingJobId: params.job.id,
        location: artifact.location ?? `model-training://${params.job.id}/artifacts/${artifact.id}`,
        format: artifact.contentType?.includes("json") ? "json" : undefined,
        contentType: artifact.contentType,
        sourceVersionIds,
        provider: params.job.provenance.provider,
        runtime: params.job.provenance.runtime,
        transformationStatus,
        metadata: {
          artifactKind: artifact.kind,
          baseModelId: params.job.baseModelId,
          datasetId: params.job.datasetId,
          datasetVersionId: params.job.datasetVersionId,
        },
      });
    }
  }

  private async resolveInputVersionIds(input: IWorkflowExecutionInput): Promise<ReadonlyArray<string>> {
    const unique = new Set<string>();
    for (const asset of input.inputAssets ?? []) {
      const versions = await this.versionRepository.listVersionsByAssetId(asset.id);
      if (versions.length > 0) {
        unique.add(versions[0].versionId);
      }
    }

    return Object.freeze([...unique]);
  }

  private async resolveDatasetSourceVersionIds(request: DatasetGenerationRequest): Promise<ReadonlyArray<string>> {
    const unique = new Set<string>();
    for (const document of request.sourceDocuments) {
      const explicitVersionId = typeof document.metadata?.assetVersionId === "string"
        ? document.metadata.assetVersionId.trim()
        : undefined;
      if (explicitVersionId) {
        unique.add(explicitVersionId);
        continue;
      }

      const versions = await this.versionRepository.listVersionsByAssetId(document.id);
      if (versions.length > 0) {
        unique.add(versions[0].versionId);
      }
    }

    return Object.freeze([...unique]);
  }

  private async resolveModelTrainingSourceVersionIds(request: SubmitModelTrainingJobRequest): Promise<ReadonlyArray<string>> {
    const unique = new Set<string>();

    for (const versionId of request.assetLineage?.sourceVersionIds ?? []) {
      const normalized = versionId.trim();
      if (normalized) {
        unique.add(normalized);
      }
    }

    const resolvedDatasetVersionAssetId = request.assetLineage?.datasetVersionAssetId
      ?? await this.canonicalIdentityService?.resolveAssetId("dataset-version", `${request.datasetId}:${request.datasetVersionId}`);
    const resolvedBaseModelAssetId = request.assetLineage?.baseModelAssetId
      ?? await this.canonicalIdentityService?.resolveAssetId("base-model", request.baseModelId);

    const candidateAssetIds = [
      resolvedDatasetVersionAssetId,
      resolvedBaseModelAssetId,
      `dataset-version:${request.datasetId}:${request.datasetVersionId}`,
    ];

    for (const candidate of candidateAssetIds) {
      if (!candidate) {
        continue;
      }
      const versions = await this.versionRepository.listVersionsByAssetId(candidate);
      if (versions.length > 0) {
        unique.add(versions[0].versionId);
      }
    }

    return Object.freeze([...unique]);
  }
}
