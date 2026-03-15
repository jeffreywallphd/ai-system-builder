import { describe, expect, it } from "bun:test";
import { Asset } from "../Asset";
import {
  AssetAuditInfo,
  AssetLocation,
  AssetRelationship,
  AssetSemanticMetadata,
  AssetSourceInfo,
  AssetTechnicalMetadata,
} from "../AssetMetadata";
import { GeneratedAsset } from "../GeneratedAsset";
import type {
  IAsset,
  IAssetAuditInfo,
  IAssetLocation,
  IAssetRelationship,
  IAssetSemanticMetadata,
  IAssetSourceInfo,
  IAssetTechnicalMetadata,
} from "../interfaces/IAsset";

const assertImplements = <T>(_value: T): void => {};

describe("Asset interface contracts", () => {
  it("ensures concrete classes satisfy domain interfaces", () => {
    const location = new AssetLocation({ accessMethod: "memory" });
    const source = new AssetSourceInfo({ type: "system" });
    const technical = new AssetTechnicalMetadata({ itemCount: 1 });
    const semantic = new AssetSemanticMetadata({ tags: ["x"] });
    const audit = new AssetAuditInfo({ createdAt: new Date() });
    const relationship = new AssetRelationship({ assetId: "asset-2", kind: "related" });

    assertImplements<IAssetLocation>(location);
    assertImplements<IAssetSourceInfo>(source);
    assertImplements<IAssetTechnicalMetadata>(technical);
    assertImplements<IAssetSemanticMetadata>(semantic);
    assertImplements<IAssetAuditInfo>(audit);
    assertImplements<IAssetRelationship>(relationship);

    const asset = new Asset({
      id: "a",
      name: "A",
      kind: "generic",
      source,
      location,
    });
    const generated = new GeneratedAsset({
      id: "g",
      name: "Generated",
      kind: "json",
      location: new AssetLocation({ accessMethod: "remote-url", location: "https://x/y.json" }),
      executionId: "run-1",
    });

    assertImplements<IAsset>(asset);
    assertImplements<IAsset>(generated);
    expect(asset.isKind("generic")).toBeTrue();
    expect(generated.isGenerated()).toBeTrue();
  });
});
