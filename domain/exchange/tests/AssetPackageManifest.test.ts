import { describe, expect, it } from "bun:test";
import {
  createAtomicAssetPackageManifest,
  createCompositeAssetPackageManifest,
} from "../AssetPackageManifest";

describe("AssetPackageManifest", () => {
  it("preserves identity/version/taxonomy for atomic assets", () => {
    const manifest = createAtomicAssetPackageManifest({
      subject: {
        assetId: "asset:model",
        versionId: "asset:model:v4",
        kind: "atomic-asset",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      },
      metadata: {
        packageLabel: "Core model package",
        tags: ["primary", "primary", "model"],
      },
      dependencies: [
        { assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1", relation: "dependency" },
      ],
      contract: {
        version: "contract:v1",
        parameters: [{ id: "temperature", required: false, valueType: "number" }],
      },
      provenance: {
        originType: "manual",
        sourceVersionLineage: ["asset:model:v3"],
      },
    });

    expect(manifest.type).toBe("atomic");
    expect(manifest.subject.assetId).toBe("asset:model");
    expect(manifest.subject.versionId).toBe("asset:model:v4");
    expect(manifest.subject.taxonomy.semanticRole).toBe("model");
    expect(manifest.metadata.tags).toEqual(["model", "primary"]);
    expect(manifest.bundleFormatVersion).toBe("ai-loom.exchange-bundle.v1");
  });

  it("preserves composition metadata for composite assets", () => {
    const manifest = createCompositeAssetPackageManifest({
      subject: {
        assetId: "asset:workflow",
        versionId: "asset:workflow:v8",
        kind: "composite-asset",
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "conditional" },
      },
      composition: [
        {
          alias: "llm",
          assetId: "asset:model",
          versionId: "asset:model:v4",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        {
          alias: "config",
          assetId: "asset:config",
          versionId: "asset:config:v2",
        },
      ],
      dependencies: [
        { assetId: "asset:model", versionId: "asset:model:v4", relation: "component" },
        { assetId: "asset:config", versionId: "asset:config:v2", relation: "component" },
      ],
      bundleFormatVersion: "ai-loom.exchange-bundle.v2",
    });

    expect(manifest.type).toBe("composite");
    expect(manifest.bundleFormatVersion).toBe("ai-loom.exchange-bundle.v2");
    expect(manifest.composition.map((entry) => `${entry.alias}:${entry.assetId}@${entry.versionId}`)).toEqual([
      "config:asset:config@asset:config:v2",
      "llm:asset:model@asset:model:v4",
    ]);
    expect(manifest.dependencies.map((entry) => `${entry.assetId}@${entry.versionId}`)).toEqual([
      "asset:config@asset:config:v2",
      "asset:model@asset:model:v4",
    ]);
  });

  it("produces deterministic manifest shape for version-pinned input and remains distinct from runtime/deployment/system-level manifests", () => {
    const input = {
      subject: {
        assetId: "asset:tool-chain",
        versionId: "asset:tool-chain:v2",
        kind: "composite-asset" as const,
        taxonomy: { structuralKind: "composite", semanticRole: "tool-chain", behaviorKind: "deterministic" as const },
      },
      composition: [
        { alias: "b", assetId: "asset:tool-b", versionId: "asset:tool-b:v1" },
        { alias: "a", assetId: "asset:tool-a", versionId: "asset:tool-a:v3" },
      ],
      dependencies: [
        { assetId: "asset:tool-a", versionId: "asset:tool-a:v3", relation: "dependency" as const },
        { assetId: "asset:tool-b", versionId: "asset:tool-b:v1", relation: "dependency" as const },
      ],
      metadata: { deterministicInputKey: "snapshot:abc" },
    };

    const manifestA = createCompositeAssetPackageManifest(input);
    const manifestB = createCompositeAssetPackageManifest(input);

    expect(manifestA.subject.versionId).toBe("asset:tool-chain:v2");
    expect(manifestA.manifestVersion).toBe("ai-loom.asset-package-manifest.v1");
    expect(manifestA.type).toBe("composite");
    expect(manifestA).toEqual(manifestB);
    expect(manifestA).not.toHaveProperty("runtimeState");
    expect(manifestA).not.toHaveProperty("deploymentConfiguration");
    expect(manifestA.subject.kind).not.toBe("system-asset");
  });
});
