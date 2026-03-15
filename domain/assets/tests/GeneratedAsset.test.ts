import { describe, expect, it } from "bun:test";
import { Asset } from "../Asset";
import { AssetLocation } from "../AssetMetadata";
import { GeneratedAsset } from "../GeneratedAsset";
import type { IAsset } from "../interfaces/IAsset";

const baseGeneratedInput = () => ({
  id: "gen-1",
  name: "Output",
  kind: "image" as const,
  location: new AssetLocation({ accessMethod: "remote-url", location: "https://cdn.example.com/output.png" }),
  workflowId: "wf-1",
  runtime: "comfyui" as const,
  provider: "internal",
});

describe("GeneratedAsset", () => {
  it("creates available generated assets with generation source defaults", () => {
    const asset = new GeneratedAsset(baseGeneratedInput());

    expect(asset.status).toBe("available");
    expect(asset.source.type).toBe("generated");
    expect(asset.isAvailable()).toBeTrue();
    expect(asset.isGenerated()).toBeTrue();
    expect(asset.isDerived()).toBeFalse();
  });

  it("switches to derived source when parentAssetId is provided", () => {
    const derived = new GeneratedAsset({
      ...baseGeneratedInput(),
      parentAssetId: "seed-asset",
      executionId: "run-1",
    });

    expect(derived.source.type).toBe("derived");
    expect(derived.isDerived()).toBeTrue();
    expect(derived.source.parentAssetId).toBe("seed-asset");
  });

  it("requires workflow/node/execution context", () => {
    expect(
      () =>
        new GeneratedAsset({
          ...baseGeneratedInput(),
          workflowId: undefined,
          nodeId: undefined,
          executionId: undefined,
        })
    ).toThrow(
      "GeneratedAsset should reference at least one of workflowId, nodeId, or executionId."
    );
  });

  it("supports immutable derived and context updates", () => {
    const asset = new GeneratedAsset(baseGeneratedInput());

    const derived = asset.withDerivedFrom("upstream-asset");
    expect(derived).not.toBe(asset);
    expect(derived.source.type).toBe("derived");
    expect(derived.source.parentAssetId).toBe("upstream-asset");

    const recontextualized = asset.withGenerationContext({
      nodeId: "node-2",
      executionId: "run-2",
      runtime: "vllm",
      provider: "new-provider",
    });
    expect(recontextualized.source.workflowId).toBe("wf-1");
    expect(recontextualized.source.nodeId).toBe("node-2");
    expect(recontextualized.source.executionId).toBe("run-2");
    expect(recontextualized.source.runtime).toBe("vllm");
    expect(recontextualized.source.provider).toBe("new-provider");
  });

  it("converts compatible Asset instances into GeneratedAsset", () => {
    const sourceAsset = new Asset({
      id: "a-1",
      name: "render",
      kind: "image",
      status: "available",
      location: new AssetLocation({ accessMethod: "remote-url", location: "https://x/y.png" }),
      source: {
        type: "generated",
        workflowId: "wf-7",
      },
    });

    const generated = GeneratedAsset.fromGenerated(sourceAsset);
    expect(generated).toBeInstanceOf(GeneratedAsset);
    expect(generated.source.workflowId).toBe("wf-7");
    expect(generated.status).toBe("available");
  });

  it("adheres to IAsset contract through inheritance", () => {
    const generated = new GeneratedAsset(baseGeneratedInput());
    const asInterface: IAsset = generated;

    expect(asInterface.toReferenceString()).toBe("Output");
    expect(asInterface.isKind("image")).toBeTrue();
  });
});
