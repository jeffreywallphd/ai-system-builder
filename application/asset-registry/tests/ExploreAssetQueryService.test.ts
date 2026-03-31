import { describe, expect, it } from "bun:test";
import type { RegistryAsset } from "../../../domain/asset-registry/RegistryAsset";
import { createPersistedWorkflowRecord } from "../../../domain/workflow-studio/WorkflowPersistenceDomain";
import { createEmptyWorkflowDraft } from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds } from "../../../domain/taxonomy/CompositionTaxonomy";
import { ExploreAssetKinds, ExploreAssetQueryService } from "../ExploreAssetQueryService";

const seedAssets: ReadonlyArray<RegistryAsset> = Object.freeze([
  Object.freeze({
    assetId: "asset:model",
    versionId: "asset:model:v1",
    name: "Embedding Model",
    kind: "generic",
    status: "published",
    taxonomy: {
      structuralKind: TaxonomyStructuralKinds.atomic,
      semanticRole: TaxonomySemanticRoles.model,
      behaviorKind: TaxonomyBehaviorKinds.none,
    },
    provenance: {
      sourceType: "generated",
      sourceLabel: "model-studio",
      creatorId: "author:model",
      upstreamAssets: [],
      directUpstreamVersionIds: [],
      directDownstreamVersionIds: [],
    },
    dependencies: [],
    versionHistory: [{
      versionId: "asset:model:v1",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      upstreamVersionIds: [],
      upstreamAdded: [],
      upstreamRemoved: [],
    }],
    lineage: { upstream: [], downstream: [] },
  }),
  Object.freeze({
    assetId: "asset:workflow",
    versionId: "asset:workflow:v3",
    name: "Daily Workflow",
    kind: "workflow-definition",
    status: "published",
    taxonomy: {
      structuralKind: TaxonomyStructuralKinds.composite,
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    },
    provenance: {
      sourceType: "generated",
      sourceLabel: "workflow-studio",
      creatorId: "author:workflow",
      upstreamAssets: [],
      directUpstreamVersionIds: ["asset:model:v1"],
      directDownstreamVersionIds: [],
    },
    dependencies: [{
      direction: "upstream",
      assetId: "asset:model",
      versionId: "asset:model:v1",
      source: "version-upstream",
    }],
    versionHistory: [{
      versionId: "asset:workflow:v3",
      createdAt: new Date("2026-03-05T00:00:00.000Z"),
      upstreamVersionIds: ["asset:model:v1"],
      upstreamAdded: ["asset:model:v1"],
      upstreamRemoved: [],
    }],
    lineage: { upstream: [], downstream: [] },
  }),
  Object.freeze({
    assetId: "asset:system",
    versionId: "asset:system:v2",
    name: "Support System",
    kind: "generic",
    status: "validated",
    taxonomy: {
      structuralKind: TaxonomyStructuralKinds.system,
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    },
    provenance: {
      sourceType: "imported",
      sourceLabel: "exchange",
      creatorId: "author:system",
      upstreamAssets: [],
      directUpstreamVersionIds: ["asset:workflow:v3"],
      directDownstreamVersionIds: [],
    },
    dependencies: [{
      direction: "upstream",
      assetId: "asset:workflow",
      versionId: "asset:workflow:v3",
      source: "lineage-edge",
    }],
    versionHistory: [{
      versionId: "asset:system:v2",
      createdAt: new Date("2026-03-10T00:00:00.000Z"),
      upstreamVersionIds: ["asset:workflow:v3"],
      upstreamAdded: [],
      upstreamRemoved: [],
    }],
    lineage: { upstream: [], downstream: [] },
  }),
]);

describe("ExploreAssetQueryService", () => {
  const persistedDraftWorkflow = createPersistedWorkflowRecord({
    id: "workflow:persisted-draft",
    name: "Draft Workflow",
    draft: createEmptyWorkflowDraft(),
  });
  const service = new ExploreAssetQueryService({
    async listAllAssets() {
      return seedAssets;
    },
  }, {
    async listPersistedWorkflows() {
      return [persistedDraftWorkflow];
    },
  });

  it("builds a unified explore library across atomic/composite/system assets", async () => {
    const library = await service.listLibrary();
    expect(library.totalCount).toBe(4);
    expect(library.availableKinds).toEqual([ExploreAssetKinds.atomic, ExploreAssetKinds.composite, ExploreAssetKinds.system]);
    expect(library.assets.map((entry) => entry.assetKind)).toContain(ExploreAssetKinds.atomic);
    expect(library.assets.map((entry) => entry.assetKind)).toContain(ExploreAssetKinds.composite);
    expect(library.assets.map((entry) => entry.assetKind)).toContain(ExploreAssetKinds.system);
    expect(library.assets[0]?.id.assetId).toBeDefined();
    expect(library.assets[0]?.id.versionId).toBeDefined();
  });

  it("returns centralized mixed-type search results and taxonomy as secondary facets", async () => {
    const result = await service.search({
      keyword: "workflow",
      filters: {
        statuses: ["published"],
      },
    });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.id.assetId).toBe("asset:workflow");
    expect(result.totalCount).toBe(1);
    const roleFacet = result.facets.find((facet) => facet.key === "semanticRole");
    expect(roleFacet?.visibility).toBe("secondary");
    expect(roleFacet?.options.map((entry) => entry.value)).toContain("workflow");
  });

  it("applies deterministic filter behavior without requiring kind preselection", async () => {
    const result = await service.search({
      filters: {
        sourceTypes: ["generated"],
      },
    });

    expect(result.assets).toHaveLength(2);
    expect(result.assets.map((entry) => entry.id.assetId)).toEqual(["asset:workflow", "asset:model"]);
  });

  it("includes persisted workflows as first-class explore assets with source/status facets", async () => {
    const result = await service.search({
      keyword: "draft workflow",
      filters: {
        sourceTypes: ["workflow-persistence"],
        statuses: ["draft"],
      },
    });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.id.assetId).toBe("workflow:persisted-draft");
    expect(result.assets[0]?.metadata.sourceType).toBe("workflow-persistence");
    expect(result.assets[0]?.taxonomy?.semanticRole).toBe("workflow");
    expect(result.assets[0]?.status).toBe("draft");
  });
});
