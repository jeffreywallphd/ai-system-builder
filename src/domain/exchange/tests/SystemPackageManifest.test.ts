import { describe, expect, it } from "bun:test";
import { createSystemAsset } from "../../system-studio/SystemAssetDomain";
import { createSystemPackageManifest } from "../SystemPackageManifest";

describe("SystemPackageManifest", () => {
  it("preserves root identity/version and child references across atomic/composite/system components", () => {
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v4",
      components: [
        {
          componentKind: "atomic",
          alias: "model",
          assetId: "asset:model",
          versionId: "asset:model:v3",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        {
          componentKind: "composite",
          alias: "pipeline",
          assetId: "asset:pipeline",
          versionId: "asset:pipeline:v2",
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
        },
        {
          componentKind: "system",
          alias: "child-system-component",
          assetId: "system:child-a",
          versionId: "system:child-a:v1",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "conditional" },
        },
      ],
      nestedSystems: [
        { assetId: "system:child-b", versionId: "system:child-b:v3", alias: "child-system-nested" },
      ],
      inputs: [{ inputId: "input:prompt" }],
      outputs: [{ outputId: "output:result" }],
      parameters: [{ parameterId: "param:temperature" }],
      bindings: [{
        bindingId: "binding:model-input",
        source: { scope: "system-input", endpointId: "input:prompt" },
        target: { scope: "component-input", endpointId: "in", componentAlias: "model" },
      }],
    });

    const manifest = createSystemPackageManifest({
      root: { system: root },
      metadata: { dependencySnapshotHook: "bundle-dependency-snapshot.v1" },
    });

    expect(manifest.subject.assetId).toBe("system:root");
    expect(manifest.subject.versionId).toBe("system:root:v4");
    expect(manifest.nodes.map((entry) => `${entry.kind}:${entry.assetId}@${entry.versionId}`)).toEqual([
      "atomic:asset:model@asset:model:v3",
      "composite:asset:pipeline@asset:pipeline:v2",
      "system:system:child-a@system:child-a:v1",
      "system:system:child-b@system:child-b:v3",
      "system:system:root@system:root:v4",
    ]);
    expect(manifest.edges.map((entry) => `${entry.edgeKind}:${entry.fromNodeId}->${entry.toNodeId}`)).toEqual([
      "component:system:root@system:root:v4->asset:model@asset:model:v3",
      "component:system:root@system:root:v4->asset:pipeline@asset:pipeline:v2",
      "component:system:root@system:root:v4->system:child-a@system:child-a:v1",
      "nested-system:system:root@system:root:v4->system:child-a@system:child-a:v1",
      "nested-system:system:root@system:root:v4->system:child-b@system:child-b:v3",
    ]);
    expect(manifest.metadata.dependencySnapshotHook).toBe("bundle-dependency-snapshot.v1");
    expect(manifest.scope).toEqual({ excludesRuntimeState: true, excludesDeploymentState: true });
  });

  it("preserves nested system-of-systems relationships and deterministic shape", () => {
    const grandchild = createSystemAsset({
      assetId: "system:grandchild",
      versionId: "system:grandchild:v1",
      components: [
        {
          componentKind: "atomic",
          alias: "dataset",
          assetId: "asset:dataset",
          versionId: "asset:dataset:v5",
          taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
        },
      ],
    });
    const child = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v2",
      nestedSystems: [{ assetId: "system:grandchild", versionId: "system:grandchild:v1", alias: "nested-grandchild" }],
    });
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v8",
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v2", alias: "nested-child" }],
    });

    const input = {
      root: {
        system: root,
        children: [{
          system: child,
          children: [{ system: grandchild }],
        }],
      },
      metadata: { createdAt: "2026-03-28T00:00:00.000Z", deterministicInputKey: "system:root:v8" },
    } as const;

    const manifestA = createSystemPackageManifest(input);
    const manifestB = createSystemPackageManifest(input);

    expect(manifestA).toEqual(manifestB);
    expect(manifestA.composition.map((entry) => `${entry.parentAssetId}@${entry.parentVersionId}->${entry.childAssetId}@${entry.childVersionId}`)).toEqual([
      "system:child@system:child:v2->system:grandchild@system:grandchild:v1",
      "system:grandchild@system:grandchild:v1->asset:dataset@asset:dataset:v5",
      "system:root@system:root:v8->system:child@system:child:v2",
    ]);
    expect(manifestA.nodes.find((node) => node.assetId === "system:root")?.interface).toEqual({
      inputs: [], outputs: [], parameters: [], bindings: [],
    });
  });

  it("requires pinned versions and remains distinct from atomic/composite/runtime/deployment manifests", () => {
    const root = createSystemAsset({
      assetId: "system:unpinned",
      versionId: "system:unpinned:v1",
      components: [
        {
          componentKind: "atomic",
          alias: "missing-version",
          assetId: "asset:model",
        },
      ],
    });

    expect(() => createSystemPackageManifest({ root: { system: root } })).toThrow("must be version-pinned");

    const pinned = createSystemAsset({
      assetId: "system:pinned",
      versionId: "system:pinned:v3",
      components: [
        {
          componentKind: "atomic",
          alias: "model",
          assetId: "asset:model",
          versionId: "asset:model:v6",
        },
      ],
    });

    const manifest = createSystemPackageManifest({ root: { system: pinned } });
    expect(manifest.manifestVersion).toBe("ai-loom.system-package-manifest.v1");
    expect(manifest).not.toHaveProperty("runtimeState");
    expect(manifest).not.toHaveProperty("deploymentPlan");
    expect(manifest.subject.taxonomy.structuralKind).toBe("system");
  });
});
