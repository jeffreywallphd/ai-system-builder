import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { Asset } from "../../../../domain/assets/Asset";
import { AssetVersion } from "../../../../domain/assets/AssetVersion";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../../domain/assets/AssetLineageEdge";
import { RegistryQueryService } from "../../../../application/asset-registry/RegistryQueryService";
import { CrossStudioRegistryQueryService } from "../../../../application/asset-registry/CrossStudioRegistryQueryService";
import { RegistryDependencyGraphService } from "../../../../application/asset-registry/RegistryDependencyGraphService";
import { RegistryBackendApi } from "../RegistryBackendApi";
import { SqliteAssetSystemRepository } from "../../../filesystem/SqliteAssetSystemRepository";
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

function buildSystemContent(components: ReadonlyArray<{
  readonly componentKind: "atomic" | "composite" | "system";
  readonly assetId: string;
  readonly versionId: string;
  readonly alias: string;
}>): string {
  return JSON.stringify({
    systemSpec: {
      components,
      inputs: [
        { inputId: "request", valueType: "string", required: true },
      ],
      outputs: [
        { outputId: "response", valueType: "string" },
      ],
      parameters: [
        { parameterId: "temperature", valueType: "number", required: false, defaultValue: 0.2 },
      ],
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

    const searched = await api.searchAssets({ keyword: "Workflow" });
    expect(searched.ok).toBeTrue();
    expect(searched.data?.length).toBe(1);
    expect(searched.data?.[0]?.assetId).toBe("asset:workflow");
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
    expect(detailByAsset.data?.versionHistory.length).toBeGreaterThan(0);
    expect(detailByAsset.data?.lineage.rootVersionId).toBe("asset:workflow:v1");
    expect(detailByAsset.data?.validation?.status).toBeDefined();
    expect(detailByAsset.data?.validation?.issues.some((issue) => issue.code === "lifecycle-not-publish-ready")).toBeFalse();

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

  it("surfaces dependency compatibility issues from application validation projections", async () => {
    const workflowAsset = buildAsset("asset:workflow", "Workflow");
    const workflowVersionWithMissingDependency = new AssetVersion({
      assetId: "asset:workflow",
      versionId: "asset:workflow:v1",
      metadata: {
        metadata: {},
        dependencies: [{ assetId: "asset:missing", versionId: "asset:missing:v1" }],
      },
    });
    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria() { return [workflowAsset]; },
      async getLatestVersionForAsset() {
        return workflowVersionWithMissingDependency;
      },
      async listCanonicalIdentities() { return []; },
    };

    const versionRepository = new InMemoryAssetVersionRepository([workflowVersionWithMissingDependency]);
    const queryService = new RegistryQueryService(
      new InMemoryAssetRecordRepository([workflowAsset]),
      versionRepository,
      new InMemoryLineageRepository([]),
      buildResolver(),
      queryRepository,
    );
    const api = new RegistryBackendApi(new CrossStudioRegistryQueryService(queryService), new RegistryDependencyGraphService(queryService, versionRepository));

    const detail = await api.getAssetDetail({ assetId: "asset:workflow" });
    expect(detail.ok).toBeTrue();
    expect(detail.data?.validation?.incompatibleDependencyCount).toBeGreaterThan(0);
    expect(detail.data?.validation?.issues.some((issue) => issue.code === "dependency-version-not-found")).toBeTrue();
  });

  it("keeps system graph/detail/lineage projections coherent for nested system-of-systems with version lineage on SQLite persistence", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-registry-system-graph-"));
    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) {
        return;
      }

      const modelAsset = buildAsset("asset:model", "Model");
      const workflowAsset = buildAsset("asset:workflow", "Workflow");
      const childSystemAsset = buildAsset("asset:system:child", "Child System");
      const parentSystemAsset = buildAsset("asset:system:parent", "Parent System");
      await Promise.all([
        repository.save(modelAsset),
        repository.save(workflowAsset),
        repository.save(childSystemAsset),
        repository.save(parentSystemAsset),
      ]);

      await Promise.all([
        repository.saveVersion(buildVersion("asset:model", "asset:model:v1")),
        repository.saveVersion(buildVersion("asset:model", "asset:model:v2")),
        repository.saveVersion(buildVersion("asset:workflow", "asset:workflow:v1", ["asset:model:v1"])),
      ]);

      await repository.saveVersion(new AssetVersion({
        assetId: "asset:system:child",
        versionId: "asset:system:child:v1",
        upstreamVersionIds: ["asset:model:v1", "asset:workflow:v1"],
        metadata: {
          metadata: {
            taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
            provenance: { sourceType: "generated", sourceLabel: "system-studio", creatorId: "system-author" },
          },
          content: buildSystemContent([
            { componentKind: "atomic", assetId: "asset:model", versionId: "asset:model:v1", alias: "model-v1" },
            { componentKind: "composite", assetId: "asset:workflow", versionId: "asset:workflow:v1", alias: "workflow-v1" },
          ]),
          dependencies: [
            { assetId: "asset:model", versionId: "asset:model:v1" },
            { assetId: "asset:workflow", versionId: "asset:workflow:v1" },
          ],
        },
      }));

      await repository.saveVersion(new AssetVersion({
        assetId: "asset:system:child",
        versionId: "asset:system:child:v2",
        parentVersionId: "asset:system:child:v1",
        upstreamVersionIds: ["asset:model:v2", "asset:workflow:v1"],
        metadata: {
          metadata: {
            taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
            provenance: { sourceType: "generated", sourceLabel: "system-studio", creatorId: "system-author" },
          },
          content: buildSystemContent([
            { componentKind: "atomic", assetId: "asset:model", versionId: "asset:model:v2", alias: "model-v2" },
            { componentKind: "composite", assetId: "asset:workflow", versionId: "asset:workflow:v1", alias: "workflow-v1" },
          ]),
          dependencies: [
            { assetId: "asset:model", versionId: "asset:model:v2" },
            { assetId: "asset:workflow", versionId: "asset:workflow:v1" },
          ],
        },
      }));

      await repository.saveVersion(new AssetVersion({
        assetId: "asset:system:parent",
        versionId: "asset:system:parent:v1",
        upstreamVersionIds: ["asset:system:child:v1", "asset:model:v1", "asset:workflow:v1"],
        metadata: {
          metadata: {
            taxonomy: { structuralKind: "system", semanticRole: "app-template", behaviorKind: "deterministic" },
            provenance: { sourceType: "generated", sourceLabel: "system-studio", creatorId: "system-author" },
          },
          content: buildSystemContent([
            { componentKind: "system", assetId: "asset:system:child", versionId: "asset:system:child:v1", alias: "child-v1" },
            { componentKind: "atomic", assetId: "asset:model", versionId: "asset:model:v1", alias: "model-v1" },
            { componentKind: "composite", assetId: "asset:workflow", versionId: "asset:workflow:v1", alias: "workflow-v1" },
          ]),
          dependencies: [
            { assetId: "asset:system:child", versionId: "asset:system:child:v1" },
            { assetId: "asset:model", versionId: "asset:model:v1" },
            { assetId: "asset:workflow", versionId: "asset:workflow:v1" },
          ],
        },
      }));

      await repository.saveVersion(new AssetVersion({
        assetId: "asset:system:parent",
        versionId: "asset:system:parent:v2",
        parentVersionId: "asset:system:parent:v1",
        upstreamVersionIds: ["asset:system:child:v2", "asset:model:v2", "asset:workflow:v1"],
        metadata: {
          metadata: {
            taxonomy: { structuralKind: "system", semanticRole: "app-template", behaviorKind: "deterministic" },
            provenance: { sourceType: "generated", sourceLabel: "system-studio", creatorId: "system-author" },
          },
          content: buildSystemContent([
            { componentKind: "system", assetId: "asset:system:child", versionId: "asset:system:child:v2", alias: "child-v2" },
            { componentKind: "atomic", assetId: "asset:model", versionId: "asset:model:v2", alias: "model-v2" },
            { componentKind: "composite", assetId: "asset:workflow", versionId: "asset:workflow:v1", alias: "workflow-v1" },
          ]),
          dependencies: [
            { assetId: "asset:system:child", versionId: "asset:system:child:v2" },
            { assetId: "asset:model", versionId: "asset:model:v2" },
            { assetId: "asset:workflow", versionId: "asset:workflow:v1" },
          ],
        },
      }));

      const lineageEdges = [
        ["edge:model-workflow-v1", "asset:model:v1", "asset:workflow:v1", AssetLineageRelationshipType.INPUT_TO],
        ["edge:model-child-v1", "asset:model:v1", "asset:system:child:v1", AssetLineageRelationshipType.INPUT_TO],
        ["edge:workflow-child-v1", "asset:workflow:v1", "asset:system:child:v1", AssetLineageRelationshipType.INPUT_TO],
        ["edge:child-v1-parent-v1", "asset:system:child:v1", "asset:system:parent:v1", AssetLineageRelationshipType.DERIVED_FROM],
        ["edge:model-parent-v1", "asset:model:v1", "asset:system:parent:v1", AssetLineageRelationshipType.INPUT_TO],
        ["edge:workflow-parent-v1", "asset:workflow:v1", "asset:system:parent:v1", AssetLineageRelationshipType.INPUT_TO],
        ["edge:model-child-v2", "asset:model:v2", "asset:system:child:v2", AssetLineageRelationshipType.INPUT_TO],
        ["edge:workflow-child-v2", "asset:workflow:v1", "asset:system:child:v2", AssetLineageRelationshipType.INPUT_TO],
        ["edge:child-v2-parent-v2", "asset:system:child:v2", "asset:system:parent:v2", AssetLineageRelationshipType.DERIVED_FROM],
        ["edge:model-parent-v2", "asset:model:v2", "asset:system:parent:v2", AssetLineageRelationshipType.INPUT_TO],
        ["edge:workflow-parent-v2", "asset:workflow:v1", "asset:system:parent:v2", AssetLineageRelationshipType.INPUT_TO],
      ] as const;
      for (const [edgeId, fromVersionId, toVersionId, type] of lineageEdges) {
        await repository.saveEdge(new AssetLineageEdge({ edgeId, fromVersionId, toVersionId, type }));
      }

      await Promise.all([
        repository.upsertIdentity({
          entityType: "installed-model",
          entityId: "entity:model",
          assetId: "asset:model",
          latestVersionId: "asset:model:v2",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        }),
        repository.upsertIdentity({
          entityType: "workflow-definition",
          entityId: "entity:workflow",
          assetId: "asset:workflow",
          latestVersionId: "asset:workflow:v1",
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
        }),
        repository.upsertIdentity({
          entityType: "execution-artifact",
          entityId: "entity:child-system",
          assetId: "asset:system:child",
          latestVersionId: "asset:system:child:v2",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        }),
        repository.upsertIdentity({
          entityType: "execution-artifact",
          entityId: "entity:parent-system",
          assetId: "asset:system:parent",
          latestVersionId: "asset:system:parent:v2",
          taxonomy: { structuralKind: "system", semanticRole: "app-template", behaviorKind: "deterministic" },
        }),
      ]);

      const queryService = new RegistryQueryService(
        repository,
        repository,
        repository,
        buildResolver(),
        repository,
        undefined,
        undefined,
        repository,
      );
      const graphService = new RegistryDependencyGraphService(queryService, repository, repository, undefined, repository);
      const api = new RegistryBackendApi(new CrossStudioRegistryQueryService(queryService), graphService);

      const listedSystems = await api.filterAssets({ structuralKinds: ["system"] });
      expect(listedSystems.ok).toBeTrue();
      expect(listedSystems.data?.map((entry) => entry.assetId).sort()).toEqual(["asset:system:child", "asset:system:parent"]);

      const detail = await api.getAssetDetail({ assetId: "asset:system:parent" });
      expect(detail.ok).toBeTrue();
      expect(detail.data?.versionId).toBe("asset:system:parent:v2");
      expect(detail.data?.dependencies.some((entry) => entry.versionId === "asset:system:child:v2")).toBeTrue();
      expect(detail.data?.systemDetails?.selectedChildren.some((entry) => (
        entry.componentKind === "system" && entry.versionId === "asset:system:child:v2"
      ))).toBeTrue();
      expect(detail.data?.systemDetails?.versionLineage.parentVersionId).toBe("asset:system:parent:v1");
      expect(detail.data?.systemDetails?.versionLineage.nestedSystemVersionReferences.some((entry) => (
        entry.versionId === "asset:system:child:v2" && entry.includedInUpstream
      ))).toBeTrue();

      const dependencyGraph = await api.getDependencies({ versionId: "asset:system:parent:v2" });
      expect(dependencyGraph.ok).toBeTrue();
      expect(dependencyGraph.data?.edges.some((edge) => (
        edge.fromVersionId === "asset:system:parent:v2" && edge.toVersionId === "asset:system:child:v2"
      ))).toBeTrue();
      expect(dependencyGraph.data?.edges.some((edge) => (
        edge.fromVersionId === "asset:system:parent:v2" && edge.toVersionId === "asset:model:v2"
      ))).toBeTrue();
      expect(dependencyGraph.data?.edges.some((edge) => (
        edge.fromVersionId === "asset:system:parent:v2" && edge.toVersionId === "asset:workflow:v1"
      ))).toBeTrue();

      const upstreamTraversal = await api.traverseDependencies({ versionId: "asset:system:parent:v2", maxDepth: 2 });
      expect(upstreamTraversal.ok).toBeTrue();
      expect(upstreamTraversal.data?.graph.nodes.some((node) => node.versionId === "asset:system:child:v2")).toBeTrue();
      expect(upstreamTraversal.data?.graph.nodes.some((node) => node.versionId === "asset:model:v2")).toBeTrue();

      expect(detail.data?.lineage.upstream.some((entry) => entry.versionId === "asset:system:child:v2")).toBeTrue();
      expect(detail.data?.lineage.upstream.some((entry) => entry.versionId === "asset:model:v2")).toBeTrue();
      expect(detail.data?.lineage.upstream.some((entry) => entry.versionId === "asset:workflow:v1")).toBeTrue();

      const detailByVersion = await api.getAssetDetail({ versionId: "asset:system:parent:v1" });
      expect(detailByVersion.ok).toBeTrue();
      expect(detailByVersion.data?.versionId).toBe("asset:system:parent:v2");
      expect(detailByVersion.data?.versionHistory.map((entry) => entry.versionId)).toEqual([
        "asset:system:parent:v1",
        "asset:system:parent:v2",
      ]);
      expect(detailByVersion.data?.versionHistory[1]?.upstreamAdded).toContain("asset:system:child:v2");
      expect(detailByVersion.data?.versionHistory[1]?.upstreamRemoved).toContain("asset:system:child:v1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
