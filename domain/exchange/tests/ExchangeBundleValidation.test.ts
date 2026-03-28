import { describe, expect, it } from "bun:test";
import { createAtomicAssetPackageManifest, createCompositeAssetPackageManifest } from "../AssetPackageManifest";
import { BundleDependencySnapshotBuilder, createBundleDependencySnapshot } from "../BundleDependencySnapshot";
import {
  ExchangeBundleReferenceRelations,
  ExchangeBundleSubjectKinds,
  createExchangeBundle,
} from "../ExchangeBundleDomain";
import {
  ExchangeBundleValidationIssueKinds,
  ExchangeBundleValidator,
} from "../ExchangeBundleValidation";
import { ExchangeFormatVersionPolicy } from "../ExchangeFormatVersioning";
import { createSystemAsset } from "../../system-studio/SystemAssetDomain";
import { createSystemPackageManifest } from "../SystemPackageManifest";

describe("ExchangeBundleValidator", () => {
  const validator = new ExchangeBundleValidator({
    formatVersionPolicy: ExchangeFormatVersionPolicy.create({
      minimumSupported: "ai-loom.exchange-bundle.v1",
      maximumSupported: "ai-loom.exchange-bundle.v2",
    }),
  });

  it("accepts valid atomic/composite/system bundles with shared validation semantics", () => {
    const atomicManifest = createAtomicAssetPackageManifest({
      subject: {
        assetId: "asset:model",
        versionId: "asset:model:v1",
        kind: "atomic-asset",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      },
      dependencies: [{ assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1", relation: "dependency" }],
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    });
    const atomicBundle = createExchangeBundle({
      bundleId: "bundle:atomic:1",
      formatVersion: "ai-loom.exchange-bundle.v1",
      subject: {
        root: {
          assetId: "asset:model",
          versionId: "asset:model:v1",
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z" },
    });
    const atomicSnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(atomicManifest);

    const compositeManifest = createCompositeAssetPackageManifest({
      subject: {
        assetId: "asset:workflow",
        versionId: "asset:workflow:v1",
        kind: "composite-asset",
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
      },
      composition: [{ alias: "model", assetId: "asset:model", versionId: "asset:model:v1" }],
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1", relation: "component" }],
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    });
    const compositeBundle = createExchangeBundle({
      bundleId: "bundle:composite:1",
      formatVersion: "ai-loom.exchange-bundle.v1",
      subject: {
        root: {
          assetId: "asset:workflow",
          versionId: "asset:workflow:v1",
          kind: ExchangeBundleSubjectKinds.compositeAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z" },
    });
    const compositeSnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(compositeManifest);

    const rootSystem = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v4",
      components: [{ componentKind: "atomic", alias: "model", assetId: "asset:model", versionId: "asset:model:v1" }],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });
    const childSystem = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [{ componentKind: "composite", alias: "workflow", assetId: "asset:workflow", versionId: "asset:workflow:v1" }],
    });
    const systemManifest = createSystemPackageManifest({
      root: {
        system: rootSystem,
        children: [{ system: childSystem }],
      },
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    });
    const systemBundle = createExchangeBundle({
      bundleId: "bundle:system:1",
      formatVersion: "ai-loom.exchange-bundle.v1",
      subject: {
        root: {
          assetId: "system:root",
          versionId: "system:root:v4",
          kind: ExchangeBundleSubjectKinds.systemAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z" },
    });
    const systemSnapshot = BundleDependencySnapshotBuilder.fromSystemPackageManifest(systemManifest);

    expect(validator.validate({ bundle: atomicBundle, manifest: atomicManifest, dependencySnapshot: atomicSnapshot }).valid).toBeTrue();
    expect(validator.validate({ bundle: compositeBundle, manifest: compositeManifest, dependencySnapshot: compositeSnapshot }).valid).toBeTrue();
    expect(validator.validate({ bundle: systemBundle, manifest: systemManifest, dependencySnapshot: systemSnapshot }).valid).toBeTrue();
  });

  it("returns structured issues for unsupported versions, malformed manifests, and invalid snapshots", () => {
    const manifest = createAtomicAssetPackageManifest({
      subject: {
        assetId: "asset:model",
        versionId: "asset:model:v1",
        kind: "atomic-asset",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      },
      dependencies: [{ assetId: "asset:tokenizer", relation: "dependency" }],
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    });
    const bundle = createExchangeBundle({
      bundleId: "bundle:invalid:1",
      formatVersion: "ai-loom.exchange-bundle.v9",
      subject: {
        root: {
          assetId: "asset:model",
          versionId: "asset:model:v1",
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z" },
      provenance: { originType: "import" },
    });
    const snapshot = createBundleDependencySnapshot({
      rootSubject: { kind: ExchangeBundleSubjectKinds.atomicAsset, assetId: "asset:model", versionId: "asset:model:v2" },
      entries: [{
        dependency: { assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1" },
        kind: "direct",
        inclusionMode: "referenced",
        requiredBy: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
      }],
      bundleFormatVersion: "ai-loom.exchange-bundle.v2",
    });

    const result = validator.validate({ bundle, manifest, dependencySnapshot: snapshot });

    expect(result.valid).toBeFalse();
    expect(result.issues.map((issue) => issue.kind)).toContain(ExchangeBundleValidationIssueKinds.unsupportedFormatVersion);
    expect(result.issues.map((issue) => issue.kind)).toContain(ExchangeBundleValidationIssueKinds.invalidDependencySnapshot);
    expect(result.issues.map((issue) => issue.kind)).toContain(ExchangeBundleValidationIssueKinds.missingPinnedVersionIdentity);
    expect(result.issues.map((issue) => issue.kind)).toContain(ExchangeBundleValidationIssueKinds.invalidProvenanceShape);
  });

  it("flags manifest type mismatches and remains separate from runtime/deployment validation semantics", () => {
    const manifest = createCompositeAssetPackageManifest({
      subject: {
        assetId: "asset:workflow",
        versionId: "asset:workflow:v2",
        kind: "composite-asset",
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "conditional" },
      },
      composition: [{ alias: "model", assetId: "asset:model", versionId: "asset:model:v1" }],
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1", relation: "component" }],
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    });
    const bundle = createExchangeBundle({
      bundleId: "bundle:mismatch:1",
      formatVersion: "ai-loom.exchange-bundle.v1",
      subject: {
        root: {
          assetId: "asset:workflow",
          versionId: "asset:workflow:v2",
          kind: ExchangeBundleSubjectKinds.systemAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z" },
    });
    const snapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(manifest);

    const result = validator.validate({ bundle, manifest, dependencySnapshot: snapshot });

    expect(result.valid).toBeFalse();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: ExchangeBundleValidationIssueKinds.invalidSubjectManifestAlignment }),
    ]));
    expect(result.issues.some((issue) => issue.message.includes("runtime"))).toBeFalse();
    expect(result.issues.some((issue) => issue.message.includes("deployment"))).toBeFalse();
  });
});

