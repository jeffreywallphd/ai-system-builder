import { describe, expect, it } from "bun:test";
import { Asset } from "../../../domain/assets/Asset";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../domain/assets/AssetLineageEdge";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import { RegistryDependencyGraphService } from "../RegistryDependencyGraphService";
import { RegistryQueryService } from "../RegistryQueryService";
import type { IAssetContractResolver } from "../../contracts/CompositionAssetContractResolver";
import type { IAssetLineageRepository } from "../../ports/interfaces/IAssetLineageRepository";
import type { IAssetRecordRepository } from "../../ports/interfaces/IAssetRecordRepository";
import type { IAssetSystemQueryRepository } from "../../ports/interfaces/IAssetSystemQueryRepository";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";
import type { IRegistryGraphProjectionRepository, RegistryGraphProjectionSnapshot } from "../../ports/interfaces/IRegistryGraphProjectionRepository";

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

class InMemoryRegistryGraphProjectionRepository implements IRegistryGraphProjectionRepository {
  private snapshot?: RegistryGraphProjectionSnapshot;
  private dirty = true;
  private saveCount = 0;

  public async loadProjection() { return this.snapshot; }
  public async saveProjection(snapshot: RegistryGraphProjectionSnapshot) {
    this.snapshot = snapshot;
    this.dirty = false;
    this.saveCount += 1;
  }
  public async markProjectionDirty() { this.dirty = true; }
  public async getProjectionState() {
    return Object.freeze({
      dirty: this.dirty,
      computedAt: this.snapshot?.computedAt,
      sourceSignature: this.snapshot?.sourceSignature,
    });
  }
  public async getCurrentSourceSignature() {
    return Object.freeze({
      versionCount: this.snapshot?.sourceSignature?.versionCount ?? 0,
      lineageEdgeCount: this.snapshot?.sourceSignature?.lineageEdgeCount ?? 0,
    });
  }
  public get writes(): number {
    return this.saveCount;
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
  sourceLabel: string;
}): AssetVersion {
  return new AssetVersion({
    assetId: params.assetId,
    versionId: params.versionId,
    upstreamVersionIds: params.upstreamVersionIds,
    metadata: {
      metadata: {
        provenance: {
          creatorId: `${params.assetId}:author`,
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
    resolveContractForTaxonomy() {
      return {
        version: "1.0.0",
        parameters: [],
        execution: { invocationMode: "deferred", sideEffects: "bounded" },
      };
    },
  };
}

describe("RegistryDependencyGraphService", () => {
  it("builds version-aware mixed atomic/composite graph and supports direct + traversal expansion", async () => {
    const modelAsset = buildAsset("asset:model", "Model", "generic", "model-studio");
    const contextAsset = buildAsset("asset:context", "Context", "generic", "context-bundle-studio");
    const workflowAsset = buildAsset("asset:workflow", "Workflow", "workflow-definition", "workflow-studio");
    const templateAsset = buildAsset("asset:template", "Template", "generic", "system-studio");

    const modelVersion = buildVersion({ assetId: "asset:model", versionId: "asset:model:v1", sourceLabel: "model-studio" });
    const contextVersion = buildVersion({
      assetId: "asset:context",
      versionId: "asset:context:v1",
      sourceLabel: "context-bundle-studio",
      upstreamVersionIds: ["asset:model:v1"],
    });
    const workflowVersion = buildVersion({
      assetId: "asset:workflow",
      versionId: "asset:workflow:v3",
      sourceLabel: "workflow-studio",
      upstreamVersionIds: ["asset:model:v1", "asset:context:v1"],
    });
    const templateVersion = buildVersion({
      assetId: "asset:template",
      versionId: "asset:template:v1",
      sourceLabel: "system-studio",
      upstreamVersionIds: ["asset:workflow:v3"],
    });

    const lineage = [
      new AssetLineageEdge({
        edgeId: "edge:model-context",
        fromVersionId: "asset:model:v1",
        toVersionId: "asset:context:v1",
        type: AssetLineageRelationshipType.DERIVED_FROM,
      }),
      new AssetLineageEdge({
        edgeId: "edge:model-workflow",
        fromVersionId: "asset:model:v1",
        toVersionId: "asset:workflow:v3",
        type: AssetLineageRelationshipType.INPUT_TO,
      }),
      new AssetLineageEdge({
        edgeId: "edge:context-workflow",
        fromVersionId: "asset:context:v1",
        toVersionId: "asset:workflow:v3",
        type: AssetLineageRelationshipType.INPUT_TO,
      }),
      new AssetLineageEdge({
        edgeId: "edge:workflow-template",
        fromVersionId: "asset:workflow:v3",
        toVersionId: "asset:template:v1",
        type: AssetLineageRelationshipType.GENERATED_FROM,
      }),
    ];

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria() {
        return [modelAsset, contextAsset, workflowAsset, templateAsset];
      },
      async getLatestVersionForAsset(assetId) {
        if (assetId === "asset:model") return modelVersion;
        if (assetId === "asset:context") return contextVersion;
        if (assetId === "asset:workflow") return workflowVersion;
        if (assetId === "asset:template") return templateVersion;
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
            latestVersionId: "asset:workflow:v3",
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
            latestVersionId: "asset:template:v1",
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

    const versionRepository = new InMemoryAssetVersionRepository([modelVersion, contextVersion, workflowVersion, templateVersion]);
    const registry = new RegistryQueryService(
      new InMemoryAssetRecordRepository([modelAsset, contextAsset, workflowAsset, templateAsset]),
      versionRepository,
      new InMemoryLineageRepository(lineage),
      buildResolver(),
      queryRepository,
    );

    const service = new RegistryDependencyGraphService(registry, versionRepository);

    const directDependencies = await service.expandDirectDependencies("asset:workflow:v3");
    expect(directDependencies.nodes.some((node) => node.versionId === "asset:workflow:v3")).toBeTrue();
    expect(directDependencies.edges.some((edge) => edge.fromVersionId === "asset:workflow:v3" && edge.toVersionId === "asset:model:v1")).toBeTrue();
    expect(directDependencies.edges.some((edge) => edge.fromVersionId === "asset:workflow:v3" && edge.toVersionId === "asset:context:v1")).toBeTrue();

    const directDependents = await service.expandDirectDependents("asset:model:v1");
    expect(directDependents.edges.some((edge) => edge.fromVersionId === "asset:workflow:v3" && edge.toVersionId === "asset:model:v1")).toBeTrue();
    expect(directDependents.edges.some((edge) => edge.fromVersionId === "asset:context:v1" && edge.toVersionId === "asset:model:v1")).toBeTrue();

    const upstreamTraversal = await service.traverseUpstream("asset:template:v1", { maxDepth: 3 });
    expect(upstreamTraversal.graph.nodes.some((node) => node.versionId === "asset:workflow:v3")).toBeTrue();
    expect(upstreamTraversal.graph.nodes.some((node) => node.versionId === "asset:context:v1")).toBeTrue();
    expect(upstreamTraversal.graph.nodes.some((node) => node.versionId === "asset:model:v1")).toBeTrue();

    const downstreamTraversal = await service.traverseDownstream("asset:model:v1", { maxDepth: 3 });
    expect(downstreamTraversal.graph.nodes.some((node) => node.versionId === "asset:context:v1")).toBeTrue();
    expect(downstreamTraversal.graph.nodes.some((node) => node.versionId === "asset:workflow:v3")).toBeTrue();
    expect(downstreamTraversal.graph.nodes.some((node) => node.versionId === "asset:template:v1")).toBeTrue();
    expect(downstreamTraversal.levels[0]).toEqual(["asset:model:v1"]);

    const bounded = await service.traverseDownstream("asset:model:v1", { maxDepth: 1 });
    expect(bounded.graph.nodes.some((node) => node.versionId === "asset:template:v1")).toBeFalse();
  });

  it("persists and reuses graph projection snapshots across repeated traversals", async () => {
    const modelAsset = buildAsset("asset:model", "Model", "generic", "model-studio");
    const workflowAsset = buildAsset("asset:workflow", "Workflow", "workflow-definition", "workflow-studio");
    const modelVersion = buildVersion({ assetId: "asset:model", versionId: "asset:model:v1", sourceLabel: "model-studio" });
    const workflowVersion = buildVersion({
      assetId: "asset:workflow",
      versionId: "asset:workflow:v1",
      sourceLabel: "workflow-studio",
      upstreamVersionIds: ["asset:model:v1"],
    });

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria() { return [modelAsset, workflowAsset]; },
      async getLatestVersionForAsset(assetId) { return assetId === "asset:model" ? modelVersion : workflowVersion; },
      async listCanonicalIdentities() { return []; },
    };

    const versionRepository = new InMemoryAssetVersionRepository([modelVersion, workflowVersion]);
    const registry = new RegistryQueryService(
      new InMemoryAssetRecordRepository([modelAsset, workflowAsset]),
      versionRepository,
      new InMemoryLineageRepository([]),
      buildResolver(),
      queryRepository,
    );
    const projectionRepository = new InMemoryRegistryGraphProjectionRepository();
    const service = new RegistryDependencyGraphService(registry, versionRepository, projectionRepository);

    await service.expandDirectDependencies("asset:workflow:v1");
    expect(projectionRepository.writes).toBe(1);

    await service.expandDirectDependencies("asset:workflow:v1");
    expect(projectionRepository.writes).toBe(1);

    await projectionRepository.markProjectionDirty();
    await service.expandDirectDependencies("asset:workflow:v1");
    expect(projectionRepository.writes).toBe(2);
  });
});
