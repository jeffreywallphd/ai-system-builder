import { describe, expect, it } from "bun:test";
import type {
  ICommonImageNodeContract,
  IImageNodeExecutionRequest,
} from "@application/execution/comfyui/image-nodes/CommonImageNodeContracts";
import { ComfyImageNodeAdapterBase } from "../ComfyImageNodeAdapterPattern";
import { ComfyPromptInputNodeAdapter } from "../ComfyPromptInputNodeAdapter";

class TestAdapter extends ComfyImageNodeAdapterBase {
  public readonly contract: ICommonImageNodeContract = {
    identity: {
      id: "image.test",
      kind: "load-image",
      version: "1.0.0",
      displayName: "Test",
    },
    capabilities: {
      composable: true,
      inspectable: true,
      previewable: true,
      versionedInputs: true,
      deterministicByDefault: true,
    },
    inputContract: [{ id: "requiredInput", type: "text", required: true }],
    outputContract: [{ id: "image", type: "image" }],
    configContract: { version: "1.0.0", fields: [] },
  };

  protected resolveComfyClassType(): string {
    return "LoadImage";
  }

  protected mapRequestInputs(request: IImageNodeExecutionRequest): Readonly<Record<string, unknown>> {
    return {
      image: request.inputs.requiredInput,
    };
  }

  protected mapResultOutputs() {
    return [{ outputId: "image", value: "ok" }];
  }
}

describe("ComfyImageNodeAdapterPattern", () => {
  it("provides a reusable adapter structure with consistent contracts", () => {
    const adapter = new ComfyPromptInputNodeAdapter();
    const payload = adapter.toComfyPayload({
      nodeId: "node-1",
      inputs: {
        positivePrompt: "a cinematic portrait",
        model: { modelRef: "asset:model:sdxl", runtimeBindingRef: "runtime:model:sdxl" },
      },
    });

    expect(adapter.contract.identity.kind).toBe("prompt-input");
    expect(payload.classType).toBe("CLIPTextEncode");
    expect(payload.inputs.text).toBe("a cinematic portrait");
    expect(payload.inputs.clip).toBe("runtime:model:sdxl");
  });

  it("normalizes adapter outputs to internal execution response contracts", () => {
    const adapter = new ComfyPromptInputNodeAdapter();
    const response = adapter.fromComfyResult(
      {
        nodeId: "node-1",
        inputs: { positivePrompt: "hello", model: { modelRef: "asset:model:sdxl" } },
      },
      { outputs: { conditioning: ["cond"] }, metadata: { source: "test" } },
    );

    expect(response.status).toBe("completed");
    expect(response.outputs[0]?.outputId).toBe("promptConditioning");
    expect(response.inspection?.diagnostics).toEqual({ source: "test" });
  });

  it("enforces input contract and exposes normalized errors", () => {
    const adapter = new TestAdapter();
    expect(() => adapter.toComfyPayload({ nodeId: "node-1", inputs: {} })).toThrow(
      "missing required input",
    );

    const error = adapter.normalizeError(new Error("boom"), { nodeId: "node-1", inputs: {} });
    expect(error.code).toBe("image-node-execution-failed");
    expect(error.category).toBe("execution");
  });

  it("keeps Comfy-specific details in infrastructure adapters only", async () => {
    const module = await import(
      "../../../../../application/execution/comfyui/image-nodes/CommonImageNodeContracts"
    );

    expect(Object.keys(module).some((key) => key.toLowerCase().includes("comfy"))).toBe(false);
  });
});

