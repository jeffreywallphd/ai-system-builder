import { describe, expect, it } from "bun:test";
import { createAtomicAssetPackageManifest, createCompositeAssetPackageManifest } from "../AssetPackageManifest";
import { BundleDependencySnapshotBuilder, createBundleDependencySnapshot } from "../BundleDependencySnapshot";
import {
  ExchangeBundleReferenceRelations,
  ExchangeBundleSubjectKinds,
  createExchangeBundle,
} from "../ExchangeBundleDomain";
import { ExchangeBundleValidator } from "../ExchangeBundleValidation";
import { ExchangeFormatVersionPolicy } from "../ExchangeFormatVersioning";
import {
  ExchangeBundleDeserializer,
  ExchangeBundleSerializer,
} from "../ExchangeBundleSerialization";
import { createSystemAsset } from "../../system-studio/SystemAssetDomain";
import { createSystemPackageManifest } from "../SystemPackageManifest";

describe("Exchange bundle serialization and deserialization", () => {
  const validator = new ExchangeBundleValidator({
    formatVersionPolicy: ExchangeFormatVersionPolicy.create({
      minimumSupported: "ai-loom.exchange-bundle.v1",
      maximumSupported: "ai-loom.exchange-bundle.v2",
    }),
  });

  it("serializes valid atomic/composite/system bundles deterministically", () => {
    const serializer = new ExchangeBundleSerializer({ validator });

    const atomicManifest = createAtomicAssetPackageManifest({
      subject: {
        assetId: "asset:model",
        versionId: "asset:model:v1",
        kind: "atomic-asset",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      },
      dependencies: [{ assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1", relation: "dependency" }],
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
      metadata: {
        createdAt: "2026-03-28T00:00:00.000Z",
      },
    });

    const atomicBundle = createExchangeBundle({
      bundleId: "bundle:atomic:deterministic",
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
      metadata: { createdAt: "2026-03-28T00:00:00.000Z", tags: ["portable", "atomic"] },
    });

    const atomicSnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(atomicManifest);

    const atomicFirst = serializer.serialize({
      bundle: atomicBundle,
      manifest: atomicManifest,
      dependencySnapshot: atomicSnapshot,
    });
    const atomicSecond = serializer.serialize({
      bundle: atomicBundle,
      manifest: atomicManifest,
      dependencySnapshot: atomicSnapshot,
    });

    expect(atomicFirst.ok).toBeTrue();
    expect(atomicSecond.ok).toBeTrue();
    if (atomicFirst.ok && atomicSecond.ok) {
      expect(atomicFirst.artifact.content).toBe(atomicSecond.artifact.content);
      expect(atomicFirst.artifact.byteLength).toBeGreaterThan(0);
    }

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
      metadata: {
        createdAt: "2026-03-28T00:00:00.000Z",
      },
    });

    const compositeBundle = createExchangeBundle({
      bundleId: "bundle:composite:deterministic",
      formatVersion: "ai-loom.exchange-bundle.v1",
      subject: {
        root: {
          assetId: "asset:workflow",
          versionId: "asset:workflow:v1",
          kind: ExchangeBundleSubjectKinds.compositeAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [{
          assetId: "asset:model",
          versionId: "asset:model:v1",
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.component,
        }],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z", tags: ["composite", "portable"] },
    });

    const compositeSnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(compositeManifest);

    const compositeResult = serializer.serialize({
      bundle: compositeBundle,
      manifest: compositeManifest,
      dependencySnapshot: compositeSnapshot,
    });

    expect(compositeResult.ok).toBeTrue();

    const rootSystem = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [{ componentKind: "composite", alias: "workflow", assetId: "asset:workflow", versionId: "asset:workflow:v1" }],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });
    const childSystem = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [{ componentKind: "atomic", alias: "model", assetId: "asset:model", versionId: "asset:model:v1" }],
    });

    const systemManifest = createSystemPackageManifest({
      root: {
        system: rootSystem,
        children: [{ system: childSystem }],
      },
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
      metadata: {
        createdAt: "2026-03-28T00:00:00.000Z",
      },
    });

    const systemBundle = createExchangeBundle({
      bundleId: "bundle:system:sos",
      formatVersion: "ai-loom.exchange-bundle.v1",
      subject: {
        root: {
          assetId: "system:root",
          versionId: "system:root:v1",
          kind: ExchangeBundleSubjectKinds.systemAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [{
          assetId: "system:child",
          versionId: "system:child:v1",
          kind: ExchangeBundleSubjectKinds.systemAsset,
          relation: ExchangeBundleReferenceRelations.nestedSystem,
        }],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z", tags: ["system", "system-of-systems"] },
    });

    const systemSnapshot = BundleDependencySnapshotBuilder.fromSystemPackageManifest(systemManifest);
    const systemResult = serializer.serialize({
      bundle: systemBundle,
      manifest: systemManifest,
      dependencySnapshot: systemSnapshot,
    });

    expect(systemResult.ok).toBeTrue();
    if (systemResult.ok) {
      expect(systemResult.serialized.manifest.manifestVersion).toBe("ai-loom.system-package-manifest.v1");
      expect(systemResult.serialized.bundle.scope.excludesRuntimeState).toBeTrue();
      expect(systemResult.serialized.bundle.scope.excludesDeploymentState).toBeTrue();
      expect(systemResult.artifact.content).not.toContain("runtimeState");
      expect(systemResult.artifact.content).not.toContain("deploymentState");
    }
  });

  it("fails serialization for invalid bundles via authoritative validation", () => {
    const serializer = new ExchangeBundleSerializer({ validator });

    const manifest = createAtomicAssetPackageManifest({
      subject: {
        assetId: "asset:model",
        versionId: "asset:model:v1",
        kind: "atomic-asset",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      },
      dependencies: [{ assetId: "asset:tokenizer", relation: "dependency" }],
      bundleFormatVersion: "ai-loom.exchange-bundle.v9",
      metadata: {
        createdAt: "2026-03-28T00:00:00.000Z",
      },
    });

    const bundle = createExchangeBundle({
      bundleId: "bundle:invalid",
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
    });

    const snapshot = createBundleDependencySnapshot({
      rootSubject: {
        kind: ExchangeBundleSubjectKinds.atomicAsset,
        assetId: "asset:model",
        versionId: "asset:model:v1",
      },
      bundleFormatVersion: "ai-loom.exchange-bundle.v9",
      entries: [{
        dependency: { assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1" },
        kind: "direct",
        inclusionMode: "referenced",
        requiredBy: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
      }],
    });
    const result = serializer.serialize({ bundle, manifest, dependencySnapshot: snapshot });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.validation.valid).toBeFalse();
      expect(result.validation.issues.length).toBeGreaterThan(0);
    }
  });

  it("deserializes valid artifacts and preserves round-trip semantics", () => {
    const serializer = new ExchangeBundleSerializer({ validator });
    const deserializer = new ExchangeBundleDeserializer({
      validator,
      formatVersionPolicy: ExchangeFormatVersionPolicy.create({
        minimumSupported: "ai-loom.exchange-bundle.v1",
        maximumSupported: "ai-loom.exchange-bundle.v2",
      }),
    });

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
      metadata: {
        createdAt: "2026-03-28T00:00:00.000Z",
      },
    });

    const bundle = createExchangeBundle({
      bundleId: "bundle:roundtrip",
      formatVersion: "ai-loom.exchange-bundle.v1",
      subject: {
        root: {
          assetId: "asset:workflow",
          versionId: "asset:workflow:v2",
          kind: ExchangeBundleSubjectKinds.compositeAsset,
          relation: ExchangeBundleReferenceRelations.root,
        },
        references: [{
          assetId: "asset:model",
          versionId: "asset:model:v1",
          kind: ExchangeBundleSubjectKinds.atomicAsset,
          relation: ExchangeBundleReferenceRelations.component,
        }],
      },
      metadata: {
        createdAt: "2026-03-28T00:00:00.000Z",
        deterministicInputKey: "roundtrip-test",
      },
      provenance: {
        originType: "manual",
        metadata: { source: "test" },
      },
    });

    const dependencySnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(manifest);
    const serialized = serializer.serialize({ bundle, manifest, dependencySnapshot });
    expect(serialized.ok).toBeTrue();
    if (!serialized.ok) {
      throw new Error("Expected serializer success.");
    }

    const deserialized = deserializer.deserialize({ content: serialized.artifact.content });
    expect(deserialized.ok).toBeTrue();
    if (!deserialized.ok) {
      throw new Error("Expected deserializer success.");
    }

    expect(deserialized.deserialized.bundle.bundleId.value).toBe(bundle.bundleId.value);
    expect(deserialized.deserialized.bundle.subject.root).toEqual(bundle.subject.root);
    expect(deserialized.deserialized.bundle.scope).toEqual({ excludesRuntimeState: true, excludesDeploymentState: true });

    const reserialized = serializer.serialize(deserialized.deserialized);
    expect(reserialized.ok).toBeTrue();
    if (reserialized.ok) {
      expect(reserialized.artifact.content).toBe(serialized.artifact.content);
    }
  });

  it("returns structured failure outcomes for malformed artifacts and unsupported versions", () => {
    const deserializer = new ExchangeBundleDeserializer({
      validator,
      formatVersionPolicy: ExchangeFormatVersionPolicy.create({
        minimumSupported: "ai-loom.exchange-bundle.v1",
        maximumSupported: "ai-loom.exchange-bundle.v1",
      }),
    });

    const malformed = deserializer.deserialize({ content: "not-json" });
    expect(malformed.ok).toBeFalse();
    if (!malformed.ok) {
      expect(malformed.parseFailure?.kind).toBe("invalid-json");
    }

    const unsupportedArtifactVersion = deserializer.deserialize({
      content: JSON.stringify({ artifactVersion: "ai-loom.serialized-exchange-bundle.v99" }),
    });
    expect(unsupportedArtifactVersion.ok).toBeFalse();
    if (!unsupportedArtifactVersion.ok) {
      expect(unsupportedArtifactVersion.parseFailure?.kind).toBe("unsupported-artifact-version");
    }

    const unsupportedFormatPayload = {
      artifactVersion: "ai-loom.serialized-exchange-bundle.v1",
      bundle: {
        bundleId: "bundle:unsupported-format",
        formatVersion: "ai-loom.exchange-bundle.v5",
      },
      manifest: {
        manifestVersion: "ai-loom.asset-package-manifest.v1",
      },
      dependencySnapshot: {
        snapshotVersion: "ai-loom.bundle-dependency-snapshot.v1",
      },
    };

    const unsupportedFormat = deserializer.deserialize({ content: JSON.stringify(unsupportedFormatPayload) });
    expect(unsupportedFormat.ok).toBeFalse();
    if (!unsupportedFormat.ok) {
      expect(unsupportedFormat.formatVersionSupport?.compatibility).toBe("incompatible");
    }
  });
});
