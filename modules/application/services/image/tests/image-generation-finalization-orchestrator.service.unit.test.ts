import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { TaskType } from "../../../../contracts/runtime";
import { ImageGenerationFinalizationOrchestratorService } from "../image-generation-finalization-orchestrator.service";

describe("ImageGenerationFinalizationOrchestratorService", () => {
  it("triggers finalization once for succeeded task and returns cached assets on repeat", async () => {
    const runtimeTaskRegistry = { getTaskStatus: testDouble.fn(async () => ({ requestId: "r1", taskType: TaskType.IMAGE_GENERATION, status: "succeeded", concurrencyClass: "unknown", data: { outputs: [{ type: "image", engine: "comfyui", fileName: "x.png" }] } })) };
    const assets = [{ assetId: "asset-1", artifactId: "artifact-1", storageKey: "generated/images/artifact-1.png", mediaType: "image/png", source: "generated" as const }];
    const finalizeImageGenerationService = { finalizeCompletedTask: testDouble.fn(async () => ({ assets })) };
    const orchestrator = new ImageGenerationFinalizationOrchestratorService({ runtimeTaskRegistry, finalizeImageGenerationService } as never);

    const first = await orchestrator.finalizeIfCompleted("r1");
    const second = await orchestrator.finalizeIfCompleted("r1");

    expect(finalizeImageGenerationService.finalizeCompletedTask).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ finalized: true, assets });
    expect(second).toEqual({ finalized: true, assets });
  });

  it("does not finalize non-succeeded tasks", async () => {
    const runtimeTaskRegistry = { getTaskStatus: testDouble.fn(async () => ({ requestId: "r1", taskType: TaskType.IMAGE_GENERATION, status: "running", concurrencyClass: "unknown" })) };
    const finalizeImageGenerationService = { finalizeCompletedTask: testDouble.fn(async () => ({ assets: [] })) };
    const orchestrator = new ImageGenerationFinalizationOrchestratorService({ runtimeTaskRegistry, finalizeImageGenerationService } as never);
    await orchestrator.finalizeIfCompleted("r1");
    expect(finalizeImageGenerationService.finalizeCompletedTask).not.toHaveBeenCalled();
  });

  it("returns already-persisted output asset refs without invoking finalization service", async () => {
    const runtimeTaskRegistry = { getTaskStatus: testDouble.fn(async () => ({ requestId: "r1", taskType: TaskType.IMAGE_GENERATION, status: "succeeded", concurrencyClass: "unknown", data: { outputs: [{ artifactId: "artifact-1", assetId: "asset-1", storageKey: "generated/images/artifact-1.png", mediaType: "image/png" }] } })) };
    const finalizeImageGenerationService = { finalizeCompletedTask: testDouble.fn(async () => ({ assets: [] })) };
    const orchestrator = new ImageGenerationFinalizationOrchestratorService({ runtimeTaskRegistry, finalizeImageGenerationService } as never);

    const result = await orchestrator.finalizeIfCompleted("r1");

    expect(finalizeImageGenerationService.finalizeCompletedTask).not.toHaveBeenCalled();
    expect(result).toEqual({ finalized: true, assets: [{ assetId: "asset-1", artifactId: "artifact-1", storageKey: "generated/images/artifact-1.png", mediaType: "image/png", source: "generated" }] });
  });
});
