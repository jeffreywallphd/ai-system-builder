import type {
  IComfyAdapterOutputRecord,
  IComfyAdapterResult,
  IComfyAdapterAssetReference,
} from "../../../../application/execution/comfyui/ComfyAdapterContract";
import type {
  IComfyPromptCompletion,
  IComfyPromptOutputArtifact,
} from "../ComfyQueueClient";

export class ComfyExecutionResultMapper {
  public map(params: {
    readonly completion: IComfyPromptCompletion;
    readonly consumedAssetRefs?: ReadonlyArray<IComfyAdapterAssetReference>;
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
  }): IComfyAdapterOutputRecord | undefined {
    if (params.artifact.kind === "text") {
      const reference = `${params.promptId}:${params.nodeId}:text:${params.index}`;
      return Object.freeze({
        nodeId: params.nodeId,
        kind: "text",
        reference,
        assetRef: Object.freeze({ assetId: reference }),
        lineage: this.createLineage(params),
        metadata: Object.freeze({ text: params.artifact.text ?? "" }),
      });
    }

    if (!params.artifact.filename) {
      return undefined;
    }

    const reference = `${params.promptId}:${params.nodeId}:${params.artifact.kind}:${params.artifact.filename}`;

    return Object.freeze({
      nodeId: params.nodeId,
      kind: params.artifact.kind,
      reference,
      assetRef: Object.freeze({ assetId: reference }),
      lineage: this.createLineage(params),
      metadata: Object.freeze({
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
}
