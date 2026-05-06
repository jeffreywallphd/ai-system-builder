import { readFile } from "node:fs/promises";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import type { ImageGenerationRequest } from "../../../../contracts/image-generation";
import { TaskType, createRuntimeCapabilityStatus } from "../../../../contracts/runtime";
import type { RuntimeTaskRegistryPort } from "../../../ports/runtime";
import { GenerateImageUseCase } from "../generate-image.use-case";

function createRuntimeTaskRegistryFake(): RuntimeTaskRegistryPort {
  return {
    startTask: testDouble.fn(async () => ({ requestId: "img-req-1", status: "queued", metadata: { engine: "comfyui" } })),
    getTaskStatus: testDouble.fn(async () => ({ requestId: "img-req-1", taskType: TaskType.IMAGE_GENERATION, status: "running", concurrencyClass: "unknown" })),
    cancelTask: testDouble.fn(async () => ({ requestId: "img-req-1", status: "cancelled", cancelled: true })),
    listTasks: testDouble.fn(async () => ({ tasks: [] })),
  };
}

describe("GenerateImageUseCase", () => {
  const validRequest: ImageGenerationRequest = { prompt: "cinematic portrait", width: 1024, height: 1024, steps: 28 };

  it("rejects empty prompt", async () => {
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry: createRuntimeTaskRegistryFake() });
    await expect(useCase.startImageGeneration({ ...validRequest, prompt: "   " })).rejects.toThrow("Image generation requires a non-empty prompt.");
  });




  it("checks image-generation readiness before starting runtime task", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const runtimeCapabilityGuard = {
      requireCapabilityReady: testDouble.fn(async () => createRuntimeCapabilityStatus({ capabilityId: "image-generation", status: "ready" })),
    };
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry, runtimeCapabilityGuard });

    await useCase.startImageGeneration(validRequest);

    expect(runtimeCapabilityGuard.requireCapabilityReady).toHaveBeenCalledWith("image-generation");
    expect(runtimeTaskRegistry.startTask).toHaveBeenCalledTimes(1);
  });

  it("does not start image-generation runtime task when readiness is unavailable", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const unavailable = new Error("Runtime capability 'image-generation' is starting.") as Error & { code: "unavailable"; details: Record<string, unknown> };
    unavailable.code = "unavailable";
    unavailable.name = "RuntimeCapabilityUnavailableError";
    unavailable.details = { capabilityId: "image-generation", status: "starting", recommendedActions: ["wait"] };
    const useCase = new GenerateImageUseCase({
      runtimeTaskRegistry,
      runtimeCapabilityGuard: { requireCapabilityReady: testDouble.fn(async () => { throw unavailable; }) },
    });

    await useCase.startImageGeneration(validRequest).catch((error) => expect(error).toMatchObject({ code: "unavailable" }));
    expect(runtimeTaskRegistry.startTask).not.toHaveBeenCalled();
  });

  it("resolves selected model into checkpoint before runtime submission", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new GenerateImageUseCase({
      runtimeTaskRegistry,
      modelCheckpointResolver: {
        resolveCheckpoint: testDouble.fn(async () => ({ checkpoint: "sdxl.safetensors" })),
      },
    });

    await useCase.startImageGeneration({ ...validRequest, model: "record-123" });
    expect((runtimeTaskRegistry.startTask as ReturnType<typeof testDouble.fn>).mock.calls[0]?.[0]).toMatchObject({ payload: { model: "sdxl.safetensors" } });
  });

  it("passes through already-valid checkpoint filenames", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new GenerateImageUseCase({
      runtimeTaskRegistry,
      modelCheckpointResolver: { resolveCheckpoint: testDouble.fn(async () => ({ checkpoint: "existing.safetensors" })) },
    });
    await useCase.startImageGeneration({ ...validRequest, model: "existing.safetensors" });
    expect((runtimeTaskRegistry.startTask as ReturnType<typeof testDouble.fn>).mock.calls[0]?.[0]).toMatchObject({ payload: { model: "existing.safetensors" } });
  });
  it("read returns runtime task unchanged", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry });
    const result = await useCase.readImageGeneration("img-req-1");
    expect(result).toEqual({ requestId: "img-req-1", taskType: TaskType.IMAGE_GENERATION, status: "running", concurrencyClass: "unknown" });
  });

  it("does not import runtime adapter or HTTP client implementation details", async () => {
    const source = await readFile("modules/application/use-cases/image-generation/generate-image.use-case.ts", "utf-8");
    for (const fragment of ["adapters/runtime/comfyui", "createComfyUi", "ComfyUi", "axios", "fetch("]) {
      expect(source.includes(fragment)).toBe(false);
    }
  });
});
