import { readFile } from "node:fs/promises";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import type { ImageGenerationRequest } from "../../../../contracts/image-generation";
import { TaskType, type RuntimeTaskRegistryPort } from "../../../../contracts/runtime";
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
  const validRequest: ImageGenerationRequest = {
    prompt: "cinematic portrait",
    width: 1024,
    height: 1024,
    steps: 28,
  };

  it("rejects empty prompt", async () => {
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry: createRuntimeTaskRegistryFake() });

    await expect(useCase.startImageGeneration({ ...validRequest, prompt: "   " })).rejects.toThrow(
      "Image generation requires a non-empty prompt.",
    );
  });

  it("starts image generation through runtime task registry using IMAGE_GENERATION task type", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry });

    await useCase.startImageGeneration(validRequest);

    expect(runtimeTaskRegistry.startTask).toHaveBeenCalledTimes(1);
    expect((runtimeTaskRegistry.startTask as ReturnType<typeof testDouble.fn>).mock.calls[0]?.[0]).toEqual({
      taskType: TaskType.IMAGE_GENERATION,
      payload: validRequest,
      requestId: undefined,
    });
  });

  it("preserves caller requestId", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry });

    const result = await useCase.startImageGeneration(validRequest, { requestId: "caller-req-42" });

    expect((runtimeTaskRegistry.startTask as ReturnType<typeof testDouble.fn>).mock.calls[0]?.[0]?.requestId).toBe("caller-req-42");
    expect(result).toEqual({ requestId: "img-req-1", status: "queued", metadata: { engine: "comfyui" } });
  });

  it("reads image generation status from runtime task registry", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry });

    const result = await useCase.readImageGeneration("img-req-1");

    expect(runtimeTaskRegistry.getTaskStatus).toHaveBeenCalledWith("img-req-1");
    expect(result.status).toBe("running");
  });

  it("cancels image generation through runtime task registry", async () => {
    const runtimeTaskRegistry = createRuntimeTaskRegistryFake();
    const useCase = new GenerateImageUseCase({ runtimeTaskRegistry });

    const result = await useCase.cancelImageGeneration("img-req-1");

    expect(runtimeTaskRegistry.cancelTask).toHaveBeenCalledWith("img-req-1");
    expect(result).toEqual({ requestId: "img-req-1", status: "cancelled", cancelled: true });
  });

  it("does not import ComfyUI or register image assets", async () => {
    const source = await readFile("modules/application/use-cases/image-generation/generate-image.use-case.ts", "utf-8");

    expect(source.includes("comfy")).toBe(false);
    expect(source.includes("registerImageAsset")).toBe(false);
    expect(source.includes("ImageAsset")).toBe(false);
  });
});
