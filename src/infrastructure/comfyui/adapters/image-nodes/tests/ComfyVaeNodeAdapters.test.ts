import { describe, expect, it } from "bun:test";
import type {
  ICommonImageNodeInternalImage,
  ICommonImageNodeLatentRepresentation,
  ICommonImageNodeModelCapabilityRef,
} from "@application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import { VaeDecodeNodeAdapter } from "../VaeDecodeNodeAdapter";
import { VaeEncodeNodeAdapter } from "../VaeEncodeNodeAdapter";

describe("VAE encode/decode node adapters", () => {
  const model: ICommonImageNodeModelCapabilityRef = {
    modelRef: "asset:model:sdxl-base",
    runtimeBindingRef: "runtime:model:sdxl-base",
    adapterId: "image.model-loader",
    adapterVersion: "1.0.0",
  };

  const image: ICommonImageNodeInternalImage = {
    buffer: new Uint8Array([1, 2, 3, 4]),
    width: 512,
    height: 512,
    format: "png",
    mimeType: "image/png",
  };

  it("encodes internal image/model inputs into an internal latent representation", () => {
    const adapter = new VaeEncodeNodeAdapter();
    const payload = adapter.toComfyPayload({
      nodeId: "vae-encode-1",
      inputs: { image, model },
    });

    const response = adapter.fromComfyResult(
      {
        nodeId: "vae-encode-1",
        inputs: { image, model },
      },
      { outputs: { samples: "latent:encoded:1" } },
    );

    expect(payload.classType).toBe("VAEEncode");
    expect(payload.inputs.vae).toBe("runtime:model:sdxl-base");

    const latent = response.outputs[0]?.value as ICommonImageNodeLatentRepresentation;
    expect(latent.latentRef).toBe("latent:encoded:1");
    expect(latent.source).toBe("vae-encode");
    expect(latent.width).toBe(512);
    expect(latent.height).toBe(512);
    expect(response.outputs[1]?.outputId).toBe("metadata");
  });

  it("decodes internal latent/model inputs into standard internal image output", () => {
    const adapter = new VaeDecodeNodeAdapter();
    const latent: ICommonImageNodeLatentRepresentation = {
      latentRef: "latent:encoded:2",
      width: 768,
      height: 512,
      source: "vae-encode",
      adapterId: "image.vae-encode",
      adapterVersion: "1.0.0",
    };

    const payload = adapter.toComfyPayload({
      nodeId: "vae-decode-1",
      inputs: { latent, model },
    });

    const response = adapter.fromComfyResult(
      {
        nodeId: "vae-decode-1",
        inputs: { latent, model },
      },
      {
        outputs: {
          image: {
            buffer: new Uint8Array([9, 9, 9]),
            width: 768,
            height: 512,
            mimeType: "image/png",
            format: "png",
          },
        },
      },
    );

    expect(payload.classType).toBe("VAEDecode");
    expect(payload.inputs.samples).toBe("latent:encoded:2");

    const decoded = response.outputs[0]?.value as ICommonImageNodeInternalImage;
    expect(decoded.width).toBe(768);
    expect(decoded.height).toBe(512);
    expect(decoded.buffer.byteLength).toBeGreaterThan(0);
    expect(response.outputs[1]?.outputId).toBe("metadata");
  });

  it("normalizes unresolved dependency and invalid input failures", () => {
    const encodeAdapter = new VaeEncodeNodeAdapter();
    const decodeAdapter = new VaeDecodeNodeAdapter();

    const encodeError = encodeAdapter.normalizeError(
      new Error("VAE encode node requires a loaded model capability input."),
      { nodeId: "encode-invalid", inputs: {} },
    );

    const decodeError = decodeAdapter.normalizeError(
      new Error("VAE decode node input 'latent.latentRef' must be a non-empty string."),
      { nodeId: "decode-invalid", inputs: {} },
    );

    expect(encodeError.code).toBe("vae-encode-invalid");
    expect(encodeError.category).toBe("validation");
    expect(decodeError.code).toBe("vae-decode-invalid");
    expect(decodeError.category).toBe("validation");
  });

  it("keeps comfy-specific typing outside internal contracts", async () => {
    const module = await import(
      "../../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts"
    );

    expect(Object.keys(module).some((key) => key.toLowerCase().includes("comfy"))).toBe(false);
  });
});

