import { describe, expect, it } from "bun:test";
import { Asset } from "../Asset";
import {
  AssetLocation,
  AssetRelationship,
  AssetSemanticMetadata,
  AssetSourceInfo,
  AssetTechnicalMetadata,
} from "../AssetMetadata";
import type { IAsset } from "../interfaces/IAsset";

const baseAssetInput = () => ({
  id: " asset-1 ",
  name: " Main image ",
  version: " v1 ",
  kind: "image" as const,
  source: new AssetSourceInfo({
    type: "generated",
    workflowId: "wf-1",
    nodeId: "node-1",
  }),
  location: new AssetLocation({
    accessMethod: "local-file",
    location: " /tmp/image.png ",
    format: "PNG",
  }),
  technicalMetadata: new AssetTechnicalMetadata({ width: 512, height: 512 }),
  semanticMetadata: new AssetSemanticMetadata({ tags: ["hero"] }),
  relationships: [
    new AssetRelationship({ assetId: "parent-1", kind: "parent" }),
    new AssetRelationship({ assetId: " parent-1 ", kind: "PARENT" }),
    new AssetRelationship({ assetId: "preview-1", kind: "preview" }),
  ],
});

describe("Asset", () => {
  it("normalizes identity and defaults status to draft", () => {
    const asset = new Asset(baseAssetInput());

    expect(asset.id).toBe("asset-1");
    expect(asset.name).toBe("Main image");
    expect(asset.version).toBe("v1");
    expect(asset.status).toBe("draft");
    expect(asset.relationships).toHaveLength(2);
    expect(() => (asset.relationships as AssetRelationship[]).push(new AssetRelationship({ assetId: "x", kind: "x" }))).toThrow();
  });

  it("requires non-empty id and name", () => {
    expect(() => new Asset({ ...baseAssetInput(), id: " " })).toThrow(
      "Asset.id cannot be empty."
    );
    expect(() => new Asset({ ...baseAssetInput(), name: " " })).toThrow(
      "Asset.name cannot be empty."
    );
  });

  it("requires concrete location for available assets", () => {
    expect(
      () =>
        new Asset({
          ...baseAssetInput(),
          status: "available",
          location: new AssetLocation({ accessMethod: "memory" }),
        })
    ).toThrow("Available assets must have a concrete location or reference.");
  });

  it("supports classification and relationship helper methods", () => {
    const generatedAsset = new Asset({ ...baseAssetInput(), status: "available" });
    const uploadedAsset = new Asset({
      ...baseAssetInput(),
      source: new AssetSourceInfo({ type: "uploaded" }),
      relationships: [new AssetRelationship({ assetId: "ancestor", kind: "source" })],
    });
    const derivedAsset = new Asset({
      ...baseAssetInput(),
      source: new AssetSourceInfo({ type: "generated", parentAssetId: "upstream" }),
    });

    expect(generatedAsset.isAvailable()).toBeTrue();
    expect(generatedAsset.isGenerated()).toBeTrue();
    expect(uploadedAsset.isGenerated()).toBeFalse();
    expect(derivedAsset.isDerived()).toBeTrue();
    expect(generatedAsset.belongsToWorkflow(" wf-1 ")).toBeTrue();
    expect(generatedAsset.belongsToNode(" node-1 ")).toBeTrue();
    expect(uploadedAsset.isRelatedTo(" ancestor ")).toBeTrue();
    expect(generatedAsset.isKind("image")).toBeTrue();
    expect(generatedAsset.toReferenceString()).toBe("Main image@v1");
  });

  it("produces immutable updates via with* methods and updates audit", () => {
    const base = new Asset({ ...baseAssetInput(), audit: { createdAt: new Date("2023-01-01T00:00:00.000Z") } });

    const withStatus = base.withStatus("pending");
    expect(withStatus).not.toBe(base);
    expect(withStatus.status).toBe("pending");
    expect(withStatus.audit?.updatedAt).toBeDefined();

    const withLocation = base.withLocation(
      new AssetLocation({ accessMethod: "remote-url", location: "https://x/y.png" })
    );
    expect(withLocation.location.accessMethod).toBe("remote-url");

    const withRelationship = base.withRelationship(
      new AssetRelationship({ assetId: "child-1", kind: "child" })
    );
    expect(withRelationship.relationships).toHaveLength(base.relationships.length + 1);

    const withMetadata = base.withSemanticMetadata(
      new AssetSemanticMetadata({ description: "updated" })
    );
    expect(withMetadata.semanticMetadata?.description).toBe("updated");
    expect(base.semanticMetadata?.description).toBeUndefined();
  });

  it("round-trips from interface contract", () => {
    const base = new Asset(baseAssetInput());
    const asInterface: IAsset = base;
    const cloned = Asset.from(asInterface);

    expect(cloned).toBeInstanceOf(Asset);
    expect(cloned).not.toBe(base);
    expect(cloned.id).toBe(base.id);
    expect(cloned.source).not.toBe(base.source);
    expect(cloned.location).not.toBe(base.location);
  });
});
