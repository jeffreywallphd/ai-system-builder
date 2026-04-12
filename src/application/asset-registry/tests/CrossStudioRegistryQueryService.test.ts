import { describe, expect, it } from "bun:test";
import { Asset } from "@domain/assets/Asset";
import { AssetLineageEdge, AssetLineageRelationshipType } from "@domain/assets/AssetLineageEdge";
import { AssetVersion } from "@domain/assets/AssetVersion";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "@domain/taxonomy/CompositionTaxonomy";
import { CrossStudioRegistryQueryService } from "../CrossStudioRegistryQueryService";
import { RegistryQueryService } from "../RegistryQueryService";
import type { IAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import type { IAssetLineageRepository } from "../../ports/interfaces/IAssetLineageRepository";
import type { IAssetRecordRepository } from "../../ports/interfaces/IAssetRecordRepository";
import type { IAssetSystemQueryRepository } from "../../ports/interfaces/IAssetSystemQueryRepository";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";

class InMemoryAssetRecordRepository implements IAssetRecordRepository {
  constructor(private readonly assets: ReadonlyArray<Asset>) {}
  public async save(): Promise<void> { throw new Error("not implemented"); }
  public async getById(assetId: string) { return this.assets.find((asset) => asset.id === assetId); }
  public async list() { return this.assets; }
  public async exists(assetId: string) { return this.assets.some((asset) => asset.id === assetId); }
}

class InMemoryAssetVersionRepository implements IAssetVersionRepository {
  constructor(private readonly versions: ReadonlyArray<AssetVersion>) {}
  public async saveVersion(): Promise<void> { throw new Error("not implemented"); }
  public async getByVersionId(versionId: string) { return this.versions.find((version) => version.versionId === versionId); }
  public async listVersionsByAssetId(assetId: string) { return this.versions.filter((version) => version.assetId.value === assetId); }
}

class InMemoryLineageRepository implements IAssetLineageRepository {
  constructor(private readonly edges: ReadonlyArray<AssetLineageEdge>) {}
  public async saveEdge(): Promise<void> { throw new Error("not implemented"); }
  public async listEdgesByVersionId(versionId: string, direction: "upstream" | "downstream" | "both" = "both") {
    if (direction === "upstream") {
      return this.edges.filter((edge) => edge.toVersionId === versionId);
    }

    if (direction === "downstream") {
      return this.edges.filter((edge) => edge.fromVersionId === versionId);
    }

    return this.edges.filter((edge) => edge.toVersionId === versionId || edge.fromVersionId === versionId);
  }
}

function buildAsset(assetId: string, name: string, kind: Asset["kind"], provider: string): Asset {
  return new Asset({
    id: assetId,
    name,
    kind,
    status: "available",
    source: { type: "generated", provider },
    location: { accessMethod: "memory", location: `${assetId}.json` },
  });
}

function buildVersion(params: {
  assetId: string;
  versionId: string;
  upstreamVersionIds?: ReadonlyArray<string>;
  creatorId: string;
  sourceType?: string;
  sourceLabel?: string;
}): AssetVersion {
  return new AssetVersion({
    assetId: params.assetId,
    versionId: params.versionId,
    upstreamVersionIds: params.upstreamVersionIds,
    metadata: {
      metadata: {
        provenance: {
          creatorId: params.creatorId,
          sourceType: params.sourceType ?? "generated",
          sourceLabel: params.sourceLabel,
        },
      },
      dependencies: (params.upstreamVersionIds ?? []).map((id) => ({
        assetId: id.split(":v")[0] ?? "",
        versionId: id,
      })),
    },
  });
}

function buildResolver(): Pick<IAssetContractResolver, "resolveCanonicalEntityContract" | "resolveContractForTaxonomy"> {
  return {
    async resolveCanonicalEntityContract() {
      return undefined;
    },
    resolveContractForTaxonomy(descriptor) {
      if (descriptor.semanticRole === "workflow") {
        return {
          version: "1.0.0",
          parameters: [{ id: "workflowMode", required: true }],
          execution: { invocationMode: "deferred", sideEffects: "bounded" },
        };
      }

      if (descriptor.semanticRole === "app-template") {
        return {
          version: "1.0.0",
          parameters: [{ id: "deploymentTarget", required: false }],
          execution: { invocationMode: "deferred", sideEffects: "none" },
        };
      }

      return {
        version: "1.0.0",
        parameters: [{ id: "modelRuntime", required: false }],
        execution: { invocationMode: "async", sideEffects: "bounded" },
      };
    },
  };
}

describe("CrossStudioRegistryQueryService", () => {
  it("supports explicit cross-studio query operations for taxonomy/dependency/contract/provenance filters", async () => {
    const modelAsset = buildAsset("asset:model", "Model", "generic", "model-studio");
    const workflowAsset = buildAsset("asset:workflow", "Workflow", "workflow-definition", "workflow-studio");
    const systemAsset = buildAsset("asset:template", "Template", "generic", "system-studio");

    const modelVersion = buildVersion({
      assetId: "asset:model",
      versionId: "asset:model:v1",
      creatorId: "model-author",
      sourceLabel: "model-studio",
    });
    const workflowVersion = buildVersion({
      assetId: "asset:workflow",
      versionId: "asset:workflow:v2",
      creatorId: "workflow-author",
      sourceLabel: "workflow-studio",
      upstreamVersionIds: ["asset:model:v1"],
    });
    const systemVersion = buildVersion({
      assetId: "asset:template",
      versionId: "asset:template:v3",
      creatorId: "template-author",
      sourceLabel: "system-studio",
      sourceType: "imported",
    });

    const lineage = new AssetLineageEdge({
      edgeId: "edge:workflow-model",
      fromVersionId: "asset:model:v1",
      toVersionId: "asset:workflow:v2",
      type: AssetLineageRelationshipType.INPUT_TO,
    });

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria() {
        return [modelAsset, workflowAsset, systemAsset];
      },
      async getLatestVersionForAsset(assetId) {
        if (assetId === "asset:model") return modelVersion;
        if (assetId === "asset:workflow") return workflowVersion;
        if (assetId === "asset:template") return systemVersion;
        return undefined;
      },
      async listCanonicalIdentities() {
        return [
          {
            entityType: "installed-model" as const,
            entityId: "entity:model",
            assetId: "asset:model",
            latestVersionId: "asset:model:v1",
            taxonomy: {
              structuralKind: TaxonomyStructuralKinds.atomic,
              semanticRole: TaxonomySemanticRoles.model,
              behaviorKind: TaxonomyBehaviorKinds.none,
            },
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
          {
            entityType: "workflow-definition" as const,
            entityId: "entity:workflow",
            assetId: "asset:workflow",
            latestVersionId: "asset:workflow:v2",
            taxonomy: {
              structuralKind: TaxonomyStructuralKinds.composite,
              semanticRole: TaxonomySemanticRoles.workflow,
              behaviorKind: TaxonomyBehaviorKinds.deterministic,
            },
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
          {
            entityType: "execution-artifact" as const,
            entityId: "entity:template",
            assetId: "asset:template",
            latestVersionId: "asset:template:v3",
            taxonomy: {
              structuralKind: TaxonomyStructuralKinds.system,
              semanticRole: TaxonomySemanticRoles.system,
              behaviorKind: TaxonomyBehaviorKinds.iterative,
            },
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        ];
      },
    };

    const registry = new RegistryQueryService(
      new InMemoryAssetRecordRepository([modelAsset, workflowAsset, systemAsset]),
      new InMemoryAssetVersionRepository([modelVersion, workflowVersion, systemVersion]),
      new InMemoryLineageRepository([lineage]),
      buildResolver(),
      queryRepository,
    );
    const crossStudio = new CrossStudioRegistryQueryService(registry);

    const allAssets = await crossStudio.listAllAssets();
    expect(allAssets).toHaveLength(3);

    const compositeOnly = await crossStudio.listByTaxonomy({
      structuralKinds: [TaxonomyStructuralKinds.composite],
      semanticRoles: [TaxonomySemanticRoles.workflow],
      behaviorKinds: [TaxonomyBehaviorKinds.deterministic],
    });
    expect(compositeOnly).toHaveLength(1);
    expect(compositeOnly[0]?.assetId).toBe("asset:workflow");

    const systemOnly = await crossStudio.listByTaxonomy({
      structuralKinds: [TaxonomyStructuralKinds.system],
      semanticRoles: [TaxonomySemanticRoles.system],
      behaviorKinds: [TaxonomyBehaviorKinds.iterative],
    });
    expect(systemOnly).toHaveLength(1);
    expect(systemOnly[0]?.assetId).toBe("asset:template");

    const byDependency = await crossStudio.listByDependencyRelationship({ dependsOnVersionIds: ["asset:model:v1"] });
    expect(byDependency).toHaveLength(1);
    expect(byDependency[0]?.assetId).toBe("asset:workflow");

    const byContract = await crossStudio.listByContractFacets({ parameterIds: ["workflowMode"], invocationModes: ["deferred"] });
    expect(byContract).toHaveLength(1);
    expect(byContract[0]?.assetId).toBe("asset:workflow");

    const byProvenance = await crossStudio.listByProvenanceFacets({ creatorIds: ["workflow-author"], sourceTypes: ["generated"] });
    expect(byProvenance).toHaveLength(1);
    expect(byProvenance[0]?.assetId).toBe("asset:workflow");

    const bySearch = await crossStudio.searchAssets({ keyword: "template-author" });
    expect(bySearch).toHaveLength(1);
    expect(bySearch[0]?.assetId).toBe("asset:template");

    const byAssetId = await crossStudio.getAssetByAssetId("asset:model");
    expect(byAssetId?.versionId).toBe("asset:model:v1");

    const byVersionId = await crossStudio.getAssetByVersionId("asset:workflow:v2");
    expect(byVersionId?.assetId).toBe("asset:workflow");

    const taxonomyKinds = await crossStudio.listCrossStudioAssetKinds();
    expect(taxonomyKinds.some((entry) => entry.structuralKind === "atomic" && entry.semanticRole === "model")).toBeTrue();
    expect(taxonomyKinds.some((entry) => entry.structuralKind === "composite" && entry.semanticRole === "workflow")).toBeTrue();
    expect(taxonomyKinds.some((entry) => entry.structuralKind === "system" && entry.semanticRole === "system")).toBeTrue();
  });
});

