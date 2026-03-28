import { describe, expect, it } from "bun:test";
import {
  BundleDependencyInclusionModes,
  BundleDependencySnapshotBuilder,
  createBundleDependencySnapshot,
} from "../BundleDependencySnapshot";
import { createAtomicAssetPackageManifest, createCompositeAssetPackageManifest } from "../AssetPackageManifest";
import { createSystemAsset } from "../../system-studio/SystemAssetDomain";
import { createSystemPackageManifest } from "../SystemPackageManifest";

describe("BundleDependencySnapshot", () => {
  it("captures direct dependencies for atomic and composite manifests with pinned references", () => {
    const atomicManifest = createAtomicAssetPackageManifest({
      subject: {
        assetId: "asset:model",
        versionId: "asset:model:v4",
        kind: "atomic-asset",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      },
      dependencies: [
        { assetId: "asset:tokenizer", versionId: "asset:tokenizer:v2", relation: "dependency" },
      ],
    });

    const compositeManifest = createCompositeAssetPackageManifest({
      subject: {
        assetId: "asset:workflow",
        versionId: "asset:workflow:v8",
        kind: "composite-asset",
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
      },
      composition: [
        { alias: "model", assetId: "asset:model", versionId: "asset:model:v4" },
      ],
      dependencies: [
        { assetId: "asset:model", versionId: "asset:model:v4", relation: "component" },
        { assetId: "asset:dataset", versionId: "asset:dataset:v3", relation: "dependency" },
      ],
    });

    const atomicSnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(atomicManifest);
    const compositeSnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(compositeManifest);

    expect(atomicSnapshot.entries.map((entry) => `${entry.kind}:${entry.dependency.assetId}@${entry.dependency.versionId}`)).toEqual([
      "direct:asset:tokenizer@asset:tokenizer:v2",
    ]);
    expect(compositeSnapshot.entries.map((entry) => `${entry.kind}:${entry.dependency.assetId}@${entry.dependency.versionId}:${entry.dependencyRole}`)).toEqual([
      "direct:asset:dataset@asset:dataset:v3:dependency",
      "direct:asset:model@asset:model:v4:component",
    ]);
  });

  it("captures coherent system-of-systems dependency snapshots from system manifests and dependency graph traversal", async () => {
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [
        { componentKind: "atomic", assetId: "asset:model", versionId: "asset:model:v1", alias: "model" },
      ],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
    });
    const child = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [
        { componentKind: "composite", assetId: "asset:workflow", versionId: "asset:workflow:v2", alias: "wf" },
      ],
      nestedSystems: [{ assetId: "system:grandchild", versionId: "system:grandchild:v4", alias: "grandchild" }],
    });
    const grandchild = createSystemAsset({
      assetId: "system:grandchild",
      versionId: "system:grandchild:v4",
      dependencies: [{ assetId: "asset:dataset", versionId: "asset:dataset:v5" }],
    });

    const systemManifest = createSystemPackageManifest({
      root: {
        system: root,
        children: [{ system: child, children: [{ system: grandchild }] }],
      },
    });

    const fromManifest = BundleDependencySnapshotBuilder.fromSystemPackageManifest(systemManifest);
    const fromGraph = await BundleDependencySnapshotBuilder.fromSystemAssetGraph({
      root,
      resolveSystem: (reference) => {
        if (reference.assetId === "system:child" && reference.versionId === "system:child:v1") {
          return child;
        }
        if (reference.assetId === "system:grandchild" && reference.versionId === "system:grandchild:v4") {
          return grandchild;
        }
        return undefined;
      },
    });

    expect(fromManifest.entries.some((entry) => entry.dependency.assetId === "system:child")).toBeTrue();
    expect(fromManifest.entries.some((entry) => entry.dependency.assetId === "asset:model")).toBeTrue();
    expect(fromGraph.entries.map((entry) => `${entry.kind}:${entry.dependency.assetId}@${entry.dependency.versionId}`)).toEqual([
      "direct:asset:model@asset:model:v1",
      "direct:system:child@system:child:v1",
      "transitive:asset:dataset@asset:dataset:v5",
      "transitive:asset:workflow@asset:workflow:v2",
      "transitive:system:grandchild@system:grandchild:v4",
    ]);
  });

  it("represents inclusion modes and deterministic ordering while staying distinct from runtime/deployment snapshots", async () => {
    const snapshot = await BundleDependencySnapshotBuilder.fromDependencyGraph({
      rootSubject: {
        kind: "composite-asset",
        assetId: "asset:workflow",
        versionId: "asset:workflow:v8",
      },
      resolveDirectDependencies: (reference) => {
        if (reference.assetId === "asset:workflow") {
          return [
            {
              dependency: { assetId: "asset:model", versionId: "asset:model:v2" },
              role: "component",
              inclusionMode: BundleDependencyInclusionModes.embedded,
            },
            {
              dependency: { assetId: "asset:dataset", versionId: "asset:dataset:v3" },
              role: "dependency",
              inclusionMode: BundleDependencyInclusionModes.referenced,
            },
          ];
        }
        if (reference.assetId === "asset:model") {
          return [{ dependency: { assetId: "asset:tokenizer", versionId: "asset:tokenizer:v5" }, role: "dependency" }];
        }
        return [];
      },
      maxDepth: 4,
    });

    const duplicate = createBundleDependencySnapshot({
      rootSubject: { kind: "atomic-asset", assetId: "asset:model", versionId: "asset:model:v2" },
      entries: [
        {
          dependency: { assetId: "asset:tokenizer", versionId: "asset:tokenizer:v5" },
          kind: "transitive",
          inclusionMode: "referenced",
          requiredBy: [{ assetId: "asset:model", versionId: "asset:model:v2" }],
        },
        {
          dependency: { assetId: "asset:tokenizer", versionId: "asset:tokenizer:v5" },
          kind: "direct",
          inclusionMode: "embedded",
          requiredBy: [{ assetId: "asset:model", versionId: "asset:model:v2" }],
        },
      ],
    });

    expect(snapshot.entries.map((entry) => `${entry.kind}:${entry.dependency.assetId}:${entry.inclusionMode}`)).toEqual([
      "direct:asset:dataset:referenced",
      "direct:asset:model:embedded",
      "transitive:asset:tokenizer:referenced",
    ]);
    expect(snapshot).not.toHaveProperty("runtimeResolution");
    expect(snapshot).not.toHaveProperty("deploymentResolution");
    expect(duplicate.entries).toEqual([
      expect.objectContaining({
        kind: "direct",
        inclusionMode: "embedded",
      }),
    ]);
  });
});
