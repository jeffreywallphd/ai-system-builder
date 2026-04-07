import { describe, expect, it } from "bun:test";
import { AssetDetailLayoutResolver, AssetDetailSectionKeys } from "../AssetDetailPresentationModel";
import type { RegistryAsset } from "@domain/asset-registry/RegistryAsset";

function makeAsset(overrides: Partial<RegistryAsset> = {}): RegistryAsset {
  return {
    assetId: "asset:workflow:demo",
    versionId: "asset:workflow:demo:v1",
    name: "Demo Workflow",
    kind: "workflow",
    status: "active",
    taxonomy: {
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "deterministic",
    },
    contract: {
      execution: {
        invocationMode: "sync",
        sideEffects: "none",
      },
      version: "1.0.0",
      parameters: [{ id: "input", required: true }],
    },
    provenance: {
      sourceType: "workflow",
      sourceLabel: "Workflow Studio",
      creatorId: "tester",
      derivationContext: "manual",
      upstreamAssets: [],
      directUpstreamVersionIds: [],
      directDownstreamVersionIds: [],
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-02T00:00:00.000Z"),
    },
    dependencies: [
      { direction: "upstream", assetId: "asset:model:1", versionId: "asset:model:1:v1", source: "draft-dependency" },
      { direction: "downstream", assetId: "asset:system:1", versionId: "asset:system:1:v1", source: "lineage-edge" },
    ],
    versionHistory: [],
    lineage: {
      rootVersionId: "asset:workflow:demo:v1",
      upstream: [{ assetId: "asset:model:1", versionId: "asset:model:1:v1", depth: 1 }],
      downstream: [{ assetId: "asset:system:1", versionId: "asset:system:1:v1", depth: 1 }],
    },
    ...overrides,
  } as RegistryAsset;
}

describe("AssetDetailLayoutResolver", () => {
  it("builds a consistent section structure for composite and system assets", () => {
    const resolver = new AssetDetailLayoutResolver();
    const workflowModel = resolver.resolve(makeAsset());
    const systemModel = resolver.resolve(makeAsset({
      taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
      kind: "system",
      systemDetails: {
        selectedChildren: [{ componentKind: "composite", assetId: "asset:child:1" }],
        interfaces: { inputs: [], outputs: [], parameters: [] },
        bindings: { count: 2, bindingIds: ["bind-1", "bind-2"] },
        aggregatedDependencies: { directCount: 1, transitiveCount: 2, totalCount: 3, traversalStatus: "complete" },
        versionLineage: {
          currentVersionId: "asset:system:1:v1",
          nestedSystemVersionReferences: [],
          childVersionReferences: [],
        },
      },
    }));

    expect(workflowModel.sections.map((entry) => entry.key)).toEqual([
      AssetDetailSectionKeys.summary,
      AssetDetailSectionKeys.structure,
      AssetDetailSectionKeys.relationships,
      AssetDetailSectionKeys.metadata,
      AssetDetailSectionKeys.advanced,
    ]);
    expect(systemModel.sections.find((entry) => entry.key === AssetDetailSectionKeys.structure)?.items[1]?.value).toContain("1 component");
  });

  it("keeps taxonomy in metadata sections instead of primary summary", () => {
    const resolver = new AssetDetailLayoutResolver();
    const model = resolver.resolve(makeAsset());

    const summaryText = model.sections
      .find((section) => section.key === AssetDetailSectionKeys.summary)
      ?.items.map((item) => item.label)
      .join(" ");
    const metadataText = model.sections
      .find((section) => section.key === AssetDetailSectionKeys.metadata)
      ?.items.map((item) => item.label)
      .join(" ");

    expect(summaryText).not.toContain("Role");
    expect(metadataText).toContain("Role");
    expect(metadataText).toContain("Behavior");
    expect(metadataText).toContain("Structure");
  });
});

