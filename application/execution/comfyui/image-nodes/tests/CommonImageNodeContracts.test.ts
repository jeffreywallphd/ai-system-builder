import { describe, expect, it } from "bun:test";
import { CommonImageNodeKinds, type ICommonImageNodeContract } from "../CommonImageNodeContracts";

describe("CommonImageNodeContracts", () => {
  it("covers the planned common image node kinds", () => {
    expect(CommonImageNodeKinds).toEqual([
      "load-image",
      "save-image",
      "model-loader",
      "prompt-input",
      "sampler-wrapper",
      "resize-upscale",
      "vae-encode",
      "vae-decode",
    ]);
  });

  it("supports preview/inspect/version/config surfaces with narrow contracts", () => {
    const contract: ICommonImageNodeContract = {
      identity: {
        id: "image.load-image",
        kind: "load-image",
        version: "1.0.0",
        displayName: "Load Image",
      },
      capabilities: {
        composable: true,
        inspectable: true,
        previewable: true,
        versionedInputs: true,
        deterministicByDefault: true,
      },
      inputContract: [{ id: "assetRef", type: "asset-reference", required: true, inspectable: true }],
      outputContract: [{ id: "image", type: "image", previewable: true, inspectable: true, versioned: true }],
      configContract: {
        version: "1.0.0",
        fields: [{ id: "colorSpace", type: "enum", options: ["srgb", "linear"] }],
      },
      inspection: {
        tags: ["image", "io"],
      },
    };

    expect(contract.capabilities.previewable).toBe(true);
    expect(contract.outputContract[0]?.versioned).toBe(true);
    expect(contract.configContract.fields[0]?.id).toBe("colorSpace");
  });

  it("keeps contracts runtime-agnostic", () => {
    const serialized = JSON.stringify(CommonImageNodeKinds);
    expect(serialized.includes("Comfy")).toBe(false);
    expect(serialized.includes("comfyui")).toBe(false);
  });
});
