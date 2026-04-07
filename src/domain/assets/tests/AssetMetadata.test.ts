import { describe, expect, it } from "bun:test";
import {
  AssetAuditInfo,
  AssetLocation,
  AssetRelationship,
  AssetSemanticMetadata,
  AssetSourceInfo,
  AssetTechnicalMetadata,
} from "../AssetMetadata";
import type {
  IAssetAuditInfo,
  IAssetLocation,
  IAssetRelationship,
  IAssetSemanticMetadata,
  IAssetSourceInfo,
  IAssetTechnicalMetadata,
} from "../interfaces/IAsset";

describe("AssetLocation", () => {
  it("normalizes optional string values and supports helpers", () => {
    const location = new AssetLocation({
      accessMethod: "remote-url",
      location: " https://cdn.example.com/img.png ",
      format: " PNG ",
      contentType: " IMAGE/PNG ",
    });

    expect(location.location).toBe("https://cdn.example.com/img.png");
    expect(location.format).toBe("png");
    expect(location.contentType).toBe("image/png");
    expect(location.hasLocation()).toBeTrue();
    expect(location.hasFormat("Png")).toBeTrue();
  });

  it("requires concrete location for location-based access methods", () => {
    expect(
      () =>
        new AssetLocation({
          accessMethod: "local-file",
          location: "  ",
        })
    ).toThrow("AssetLocation.location is required");
  });

  it("allows non-location methods without concrete location", () => {
    const memoryAsset = new AssetLocation({ accessMethod: "memory" });
    expect(memoryAsset.hasLocation()).toBeFalse();
  });

  it("clones from interface data", () => {
    const input: IAssetLocation = {
      accessMethod: "remote-url",
      location: " https://x/y ",
      format: "JPG",
      contentType: "IMAGE/JPEG",
    };

    const cloned = AssetLocation.from(input);
    expect(cloned).toBeInstanceOf(AssetLocation);
    expect(cloned.location).toBe("https://x/y");
    expect(cloned.format).toBe("jpg");
    expect(cloned.contentType).toBe("image/jpeg");
  });
});

describe("AssetSourceInfo", () => {
  it("normalizes values and supports source relationship helpers", () => {
    const source = new AssetSourceInfo({
      type: "generated",
      workflowId: " wf-1 ",
      nodeId: " node-1 ",
      executionId: " ex-1 ",
      parentAssetId: " parent ",
      provider: " provider ",
      runtime: "comfyui",
    });

    expect(source.workflowId).toBe("wf-1");
    expect(source.nodeId).toBe("node-1");
    expect(source.executionId).toBe("ex-1");
    expect(source.parentAssetId).toBe("parent");
    expect(source.provider).toBe("provider");
    expect(source.belongsToWorkflow(" wf-1 ")).toBeTrue();
    expect(source.belongsToNode(" node-1 ")).toBeTrue();
    expect(source.hasParent()).toBeTrue();
  });

  it("requires parentAssetId when type is derived", () => {
    expect(() => new AssetSourceInfo({ type: "derived" })).toThrow(
      "AssetSourceInfo.parentAssetId is required"
    );
  });

  it("clones from interface data", () => {
    const sourceInput: IAssetSourceInfo = {
      type: "imported",
      workflowId: "wf",
      nodeId: "node",
      executionId: "exec",
      parentAssetId: "parent",
      runtime: "ollama",
      provider: "provider",
    };

    const source = AssetSourceInfo.from(sourceInput);
    expect(source).toBeInstanceOf(AssetSourceInfo);
    expect(source.workflowId).toBe("wf");
    expect(source.provider).toBe("provider");
  });
});

describe("AssetTechnicalMetadata", () => {
  it("exposes technical profile helpers", () => {
    const metadata = new AssetTechnicalMetadata({
      width: 1024,
      height: 768,
      durationMs: 5000,
      sampleRateHz: 48000,
      sha256: " ABCDEF ",
    });

    expect(metadata.sha256).toBe("abcdef");
    expect(metadata.hasVisualDimensions()).toBeTrue();
    expect(metadata.hasDuration()).toBeTrue();
    expect(metadata.hasAudioProfile()).toBeTrue();
  });

  it("rejects negative values", () => {
    expect(() => new AssetTechnicalMetadata({ tokenCount: -1 })).toThrow(
      "AssetTechnicalMetadata.tokenCount cannot be negative."
    );
  });

  it("returns undefined from factory when no metadata is provided", () => {
    expect(AssetTechnicalMetadata.from(undefined)).toBeUndefined();
  });

  it("clones from interface object", () => {
    const metadataInput: IAssetTechnicalMetadata = { sizeBytes: 1, channels: 2 };
    const metadata = AssetTechnicalMetadata.from(metadataInput);

    expect(metadata).toBeInstanceOf(AssetTechnicalMetadata);
    expect(metadata?.sizeBytes).toBe(1);
    expect(metadata?.channels).toBe(2);
  });
});

