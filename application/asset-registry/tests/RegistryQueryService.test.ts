import { describe, expect, it } from "bun:test";
import { RegistryQueryService } from "../RegistryQueryService";
import { Asset } from "../../../domain/assets/Asset";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../domain/assets/AssetLineageEdge";
import type { IAssetRecordRepository } from "../../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";
import type { IAssetLineageRepository } from "../../ports/interfaces/IAssetLineageRepository";
import type { IAssetSystemQueryRepository } from "../../ports/interfaces/IAssetSystemQueryRepository";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";

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

function buildAsset(assetId: string, name: string, kind: Asset["kind"]): Asset {
  return new Asset({
    id: assetId,
    name,
    kind,
    status: "available",
    source: { type: "generated", provider: "studio-shell" },
    location: { accessMethod: "memory", location: `${assetId}.json` },
  });
}

function buildVersion(params: {
  assetId: string;
  versionId: string;
  upstreamVersionIds?: ReadonlyArray<string>;
  metadata?: Readonly<Record<string, unknown>>;
}): AssetVersion {
  return new AssetVersion({
    assetId: params.assetId,
    versionId: params.versionId,
    upstreamVersionIds: params.upstreamVersionIds,
    metadata: params.metadata,
  });
}

describe("RegistryQueryService", () => {
  it("projects registry read models and filters by taxonomy, contract, provenance, and dependencies", async () => {
    const modelAsset = buildAsset("asset:model", "Model", "generic");
    const workflowAsset = buildAsset("asset:workflow", "Workflow", "workflow-definition");

    const modelVersion = buildVersion({
      assetId: "asset:model",
      versionId: "asset:model:v1",
      metadata: {
        metadata: {
          provenance: {
            creatorId: "model-author",
            sourceType: "generated",
          },
        },
      },
    });

    const workflowVersion = buildVersion({
      assetId: "asset:workflow",
      versionId: "asset:workflow:v2",
      upstreamVersionIds: ["asset:model:v1"],
      metadata: {
        metadata: {
          provenance: {
            creatorId: "workflow-author",
            sourceType: "generated",
            sourceLabel: "workflow-studio",
          },
        },
        dependencies: [
          {
            assetId: "asset:model",
            versionId: "asset:model:v1",
          },
        ],
      },
    });

    const lineage = new AssetLineageEdge({
      edgeId: "edge:workflow-model",
      fromVersionId: "asset:model:v1",
      toVersionId: "asset:workflow:v2",
      type: AssetLineageRelationshipType.INPUT_TO,
    });

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria(criteria) {
        const all = [modelAsset, workflowAsset];
        if (!criteria?.structuralKinds && !criteria?.semanticRoles && !criteria?.behaviorKinds) {
          return all;
        }

        const acceptedById = new Set<string>();
        if (criteria?.structuralKinds?.includes("atomic")) {
          acceptedById.add("asset:model");
        }
        if (criteria?.structuralKinds?.includes("composite")) {
          acceptedById.add("asset:workflow");
        }
        return all.filter((asset) => acceptedById.has(asset.id));
      },
      async getLatestVersionForAsset(assetId) {
        if (assetId === "asset:model") return modelVersion;
        if (assetId === "asset:workflow") return workflowVersion;
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
        ];
      },
    };

    const service = new RegistryQueryService(
      new InMemoryAssetRecordRepository([modelAsset, workflowAsset]),
      new InMemoryAssetVersionRepository([modelVersion, workflowVersion]),
      new InMemoryLineageRepository([lineage]),
      {
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

          return {
            version: "1.0.0",
            parameters: [{ id: "modelRuntime", required: false }],
            execution: { invocationMode: "async", sideEffects: "bounded" },
          };
        },
      },
      queryRepository,
    );

    const workflowOnly = await service.queryRegistry({
      structuralKinds: ["composite"],
      semanticRoles: ["workflow"],
      behaviorKinds: ["deterministic"],
      contractParameterIds: ["workflowMode"],
      provenanceCreatorIds: ["workflow-author"],
      dependsOnAssetIds: ["asset:model"],
      dependsOnVersionIds: ["asset:model:v1"],
    });

    expect(workflowOnly).toHaveLength(1);
    expect(workflowOnly[0]?.assetId).toBe("asset:workflow");
    expect(workflowOnly[0]?.dependencies.some((dependency) => dependency.versionId === "asset:model:v1")).toBeTrue();
    expect(workflowOnly[0]?.provenance.directUpstreamVersionIds).toContain("asset:model:v1");
    expect(workflowOnly[0]?.contract?.parameters.map((parameter) => parameter.id)).toContain("workflowMode");

    const atomicOnly = await service.queryRegistry({
      structuralKinds: ["atomic"],
      semanticRoles: ["model"],
      contractParameterIds: ["modelRuntime"],
      contractInvocationModes: ["async"],
      provenanceCreatorIds: ["model-author"],
    });

    expect(atomicOnly).toHaveLength(1);
    expect(atomicOnly[0]?.assetId).toBe("asset:model");
    expect(atomicOnly[0]?.taxonomy?.structuralKind).toBe("atomic");
  });
});
