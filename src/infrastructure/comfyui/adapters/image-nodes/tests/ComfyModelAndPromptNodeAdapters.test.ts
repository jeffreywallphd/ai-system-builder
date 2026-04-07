import { describe, expect, it } from "bun:test";
import type {
  ICommonImageNodeModelCapabilityRef,
  ICommonImageNodePromptConditioning,
} from "@application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import { ComfyModelLoaderNodeAdapter } from "../ComfyModelLoaderNodeAdapter";
import { ComfyPromptInputNodeAdapter } from "../ComfyPromptInputNodeAdapter";

describe("Comfy model loader and prompt input node adapters", () => {
  it("maps model selection into internal loaded model capability", () => {
    const adapter = new ComfyModelLoaderNodeAdapter();
    const payload = adapter.toComfyPayload(
      {
        nodeId: "model-1",
        inputs: { modelRef: "asset:model:sdxl-base" },
        config: { modelFamily: "sdxl", runtimeBindingRef: "runtime:model:sdxl-base" },
      },
      { runtimeOptions: { modelBindingRef: "ignored-when-config-present" } },
    );

    const response = adapter.fromComfyResult(
      {
        nodeId: "model-1",
        inputs: { modelRef: "asset:model:sdxl-base" },
        config: { modelFamily: "sdxl", runtimeBindingRef: "runtime:model:sdxl-base" },
      },
      { outputs: { model: { any: "value" } } },
    );

    const model = response.outputs[0]?.value as ICommonImageNodeModelCapabilityRef;

    expect(payload.classType).toBe("CheckpointLoaderSimple");
    expect(payload.inputs.ckpt_name).toBe("sdxl-base");
    expect(model.modelRef).toBe("asset:model:sdxl-base");
    expect(model.modelFamily).toBe("sdxl");
    expect(model.runtimeBindingRef).toBe("runtime:model:sdxl-base");
    expect(model.adapterId).toBe("image.model-loader");
  });

  it("maps prompt inputs into internal conditioning representation", () => {
    const promptAdapter = new ComfyPromptInputNodeAdapter();
    const payload = promptAdapter.toComfyPayload({
      nodeId: "prompt-1",
      inputs: {
        positivePrompt: "a cinematic portrait",
        negativePrompt: "blurry",
        model: {
          modelRef: "asset:model:sdxl-base",
          runtimeBindingRef: "runtime:model:sdxl-base",
        },
      },
      metadata: { promptSource: "ui", bindingRef: "binding:ui:prompt" },
    });

    const response = promptAdapter.fromComfyResult(
      {
        nodeId: "prompt-1",
        inputs: {
          positivePrompt: "a cinematic portrait",
          negativePrompt: "blurry",
          model: { modelRef: "asset:model:sdxl-base", runtimeBindingRef: "runtime:model:sdxl-base" },
        },
        metadata: { promptSource: "ui", bindingRef: "binding:ui:prompt" },
      },
      { outputs: { conditioning: ["conditioning"] } },
    );

    const conditioning = response.outputs[0]?.value as ICommonImageNodePromptConditioning;
    expect(payload.classType).toBe("CLIPTextEncode");
    expect(payload.inputs.text).toBe("a cinematic portrait");
    expect(payload.inputs.clip).toBe("runtime:model:sdxl-base");
    expect(conditioning.positivePrompt).toBe("a cinematic portrait");
    expect(conditioning.negativePrompt).toBe("blurry");
    expect(conditioning.source).toBe("ui");
    expect(conditioning.bindingRef).toBe("binding:ui:prompt");
  });

  it("normalizes invalid input errors into internal validation errors", () => {
    const modelAdapter = new ComfyModelLoaderNodeAdapter();
    const promptAdapter = new ComfyPromptInputNodeAdapter();

    const modelError = modelAdapter.normalizeError(
      new Error("Model loader node 'modelRef' must be a non-empty string."),
      { nodeId: "model-invalid", inputs: {} },
    );

    const promptError = promptAdapter.normalizeError(
      new Error("Prompt input node 'positivePrompt' must be a non-empty string."),
      { nodeId: "prompt-invalid", inputs: {} },
    );

    expect(modelError.code).toBe("model-loader-invalid");
    expect(modelError.category).toBe("validation");
    expect(promptError.code).toBe("prompt-input-invalid");
    expect(promptError.category).toBe("validation");
  });

  it("keeps Comfy-specific typing outside internal contracts", async () => {
    const module = await import(
      "../../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts"
    );

    expect(Object.keys(module).some((key) => key.toLowerCase().includes("comfy"))).toBe(false);
  });
});

