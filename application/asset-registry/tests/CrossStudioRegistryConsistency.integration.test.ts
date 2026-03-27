import { describe, expect, it } from "bun:test";
import { Asset } from "../../../domain/assets/Asset";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../domain/assets/AssetLineageEdge";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import { CrossStudioRegistryQueryService } from "../CrossStudioRegistryQueryService";
import { RegistryDependencyGraphService } from "../RegistryDependencyGraphService";
import { RegistryQueryService } from "../RegistryQueryService";
import type { IAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import type { IAssetLineageRepository } from "../../ports/interfaces/IAssetLineageRepository";
import type { IAssetRecordRepository } from "../../ports/interfaces/IAssetRecordRepository";
import type { IAssetSystemQueryRepository } from "../../ports/interfaces/IAssetSystemQueryRepository";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";

class MutableAssetRecordRepository implements IAssetRecordRepository {
  constructor(private readonly assets: Asset[]) {}
  public async save(asset: Asset): Promise<void> {
    const index = this.assets.findIndex((entry) => entry.id === asset.id);
    if (index >= 0) {
      this.assets[index] = asset;
      return;
    }
    this.assets.push(asset);
  }
  public async getById(assetId: string) { return this.assets.find((asset) => asset.id === assetId); }
  public async list() { return this.assets; }
  public async exists(assetId: string) { return this.assets.some((asset) => asset.id === assetId); }
}

class MutableAssetVersionRepository implements IAssetVersionRepository {
  constructor(private readonly versions: AssetVersion[]) {}
  public async saveVersion(version: AssetVersion): Promise<void> {
    const index = this.versions.findIndex((entry) => entry.versionId === version.versionId);
    if (index >= 0) {
      this.versions[index] = version;
      return;
    }
    this.versions.push(version);
  }
  public async getByVersionId(versionId: string) { return this.versions.find((version) => version.versionId === versionId); }
  public async listVersionsByAssetId(assetId: string) {
    return this.versions
      .filter((version) => version.assetId.value === assetId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}

class MutableLineageRepository implements IAssetLineageRepository {
  constructor(private readonly edges: AssetLineageEdge[]) {}
  public async saveEdge(edge: AssetLineageEdge): Promise<void> {
    const index = this.edges.findIndex((entry) => entry.edgeId === edge.edgeId);
    if (index >= 0) {
      this.edges[index] = edge;
      return;
    }
    this.edges.push(edge);
  }
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
  creatorId: string;
  sourceLabel: string;
  upstreamVersionIds?: ReadonlyArray<string>;
}): AssetVersion {
  return new AssetVersion({
    assetId: params.assetId,
    versionId: params.versionId,
    upstreamVersionIds: params.upstreamVersionIds,
    metadata: {
      metadata: {
        provenance: {
          creatorId: params.creatorId,
          sourceType: "generated",
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

      if (descriptor.semanticRole === "context-bundle") {
        return {
          version: "1.0.0",
          parameters: [{ id: "contextScope", required: false }],
          execution: { invocationMode: "deferred", sideEffects: "none" },
        };
      }

      return {
        version: "1.0.0",
        parameters: [{ id: "runtime", required: false }],
        execution: { invocationMode: "async", sideEffects: "bounded" },
      };
    },
  };
}

describe("Cross-studio registry consistency integration", () => {
  it("keeps registry/query/graph projections consistent across atomic + composite publish and version updates", async () => {
    const modelAsset = buildAsset("asset:model", "Model", "generic", "model-studio");
    const contextAsset = buildAsset("asset:context", "Context", "generic", "context-bundle-studio");
    const workflowAsset = buildAsset("asset:workflow", "Workflow", "workflow-definition", "workflow-studio");

    const assetsRepository = new MutableAssetRecordRepository([modelAsset, contextAsset, workflowAsset]);
    const versionsRepository = new MutableAssetVersionRepository([
      buildVersion({
        assetId: "asset:model",
        versionId: "asset:model:v1",
        creatorId: "model-author",
        sourceLabel: "model-studio",
      }),
      buildVersion({
        assetId: "asset:context",
        versionId: "asset:context:v1",
        creatorId: "context-author",
        sourceLabel: "context-bundle-studio",
      }),
      buildVersion({
        assetId: "asset:workflow",
        versionId: "asset:workflow:v1",
        creatorId: "workflow-author",
        sourceLabel: "workflow-studio",
        upstreamVersionIds: ["asset:model:v1", "asset:context:v1"],
      }),
    ]);
    const lineageRepository = new MutableLineageRepository([
      new AssetLineageEdge({
        edgeId: "edge:model-workflow-v1",
        fromVersionId: "asset:model:v1",
        toVersionId: "asset:workflow:v1",
        type: AssetLineageRelationshipType.INPUT_TO,
      }),
      new AssetLineageEdge({
        edgeId: "edge:context-workflow-v1",
        fromVersionId: "asset:context:v1",
        toVersionId: "asset:workflow:v1",
        type: AssetLineageRelationshipType.INPUT_TO,
      }),
    ]);

    const sourceSignature = { versionCount: 3, lineageEdgeCount: 2 };
    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> & {
      getCurrentSourceSignature(): Promise<{ readonly versionCount: number; readonly lineageEdgeCount: number }>;
    } = {
      async listAssetsByCriteria() {
        return assetsRepository.list();
      },
      async getLatestVersionForAsset(assetId) {
        const versions = await versionsRepository.listVersionsByAssetId(assetId);
        return versions[0];
      },
      async listCanonicalIdentities() {
        return [
          {
            entityType: "installed-model" as const,
            entityId: "entity:model",
            assetId: "asset:model",
            latestVersionId: "asset:model:v2",
            taxonomy: {
              structuralKind: TaxonomyStructuralKinds.atomic,
              semanticRole: TaxonomySemanticRoles.model,
              behaviorKind: TaxonomyBehaviorKinds.none,
            },
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
          {
            entityType: "dataset-version" as const,
            entityId: "entity:context",
            assetId: "asset:context",
            latestVersionId: "asset:context:v1",
            taxonomy: {
              structuralKind: TaxonomyStructuralKinds.composite,
              semanticRole: TaxonomySemanticRoles.contextBundle,
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
        ];
      },
      async getCurrentSourceSignature() {
        return sourceSignature;
      },
    };

    const registryQueryService = new RegistryQueryService(
      assetsRepository,
      versionsRepository,
      lineageRepository,
      buildResolver(),
      queryRepository,
    );
    const crossStudio = new CrossStudioRegistryQueryService(registryQueryService);
    const graph = new RegistryDependencyGraphService(registryQueryService, versionsRepository, undefined, undefined, queryRepository);

    const initiallyVisible = await crossStudio.listAllAssets();
    expect(initiallyVisible).toHaveLength(3);
    expect(initiallyVisible.some((asset) => asset.assetId === "asset:model")).toBeTrue();
    expect(initiallyVisible.some((asset) => asset.assetId === "asset:workflow")).toBeTrue();

    const initialWorkflow = await crossStudio.getAssetByAssetId("asset:workflow");
    expect(initialWorkflow?.dependencies.some((entry) => entry.versionId === "asset:model:v1")).toBeTrue();
    expect(initialWorkflow?.dependencies.some((entry) => entry.versionId === "asset:context:v1")).toBeTrue();
    expect(initialWorkflow?.lineage.upstream.some((entry) => entry.versionId === "asset:model:v1")).toBeTrue();

    const searchByAuthor = await crossStudio.searchAssets({ keyword: "workflow-author" });
    expect(searchByAuthor.map((entry) => entry.assetId)).toEqual(["asset:workflow"]);

    const filteredByContract = await crossStudio.listByContractFacets({
      parameterIds: ["workflowMode"],
      invocationModes: ["deferred"],
      sideEffects: ["bounded"],
    });
    expect(filteredByContract.map((entry) => entry.assetId)).toEqual(["asset:workflow"]);

    const directDependenciesV1 = await graph.expandDirectDependencies("asset:workflow:v1");
    expect(directDependenciesV1.edges.some((edge) => edge.toVersionId === "asset:model:v1")).toBeTrue();
    expect(directDependenciesV1.edges.some((edge) => edge.toVersionId === "asset:context:v1")).toBeTrue();

    await versionsRepository.saveVersion(buildVersion({
      assetId: "asset:model",
      versionId: "asset:model:v2",
      creatorId: "model-author",
      sourceLabel: "model-studio",
    }));
    await versionsRepository.saveVersion(buildVersion({
      assetId: "asset:workflow",
      versionId: "asset:workflow:v2",
      creatorId: "workflow-author",
      sourceLabel: "workflow-studio",
      upstreamVersionIds: ["asset:model:v2"],
    }));
    await lineageRepository.saveEdge(new AssetLineageEdge({
      edgeId: "edge:model-workflow-v2",
      fromVersionId: "asset:model:v2",
      toVersionId: "asset:workflow:v2",
      type: AssetLineageRelationshipType.INPUT_TO,
    }));

    sourceSignature.versionCount = 5;
    sourceSignature.lineageEdgeCount = 3;

    const updatedWorkflow = await crossStudio.getAssetByAssetId("asset:workflow");
    expect(updatedWorkflow?.versionId).toBe("asset:workflow:v2");
    expect(updatedWorkflow?.dependencies.some((entry) => entry.versionId === "asset:model:v2")).toBeTrue();
    expect(updatedWorkflow?.dependencies.some((entry) => entry.versionId === "asset:context:v1")).toBeFalse();
    expect(updatedWorkflow?.lineage.upstream.some((entry) => entry.versionId === "asset:model:v2")).toBeTrue();
    expect(updatedWorkflow?.lineage.upstream.some((entry) => entry.versionId === "asset:context:v1")).toBeFalse();

    const updatedByDependency = await crossStudio.listByDependencyRelationship({ dependsOnVersionIds: ["asset:model:v2"] });
    expect(updatedByDependency.map((entry) => entry.assetId)).toEqual(["asset:workflow"]);

    const directDependenciesV2 = await graph.expandDirectDependencies("asset:workflow:v2");
    expect(directDependenciesV2.edges.some((edge) => edge.toVersionId === "asset:model:v2")).toBeTrue();
    expect(directDependenciesV2.edges.some((edge) => edge.toVersionId === "asset:context:v1")).toBeFalse();

    const upstreamV2 = await graph.traverseUpstream("asset:workflow:v2", { maxDepth: 2 });
    expect(upstreamV2.graph.nodes.some((node) => node.versionId === "asset:model:v2")).toBeTrue();
    expect(upstreamV2.graph.nodes.some((node) => node.versionId === "asset:context:v1")).toBeFalse();
  });
});
