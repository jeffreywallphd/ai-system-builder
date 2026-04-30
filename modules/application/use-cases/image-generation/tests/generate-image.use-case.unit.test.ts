import { readFile } from "node:fs/promises";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import type { ImageGenerationRequest } from "../../../../contracts/image-generation";
import { TaskType } from "../../../../contracts/runtime";
import type { RuntimeTaskRegistryPort } from "../../../ports/runtime";
import type { FinalizeImageGenerationService } from "../../../services/image/finalize-image-generation.service";
import { GenerateImageUseCase } from "../generate-image.use-case";

function createRuntimeTaskRegistryFake(): RuntimeTaskRegistryPort {
  return {
    startTask: testDouble.fn(async () => ({ requestId: "img-req-1", status: "queued", metadata: { engine: "comfyui" } })),
    getTaskStatus: testDouble.fn(async () => ({ requestId: "img-req-1", taskType: TaskType.IMAGE_GENERATION, status: "running", concurrencyClass: "unknown" })),
    cancelTask: testDouble.fn(async () => ({ requestId: "img-req-1", status: "cancelled", cancelled: true })),
    listTasks: testDouble.fn(async () => ({ tasks: [] })),
  };
}

function createFinalizeServiceFake(): FinalizeImageGenerationService {
  return { finalizeCompletedTask: testDouble.fn(async () => ({ assets: [{ assetId: "asset-1", artifactId: "art-1" }] })) } as unknown as FinalizeImageGenerationService;
}

describe("GenerateImageUseCase", () => {
  const validRequest: ImageGenerationRequest = {
    prompt: "cinematic portrait",
    width: 1024,
    height: 1024,
    steps: 28,
  };

  it("rejects empty prompt", async () => {
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry: createRuntimeTaskRegistryFake(), finalizeImageGenerationService: createFinalizeServiceFake() });
    await expect(useCase.startImageGeneration({ ...validRequest, prompt: "   " })).rejects.toThrow("Image generation requires a non-empty prompt.");
  });

  it("read returns task unchanged if status is not succeeded", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const finalizeService = createFinalizeServiceFake();
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry, finalizeImageGenerationService: finalizeService });
    const result = await useCase.readImageGeneration("img-req-1");
    expect(result.status).toBe("running");
    expect(finalizeService.finalizeCompletedTask).toHaveBeenCalledTimes(0);
  });

  it("read attaches assets when status is succeeded and invokes finalization once", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    (runtimeTaskRegistry.getTaskStatus as ReturnType<typeof testDouble.fn>).mockImplementation(async () => ({
      requestId: "img-req-1",
      taskType: TaskType.IMAGE_GENERATION,
      status: "succeeded",
      concurrencyClass: "unknown",
      data: { outputs: [{ fileName: "out.png" }] },
    }));
    const finalizeService = createFinalizeServiceFake();
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry, finalizeImageGenerationService: finalizeService });

    const result = await useCase.readImageGeneration("img-req-1");
    expect(finalizeService.finalizeCompletedTask).toHaveBeenCalledTimes(1);
    expect((result.data as { assets?: unknown }).assets).toEqual([{ assetId: "asset-1", artifactId: "art-1" }]);
  });

  it("does not import runtime adapter or HTTP client implementation details", async () => {
    const source = await readFile("modules/application/use-cases/image-generation/generate-image.use-case.ts", "utf-8");
    for (const fragment of ["adapters/runtime/comfyui", "createComfyUi", "ComfyUi", "axios", "fetch("]) {
      expect(source.includes(fragment)).toBe(false);
    }
  });
});
