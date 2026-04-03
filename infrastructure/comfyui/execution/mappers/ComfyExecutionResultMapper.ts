import type {
  IComfyAdapterOutputRecord,
  IComfyAdapterResult,
  IComfyAdapterAssetReference,
  IComfyAdapterExecutionContext,
} from "../../../../application/execution/comfyui/ComfyAdapterContract";
import type {
  IComfyPromptCompletion,
  IComfyPromptOutputArtifact,
} from "../ComfyQueueClient";

export class ComfyExecutionResultMapper {
  public map(params: {
    readonly completion: IComfyPromptCompletion;
    readonly consumedAssetRefs?: ReadonlyArray<IComfyAdapterAssetReference>;
    readonly executionContext?: IComfyAdapterExecutionContext;
  }): Pick<IComfyAdapterResult, "outputs" | "messages"> {
    const outputs: IComfyAdapterOutputRecord[] = [];

    for (const [nodeId, artifacts] of Object.entries(params.completion.outputs)) {
      artifacts.forEach((artifact, index) => {
        const normalized = this.mapArtifact({
          promptId: params.completion.promptId,
          nodeId,
          artifact,
          index,
          consumedAssetRefs: params.consumedAssetRefs,
          executionContext: params.executionContext,
        });

        if (normalized) {
          outputs.push(normalized);
        }
      });
    }

    return Object.freeze({
      outputs: Object.freeze(outputs),
      messages: params.completion.messages,
    });
  }

  private mapArtifact(params: {
    readonly promptId: string;
    readonly nodeId: string;
    readonly artifact: IComfyPromptOutputArtifact;
    readonly index: number;
    readonly consumedAssetRefs?: ReadonlyArray<IComfyAdapterAssetReference>;
    readonly executionContext?: IComfyAdapterExecutionContext;
  }): IComfyAdapterOutputRecord | undefined {
    const outputAssetId = this.createOutputAssetId(params);

    if (params.artifact.kind === "text") {
      return Object.freeze({
        nodeId: params.nodeId,
        kind: "text",
        reference: outputAssetId,
        assetRef: Object.freeze({ assetId: outputAssetId }),
        lineage: this.createLineage(params),
        metadata: this.createMetadata(params, { text: params.artifact.text ?? "" }),
      });
    }

    if (!params.artifact.filename) {
      return undefined;
    }

    return Object.freeze({
      nodeId: params.nodeId,
      kind: params.artifact.kind,
      reference: outputAssetId,
      assetRef: Object.freeze({ assetId: outputAssetId }),
      lineage: this.createLineage(params),
      metadata: this.createMetadata(params, {
        filename: params.artifact.filename,
        subfolder: params.artifact.subfolder,
        type: params.artifact.type,
        format: params.artifact.format,
      }),
    });
  }

  private createLineage(params: {
    readonly promptId: string;
    readonly nodeId: string;
    readonly consumedAssetRefs?: ReadonlyArray<IComfyAdapterAssetReference>;
  }): IComfyAdapterOutputRecord["lineage"] {
    return Object.freeze({
      sourceExecutionId: params.promptId,
      sourceNodeId: params.nodeId,
      consumedAssetRefs: Object.freeze([...(params.consumedAssetRefs ?? [])]),
    });
  }

  private createOutputAssetId(params: {
    readonly promptId: string;
    readonly nodeId: string;
    readonly artifact: IComfyPromptOutputArtifact;
    readonly index: number;
  }): string {
    return `asset:workflow-output:comfyui:${params.promptId}:${params.nodeId}:${params.artifact.kind}:${params.index}`;
  }

  private createMetadata(
    params: { readonly executionContext?: IComfyAdapterExecutionContext },
    base: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    return Object.freeze({
      ...base,
      outputDatasetRefs: Object.freeze([...(params.executionContext?.datasets.datasetAssetRefs ?? [])]),
      outputDatasetInstanceRefs: Object.freeze([
        ...(params.executionContext?.datasets.datasetInstanceRefs ?? []),
      ]),
    });
  }
}