describe("AssetSemanticMetadata", () => {
  it("normalizes and freezes collections", () => {
    const metadata = new AssetSemanticMetadata({
      description: " summary ",
      tags: [" hero ", "cinematic"],
      languageCodes: [" EN ", "Fr"],
      attributes: { featured: true, score: 0.97 },
    });

    expect(metadata.description).toBe("summary");
    expect(metadata.tags).toEqual(["hero", "cinematic"]);
    expect(metadata.languageCodes).toEqual(["en", "fr"]);
    expect(metadata.hasTag(" hero ")).toBeTrue();
    expect(metadata.getAttribute("score")).toBe(0.97);
    expect(() => (metadata.tags as string[]).push("x")).toThrow();
    expect(() => ((metadata.attributes as Record<string, unknown>).added = true)).toThrow();
  });

  it("returns undefined from factory when omitted", () => {
    expect(AssetSemanticMetadata.from(undefined)).toBeUndefined();
  });

  it("clones from interface object", () => {
    const semanticInput: IAssetSemanticMetadata = {
      description: "x",
      tags: ["tag"],
      languageCodes: ["en"],
      attributes: { valid: true },
    };

    const metadata = AssetSemanticMetadata.from(semanticInput);
    expect(metadata).toBeInstanceOf(AssetSemanticMetadata);
    expect(metadata?.tags).toEqual(["tag"]);
  });
});

describe("AssetAuditInfo", () => {
  it("clones dates and enforces createdAt <= updatedAt", () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    const updatedAt = new Date("2024-01-02T00:00:00.000Z");
    const audit = new AssetAuditInfo({ createdAt, updatedAt });

    expect(audit.createdAt).not.toBe(createdAt);
    expect(audit.updatedAt).not.toBe(updatedAt);
    expect(audit.createdAt?.getTime()).toBe(createdAt.getTime());
    expect(audit.updatedAt?.getTime()).toBe(updatedAt.getTime());

    expect(
      () =>
        new AssetAuditInfo({
          createdAt: new Date("2024-01-02T00:00:00.000Z"),
          updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        })
    ).toThrow("AssetAuditInfo.updatedAt cannot be earlier than createdAt.");
  });

  it("touch creates and updates timestamps predictably", () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    const touched = new AssetAuditInfo().touch(now);
    expect(touched.createdAt?.getTime()).toBe(now.getTime());
    expect(touched.updatedAt?.getTime()).toBe(now.getTime());

    const existing = new AssetAuditInfo({
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    const touchedExisting = existing.touch(now);
    expect(touchedExisting.createdAt?.toISOString()).toBe(
      "2024-01-01T00:00:00.000Z"
    );
    expect(touchedExisting.updatedAt?.getTime()).toBe(now.getTime());
  });

  it("clones from interface object", () => {
    const input: IAssetAuditInfo = {
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T01:00:00.000Z"),
    };

    const audit = AssetAuditInfo.from(input);
    expect(audit).toBeInstanceOf(AssetAuditInfo);
    expect(audit?.createdAt).not.toBe(input.createdAt);
  });
});

describe("AssetRelationship", () => {
  it("normalizes and matches relationship descriptors", () => {
    const relationship = new AssetRelationship({ assetId: " asset-1 ", kind: " Parent " });
    expect(relationship.assetId).toBe("asset-1");
    expect(relationship.kind).toBe("parent");

    expect(relationship.matches(" asset-1 ")).toBeTrue();
    expect(relationship.matches("asset-1", "PARENT")).toBeTrue();
    expect(relationship.matches("asset-2")).toBeFalse();
  });

  it("requires non-empty assetId and kind", () => {
    expect(() => new AssetRelationship({ assetId: " ", kind: "parent" })).toThrow(
      "AssetRelationship.assetId cannot be empty."
    );
    expect(() => new AssetRelationship({ assetId: "a", kind: " " })).toThrow(
      "AssetRelationship.kind cannot be empty."
    );
  });

  it("clones from interface object", () => {
    const input: IAssetRelationship = { assetId: "x", kind: "source" };
    const relationship = AssetRelationship.from(input);
    expect(relationship).toBeInstanceOf(AssetRelationship);
    expect(relationship.kind).toBe("source");
  });
});
