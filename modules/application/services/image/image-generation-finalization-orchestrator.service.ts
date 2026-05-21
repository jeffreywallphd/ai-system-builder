import { isWorkspaceId } from "../../../contracts/workspace";
import type { RuntimeTaskRegistryPort } from "../../ports/runtime";
import type { FinalizeImageGenerationService } from "./finalize-image-generation.service";

export class ImageGenerationFinalizationOrchestratorService {
  private readonly finalizedRequests = new Map<string, Array<{ assetId: string; artifactId: string; storageKey: string; mediaType: string; source: "generated" }>>();

  public constructor(
    private readonly dependencies: {
      runtimeTaskRegistry: RuntimeTaskRegistryPort;
      finalizeImageGenerationService: FinalizeImageGenerationService;
    },
  ) {}

  public async finalizeIfCompleted(requestId: string, workspaceId: string | undefined): Promise<{ finalized: boolean; assets?: Array<{ assetId: string; artifactId: string; storageKey: string; mediaType: string; source: "generated" }>; reason?: string }> {
    if (!isWorkspaceId(workspaceId)) return { finalized: false, reason: "workspace id is required" };
    const finalizedAssets = this.finalizedRequests.get(`${workspaceId}:${requestId}`);
    if (finalizedAssets) return { finalized: true, assets: finalizedAssets };

    const task = await this.dependencies.runtimeTaskRegistry.getTaskStatus(requestId);
    if ("recordType" in task || task.workspaceId !== workspaceId) return { finalized: false, reason: "task not found in workspace" };
    if (task.status !== "succeeded") return { finalized: false, reason: "task not completed" };

    const outputs = this.readOutputs(task.data);
    if (outputs.some((output) => this.hasArtifactId(output))) {
      const assets = outputs
        .map((output) => this.toFinalizedAssetRef(output))
        .filter((asset): asset is { assetId: string; artifactId: string; storageKey: string; mediaType: string; source: "generated" } => Boolean(asset));
      if (assets.length === 0) return { finalized: false, reason: "completed task did not report artifact-backed generated image outputs" };
      this.finalizedRequests.set(`${workspaceId}:${requestId}`, assets);
      return { finalized: true, assets };
    }

    const result = await this.dependencies.finalizeImageGenerationService.finalizeCompletedTask(task);
    this.finalizedRequests.set(`${workspaceId}:${requestId}`, result.assets);
    return { finalized: true, assets: result.assets };
  }

  private readOutputs(data: unknown): Array<Record<string, unknown>> {
    if (typeof data !== "object" || data === null) return [];
    const outputs = (data as { outputs?: unknown }).outputs;
    return Array.isArray(outputs) ? outputs.filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null) : [];
  }

  private hasArtifactId(output: Record<string, unknown>): boolean {
    const artifactId = output.artifactId;
    return typeof artifactId === "string" && artifactId.length > 0;
  }

  private toFinalizedAssetRef(output: Record<string, unknown>): { assetId: string; artifactId: string; storageKey: string; mediaType: string; source: "generated" } | undefined {
    const artifactId = output.artifactId;
    const storageKey = output.storageKey;
    if (typeof artifactId !== "string" || artifactId.length === 0 || typeof storageKey !== "string" || storageKey.length === 0) {
      return undefined;
    }

    return {
      assetId: typeof output.assetId === "string" && output.assetId.length > 0 ? output.assetId : artifactId,
      artifactId,
      storageKey,
      mediaType: typeof output.mediaType === "string" && output.mediaType.length > 0 ? output.mediaType : "image/png",
      source: "generated",
    };
  }
}
