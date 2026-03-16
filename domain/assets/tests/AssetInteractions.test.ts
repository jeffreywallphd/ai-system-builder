import { describe, expect, it } from "bun:test";
import { Asset } from "../Asset";
import {
  AssetLocation,
  AssetRelationship,
  AssetSemanticMetadata,
  AssetSourceInfo,
  AssetTechnicalMetadata,
} from "../AssetMetadata";
import { GeneratedAsset } from "../GeneratedAsset";

describe("Asset interactions", () => {
  it("composes metadata classes through Asset and preserves behavior across conversions", () => {
    const source = new AssetSourceInfo({
      type: "generated",
      workflowId: "wf-100",
      nodeId: "node-44",
      executionId: "run-9",
      runtime: "comfyui",
    });
    const location = new AssetLocation({
      accessMethod: "remote-url",
      location: "https://cdn.example.com/final.png",
      format: "png",
      contentType: "image/png",
    });
    const technicalMetadata = new AssetTechnicalMetadata({ width: 1920, height: 1080 });
    const semanticMetadata = new AssetSemanticMetadata({
      tags: ["hero", "final"],
      attributes: { version: 2 },
    });

    const asset = new Asset({
      id: "asset-final",
      name: "Final Output",
      version: "1.0",
      kind: "image",
      status: "available",
      source,
      location,
      technicalMetadata,
      semanticMetadata,
      relationships: [new AssetRelationship({ assetId: "asset-source", kind: "source" })],
    });

    expect(asset.belongsToWorkflow("wf-100")).toBeTrue();
    expect(asset.location.accessMethod).toBe("remote-url");
    expect(asset.technicalMetadata?.width).toBe(1920);
    expect(asset.semanticMetadata?.hasTag?.("hero") ?? false).toBeTrue();

    const generated = GeneratedAsset.fromGenerated(asset);
    expect(generated).toBeInstanceOf(GeneratedAsset);
    expect(generated.isGenerated()).toBeTrue();
    expect(generated.belongsToNode("node-44")).toBeTrue();

    const derived = generated
      .withDerivedFrom("asset-final")
      .withGenerationContext({ provider: "comfyui-cloud", runtime: "vllm" });

    expect(derived.isDerived()).toBeTrue();
    expect(derived.source.parentAssetId).toBe("asset-final");
    expect(derived.source.provider).toBe("comfyui-cloud");
    expect(derived.source.runtime).toBe("vllm");
  });

  it("keeps relationship uniqueness stable through update chains", () => {
    const initial = new Asset({
      id: "asset-1",
      name: "Asset",
      kind: "json",
      source: new AssetSourceInfo({ type: "system" }),
      location: new AssetLocation({ accessMethod: "memory" }),
      relationships: [
        new AssetRelationship({ assetId: "a", kind: "source" }),
        new AssetRelationship({ assetId: "a", kind: "SOURCE" }),
      ],
    });

    const updated = initial
      .withRelationship(new AssetRelationship({ assetId: "b", kind: "child" }))
      .withRelationship(new AssetRelationship({ assetId: "b", kind: "CHILD" }));

    expect(initial.relationships).toHaveLength(1);
    expect(updated.relationships).toHaveLength(2);
    expect(updated.isRelatedTo("a")).toBeTrue();
    expect(updated.isRelatedTo("b")).toBeTrue();
  });
});
