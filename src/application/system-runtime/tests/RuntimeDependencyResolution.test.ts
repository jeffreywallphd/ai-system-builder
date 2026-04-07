import { describe, expect, it } from "bun:test";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  type SystemAsset,
  type SystemCompositionReference,
} from "@domain/system-studio/SystemAssetDomain";
import { resolveSystemRuntimeDependencies } from "../RuntimeDependencyResolution";

function createSystem(input: {
  readonly assetId: string;
  readonly versionId: string;
  readonly components?: SystemAsset["components"];
  readonly nestedSystems?: SystemAsset["nestedSystems"];
  readonly dependencies?: SystemAsset["dependencies"];
}): SystemAsset {
  return createSystemAsset({
    assetId: input.assetId,
    versionId: input.versionId,
    taxonomy: createSystemStudioTaxonomy("system", "deterministic"),
    components: input.components,
    nestedSystems: input.nestedSystems,
    dependencies: input.dependencies,
  });
}

describe("RuntimeDependencyResolution", () => {
  it("resolves runtime dependencies for mixed atomic/composite/system children", async () => {
    const root = createSystem({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [
        {
          componentKind: "atomic",
          alias: "model",
          assetId: "asset:model",
          versionId: "asset:model:v1",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        {
          componentKind: "composite",
          alias: "workflow",
          assetId: "asset:wf",
          versionId: "asset:wf:v7",
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "conditional" },
        },
        {
          componentKind: "system",
          alias: "child",
          assetId: "system:child",
          versionId: "system:child:v2",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
      ],
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v2", alias: "child" }],
      dependencies: [{ assetId: "asset:prompt", versionId: "asset:prompt:v1" }],
    });

    const child = createSystem({
      assetId: "system:child",
      versionId: "system:child:v2",
      components: [
        {
          componentKind: "atomic",
          alias: "dataset",
          assetId: "asset:dataset",
          versionId: "asset:dataset:v3",
          taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
        },
      ],
      dependencies: [{ assetId: "asset:embedding", versionId: "asset:embedding:v4" }],
    });

    const systems = new Map<string, SystemAsset>([["system:child::system:child:v2", child]]);
    const result = await resolveSystemRuntimeDependencies({
      root,
      resolveSystem: async (reference: SystemCompositionReference) => systems.get(`${reference.assetId}::${reference.versionId ?? ""}`),
      maxDepth: 4,
    });

    expect(result.recursion.status).toBe("complete");
    expect(result.resolvedComponents.some((entry) => entry.assetId === "asset:model")).toBe(true);
    expect(result.directDependencies.some((entry) => entry.assetId === "asset:prompt" && entry.versionId === "asset:prompt:v1")).toBe(true);
    expect(result.transitiveDependencies.some((entry) => entry.assetId === "asset:embedding" && entry.versionId === "asset:embedding:v4")).toBe(true);
  });

  it("keeps nested system resolution cycle-safe and depth-bounded", async () => {
    const root = createSystem({
      assetId: "system:a",
      versionId: "system:a:v1",
      components: [{ componentKind: "system", alias: "b", assetId: "system:b", versionId: "system:b:v1" }],
      nestedSystems: [{ assetId: "system:b", versionId: "system:b:v1", alias: "b" }],
    });
    const b = createSystem({
      assetId: "system:b",
      versionId: "system:b:v1",
      components: [{ componentKind: "system", alias: "a", assetId: "system:a", versionId: "system:a:v1" }],
      nestedSystems: [{ assetId: "system:a", versionId: "system:a:v1", alias: "a" }],
    });

    const systems = new Map<string, SystemAsset>([
      ["system:b::system:b:v1", b],
      ["system:a::system:a:v1", root],
    ]);

    const cycle = await resolveSystemRuntimeDependencies({
      root,
      resolveSystem: async (reference) => systems.get(`${reference.assetId}::${reference.versionId ?? ""}`),
      maxDepth: 4,
    });
    expect(cycle.recursion.status).toBe("cycle-detected");

    const depth = await resolveSystemRuntimeDependencies({
      root,
      resolveSystem: async (reference) => systems.get(`${reference.assetId}::${reference.versionId ?? ""}`),
      maxDepth: 1,
    });
    expect(depth.recursion.status).toBe("max-depth-exceeded");
  });

  it("preserves version-aware references in runtime dependency output", async () => {
    const root = createSystem({
      assetId: "system:root",
      versionId: "system:root:v9",
      dependencies: [
        { assetId: "asset:tool", versionId: "asset:tool:v2" },
        { assetId: "asset:config", versionId: "asset:config:v5" },
      ],
    });

    const result = await resolveSystemRuntimeDependencies({
      root,
      resolveSystem: async () => undefined,
    });

    expect(result.directDependencies.map((entry) => `${entry.assetId}@${entry.versionId}`)).toEqual([
      "asset:config@asset:config:v5",
      "asset:tool@asset:tool:v2",
    ]);
    expect(result.dependencyOrderingHints).toEqual([
      "asset:config::asset:config:v5",
      "asset:tool::asset:tool:v2",
    ]);
  });
});

