import type { IWorkflowExecutionResult } from "../ports/interfaces/IWorkflowExecutor";
import type { IWorkflowExecutionInput } from "../ports/interfaces/IWorkflowExecutor";
import { ProjectArtifactToAssetSystemUseCase } from "./ProjectArtifactToAssetSystemUseCase";

function toAssetId(executionId: string, assetId: string): string {
  return `workflow-output:${executionId}:${assetId}`;
}

export class ExecutionAssetLineageRecorder {
  constructor(private readonly projectionUseCase: ProjectArtifactToAssetSystemUseCase) {}

  public async recordWorkflowExecution(params: {
    readonly input: IWorkflowExecutionInput;
    readonly result: IWorkflowExecutionResult;
  }): Promise<void> {
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
        inputVersionIds: [],
      });
    }
  }
}
