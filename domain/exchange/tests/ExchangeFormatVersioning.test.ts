import { describe, expect, it } from "bun:test";
import { createAtomicAssetPackageManifest, createCompositeAssetPackageManifest } from "../AssetPackageManifest";
import { createBundleDependencySnapshot } from "../BundleDependencySnapshot";
import { ExchangeBundleReferenceRelations, ExchangeBundleSubjectKinds, createExchangeBundle } from "../ExchangeBundleDomain";
import {
  ExchangeFormatCompatibilities,
  ExchangeFormatVersion,
  ExchangeFormatVersionPolicy,
} from "../ExchangeFormatVersioning";
import { createSystemAsset } from "../../system-studio/SystemAssetDomain";
import { createSystemPackageManifest } from "../SystemPackageManifest";

describe("ExchangeFormatVersioning", () => {
  it("keeps exchange format versions distinct from asset and bundle identity for atomic/composite/system packaging", () => {
    const atomicManifest = createAtomicAssetPackageManifest({
      subject: {
        assetId: "asset:model",
        versionId: "asset:model:v1",
        kind: "atomic-asset",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      },
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    });
    const compositeManifest = createCompositeAssetPackageManifest({
      subject: {
        assetId: "asset:workflow",
        versionId: "asset:workflow:v7",
        kind: "composite-asset",
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
      },
      composition: [{ alias: "model", assetId: "asset:model", versionId: "asset:model:v1" }],
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1", relation: "component" }],
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    });
    const systemManifest = createSystemPackageManifest({
      root: {
        system: createSystemAsset({
          assetId: "system:root",
          versionId: "system:root:v2",
          components: [{ componentKind: "atomic", alias: "model", assetId: "asset:model", versionId: "asset:model:v1" }],
        }),
      },
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    });

    expect(atomicManifest.bundleFormatVersion).toBe("ai-loom.exchange-bundle.v1");
    expect(compositeManifest.bundleFormatVersion).toBe("ai-loom.exchange-bundle.v1");
    expect(systemManifest.bundleFormatVersion).toBe("ai-loom.exchange-bundle.v1");
    expect(atomicManifest.bundleFormatVersion).not.toBe(atomicManifest.subject.versionId);
    expect(compositeManifest.bundleFormatVersion).not.toBe(compositeManifest.subject.versionId);
    expect(systemManifest.bundleFormatVersion).not.toBe(systemManifest.subject.versionId);
  });

  it("returns compatible/incompatible/unknown outcomes through explicit policy", () => {
    const policy = ExchangeFormatVersionPolicy.create({
      minimumSupported: "ai-loom.exchange-bundle.v1",
      maximumSupported: "ai-loom.exchange-bundle.v2",
    });

    expect(policy.evaluate("ai-loom.exchange-bundle.v2").compatibility).toBe(ExchangeFormatCompatibilities.compatible);
    expect(policy.evaluate("ai-loom.exchange-bundle.v3").compatibility).toBe(ExchangeFormatCompatibilities.incompatible);
    expect(policy.evaluate("custom.exchange.v1").compatibility).toBe(ExchangeFormatCompatibilities.unknown);
  });

  it("links bundles, manifests, and dependency snapshots to explicit exchange format versions", () => {
    const bundle = createExchangeBundle({
      bundleId: "bundle:exchange:1",
      formatVersion: "ai-loom.exchange-bundle.v2",
      subject: {
        root: {
          assetId: "asset:model",
          versionId: "asset:model:v1",
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [],
      },
    });
    const dependencySnapshot = createBundleDependencySnapshot({
      rootSubject: {
        kind: ExchangeBundleSubjectKinds.atomicAsset,
        assetId: "asset:model",
        versionId: "asset:model:v1",
      },
      entries: [],
      bundleFormatVersion: "ai-loom.exchange-bundle.v2",
    });

    expect(bundle.formatVersion.value).toBe("ai-loom.exchange-bundle.v2");
    expect(dependencySnapshot.bundleFormatVersion).toBe("ai-loom.exchange-bundle.v2");
    expect(ExchangeFormatVersion.from(bundle.formatVersion.value).revision).toBe(2);
  });
});

