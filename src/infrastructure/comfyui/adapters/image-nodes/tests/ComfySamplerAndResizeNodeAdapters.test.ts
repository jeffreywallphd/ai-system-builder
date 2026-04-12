import { describe, expect, it } from "bun:test";
import type {
  ICommonImageNodeInternalImage,
  ICommonImageNodeLatentRepresentation,
  ICommonImageNodeModelCapabilityRef,
  ICommonImageNodePromptConditioning,
} from "@application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import { ComfySamplerWrapperNodeAdapter } from "../ComfySamplerWrapperNodeAdapter";
import { ComfyResizeUpscaleNodeAdapter } from "../ComfyResizeUpscaleNodeAdapter";

describe("Comfy sampler wrapper and resize/upscale node adapters", () => {
  it("accepts internal model/prompt inputs and maps to internal sampler outputs", () => {
    const sampler = new ComfySamplerWrapperNodeAdapter();

    const model: ICommonImageNodeModelCapabilityRef = {
      modelRef: "asset:model:sdxl-base",
      runtimeBindingRef: "runtime:model:sdxl-base",
      adapterId: "image.model-loader",
      adapterVersion: "1.0.0",
    };

    const conditioning: ICommonImageNodePromptConditioning = {
      positivePrompt: "studio portrait of a robotic fox",
      negativePrompt: "blurry",
      source: "workflow-input",
      adapterId: "image.prompt-input",
      adapterVersion: "1.0.0",
    };

    const payload = sampler.toComfyPayload(
      {
        nodeId: "sample-1",
        inputs: {
          model,
          promptConditioning: conditioning,
        },
        config: {
          steps: 30,
          guidance: 5.5,
          seed: 123,
          sampler: "dpmpp_2m",
          scheduler: "karras",
          strength: 0.85,
        },
      },
      { runtimeOptions: { mode: "preview" } },
    );

    const response = sampler.fromComfyResult(
      {
        nodeId: "sample-1",
        inputs: {
          model,
          promptConditioning: conditioning,
        },
        config: {
          steps: 30,
          guidance: 5.5,
          seed: 123,
          sampler: "dpmpp_2m",
          scheduler: "karras",
          strength: 0.85,
        },
      },
      { outputs: { samples: "latent:node:1" } },
    );

    expect(payload.classType).toBe("KSampler");
    expect(payload.inputs.model).toBe("runtime:model:sdxl-base");
    expect(payload.inputs.steps).toBe(30);
    expect(payload.inputs.cfg).toBe(5.5);
    expect(payload.inputs.seed).toBe(123);
    expect(payload.inputs.sampler_name).toBe("dpmpp_2m");
    expect(payload.inputs.scheduler).toBe("karras");

    expect(response.outputs[0]?.outputId).toBe("latent");
    expect((response.outputs[0]?.value as ICommonImageNodeLatentRepresentation).source).toBe("sampler");
    expect(response.outputs[2]?.outputId).toBe("metadata");
    expect((response.outputs[2]?.value as { effectiveConfig: { steps: number } }).effectiveConfig.steps).toBe(30);
  });

  it("accepts internal image input and produces transformed image metadata", () => {
    const resize = new ComfyResizeUpscaleNodeAdapter();
    const image: ICommonImageNodeInternalImage = {
      buffer: new Uint8Array([1, 2, 3, 4]),
      width: 320,
      height: 180,
      format: "png",
      mimeType: "image/png",
    };

    const payload = resize.toComfyPayload({
      nodeId: "resize-1",
      inputs: {
        image,
        metadata: { origin: "sampler" },
      },
      config: {
        scaleFactor: 2,
        fit: "contain",
        strategy: "basic",
      },
    });

    const response = resize.fromComfyResult(
      {
        nodeId: "resize-1",
        inputs: {
          image,
          metadata: { origin: "sampler" },
        },
        config: {
          scaleFactor: 2,
          fit: "contain",
          strategy: "basic",
        },
      },
      { outputs: {} },
    );

    expect(payload.classType).toBe("ImageScale");
    expect(payload.inputs.width).toBe(640);
    expect(payload.inputs.height).toBe(360);

    expect(response.outputs[0]?.outputId).toBe("image");
    expect((response.outputs[0]?.value as ICommonImageNodeInternalImage).width).toBe(640);
    expect((response.outputs[0]?.value as ICommonImageNodeInternalImage).height).toBe(360);

    const metadata = response.outputs[1]?.value as { transform: { targetWidth: number; targetHeight: number } };
    expect(metadata.transform.targetWidth).toBe(640);
    expect(metadata.transform.targetHeight).toBe(360);
  });

  it("normalizes sampler and resize validation errors", () => {
    const sampler = new ComfySamplerWrapperNodeAdapter();
    const resize = new ComfyResizeUpscaleNodeAdapter();

    const samplerError = sampler.normalizeError(
      new Error("Sampler wrapper node config 'steps' must be an integer between 1 and 200."),
      { nodeId: "sample-invalid", inputs: {} },
    );

    const resizeError = resize.normalizeError(
      new Error("Resize/upscale node config 'width' must be a positive integer."),
      { nodeId: "resize-invalid", inputs: {} },
    );

    expect(samplerError.code).toBe("sampler-wrapper-invalid");
    expect(samplerError.category).toBe("validation");
    expect(resizeError.code).toBe("resize-upscale-invalid");
    expect(resizeError.category).toBe("validation");
  });

  it("keeps comfy-specific typing outside internal contracts", async () => {
    const module = await import(
      "../../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts"
    );

    expect(Object.keys(module).some((key) => key.toLowerCase().includes("comfy"))).toBe(false);
  });
});

