import { describe, expect, it } from "bun:test";
import { Asset } from "../../../../domain/assets/Asset";
import { AssetVersion } from "../../../../domain/assets/AssetVersion";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../../domain/assets/AssetLineageEdge";
import { RegistryQueryService } from "../../../../application/asset-registry/RegistryQueryService";
import { CrossStudioRegistryQueryService } from "../../../../application/asset-registry/CrossStudioRegistryQueryService";
import { RegistryDependencyGraphService } from "../../../../application/asset-registry/RegistryDependencyGraphService";
import { RegistryBackendApi } from "../RegistryBackendApi";
import type { IAssetContractResolver } from "../../../../application/contracts/CompositionAssetContractResolver";
import type { IAssetLineageRepository } from "../../../../application/ports/interfaces/IAssetLineageRepository";
import type { IAssetRecordRepository } from "../../../../application/ports/interfaces/IAssetRecordRepository";
import type { IAssetSystemQueryRepository } from "../../../../application/ports/interfaces/IAssetSystemQueryRepository";
import type { IAssetVersionRepository } from "../../../../application/ports/interfaces/IAssetVersionRepository";

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
    if (direction === "upstream") return this.edges.filter((edge) => edge.toVersionId === versionId);
    if (direction === "downstream") return this.edges.filter((edge) => edge.fromVersionId === versionId);
    return this.edges.filter((edge) => edge.toVersionId === versionId || edge.fromVersionId === versionId);
  }
}

function buildResolver(): Pick<IAssetContractResolver, "resolveCanonicalEntityContract" | "resolveContractForTaxonomy"> {
  return {
    async resolveCanonicalEntityContract() { return undefined; },
    resolveContractForTaxonomy() {
      return { version: "1.0.0", parameters: [{ id: "input" }], execution: { invocationMode: "deferred", sideEffects: "bounded" } };
    },
  };
}

function buildAsset(assetId: string, name: string): Asset {
  return new Asset({
    id: assetId,
    name,
    kind: "generic",
    status: "available",
    source: { type: "generated", provider: "studio" },
    location: { accessMethod: "memory", location: `${assetId}.json` },
  });
}

function buildVersion(assetId: string, versionId: string, upstreamVersionIds: ReadonlyArray<string> = []): AssetVersion {
  return new AssetVersion({
    assetId,
    versionId,
    upstreamVersionIds,
    metadata: {
      metadata: {
        provenance: {
          creatorId: `${assetId}:author`,
          sourceType: "generated",
          sourceLabel: "studio",
        },
      },
      dependencies: upstreamVersionIds.map((dep) => ({ assetId: dep.split(":v")[0] ?? "", versionId: dep })),
    },
  });
}

describe("RegistryBackendApi", () => {
  it("returns registry listing and filter responses through application query services", async () => {
    const modelAsset = buildAsset("asset:model", "Model");
    const workflowAsset = buildAsset("asset:workflow", "Workflow");
    const modelVersion = buildVersion("asset:model", "asset:model:v1");
    const workflowVersion = buildVersion("asset:workflow", "asset:workflow:v1", ["asset:model:v1"]);

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria() { return [modelAsset, workflowAsset]; },
      async getLatestVersionForAsset(assetId) { return assetId === "asset:model" ? modelVersion : workflowVersion; },
      async listCanonicalIdentities() { return []; },
    };

    const versionRepository = new InMemoryAssetVersionRepository([modelVersion, workflowVersion]);
    const queryService = new RegistryQueryService(
      new InMemoryAssetRecordRepository([modelAsset, workflowAsset]),
      versionRepository,
      new InMemoryLineageRepository([]),
      buildResolver(),
      queryRepository,
    );

    const api = new RegistryBackendApi(new CrossStudioRegistryQueryService(queryService), new RegistryDependencyGraphService(queryService, versionRepository));

    const listed = await api.listAssets();
    expect(listed.ok).toBeTrue();
    expect(listed.data?.length).toBe(2);

    const filtered = await api.filterAssets({ dependsOnVersionIds: ["asset:model:v1"] });
    expect(filtered.ok).toBeTrue();
    expect(filtered.data?.length).toBe(1);
    expect(filtered.data?.[0]?.assetId).toBe("asset:workflow");
  });

  it("exposes dependency and dependent traversal endpoints with bounded depth", async () => {
    const modelAsset = buildAsset("asset:model", "Model");
    const workflowAsset = buildAsset("asset:workflow", "Workflow");
    const templateAsset = buildAsset("asset:template", "Template");

    const modelVersion = buildVersion("asset:model", "asset:model:v1");
    const workflowVersion = buildVersion("asset:workflow", "asset:workflow:v1", ["asset:model:v1"]);
    const templateVersion = buildVersion("asset:template", "asset:template:v1", ["asset:workflow:v1"]);

    const lineage = [
      new AssetLineageEdge({
        edgeId: "edge:model-workflow",
        fromVersionId: "asset:model:v1",
        toVersionId: "asset:workflow:v1",
        type: AssetLineageRelationshipType.INPUT_TO,
      }),
      new AssetLineageEdge({
        edgeId: "edge:workflow-template",
        fromVersionId: "asset:workflow:v1",
        toVersionId: "asset:template:v1",
        type: AssetLineageRelationshipType.GENERATED_FROM,
      }),
    ];

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria() { return [modelAsset, workflowAsset, templateAsset]; },
      async getLatestVersionForAsset(assetId) {
        if (assetId === "asset:model") return modelVersion;
        if (assetId === "asset:workflow") return workflowVersion;
        return templateVersion;
      },
      async listCanonicalIdentities() { return []; },
    };

    const versionRepository = new InMemoryAssetVersionRepository([modelVersion, workflowVersion, templateVersion]);
    const queryService = new RegistryQueryService(
      new InMemoryAssetRecordRepository([modelAsset, workflowAsset, templateAsset]),
      versionRepository,
      new InMemoryLineageRepository(lineage),
      buildResolver(),
      queryRepository,
    );

    const api = new RegistryBackendApi(new CrossStudioRegistryQueryService(queryService), new RegistryDependencyGraphService(queryService, versionRepository));

    const detailByAsset = await api.getAssetDetail({ assetId: "asset:workflow" });
    expect(detailByAsset.ok).toBeTrue();
    expect(detailByAsset.data?.assetId).toBe("asset:workflow");

    const detailByVersion = await api.getAssetDetail({ versionId: "asset:model:v1" });
    expect(detailByVersion.ok).toBeTrue();
    expect(detailByVersion.data?.assetId).toBe("asset:model");

    const dependencies = await api.getDependencies({ assetId: "asset:workflow" });
    expect(dependencies.ok).toBeTrue();
    expect(dependencies.data?.edges.some((edge) => edge.fromVersionId === "asset:workflow:v1" && edge.toVersionId === "asset:model:v1")).toBeTrue();

    const dependents = await api.getDependents({ versionId: "asset:model:v1" });
    expect(dependents.ok).toBeTrue();
    expect(dependents.data?.edges.some((edge) => edge.fromVersionId === "asset:workflow:v1" && edge.toVersionId === "asset:model:v1")).toBeTrue();

    const traversed = await api.traverseDependents({ assetId: "asset:model", maxDepth: 1 });
    expect(traversed.ok).toBeTrue();
    expect(traversed.data?.graph.nodes.some((node) => node.versionId === "asset:template:v1")).toBeFalse();
  });
});
