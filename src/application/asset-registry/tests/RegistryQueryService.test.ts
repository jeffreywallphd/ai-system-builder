import { describe, expect, it } from "bun:test";
import { RegistryQueryService } from "../RegistryQueryService";
import { Asset } from "@domain/assets/Asset";
import { AssetVersion } from "@domain/assets/AssetVersion";
import { AssetLineageEdge, AssetLineageRelationshipType } from "@domain/assets/AssetLineageEdge";
import type { IAssetRecordRepository } from "../../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";
import type { IAssetLineageRepository } from "../../ports/interfaces/IAssetLineageRepository";
import type { IAssetSystemQueryRepository } from "../../ports/interfaces/IAssetSystemQueryRepository";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "@domain/taxonomy/CompositionTaxonomy";

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
    expect(workflowOnly[0]?.versionHistory.length).toBe(1);
    expect(workflowOnly[0]?.lineage.upstream.some((entry) => entry.versionId === "asset:model:v1")).toBeTrue();

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

    const searched = await service.queryRegistry({ keyword: "workflow-author" });
    expect(searched).toHaveLength(1);
    expect(searched[0]?.assetId).toBe("asset:workflow");
  });

  it("caches read-model query results and invalidates on source signature changes", async () => {
    const modelAsset = buildAsset("asset:model", "Model", "generic");
    const modelVersion = buildVersion({
      assetId: "asset:model",
      versionId: "asset:model:v1",
    });

    let listCalls = 0;
    let latestCalls = 0;
    let identityCalls = 0;
    let signature = { versionCount: 1, lineageEdgeCount: 0 };

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> & {
      getCurrentSourceSignature(): Promise<{ readonly versionCount: number; readonly lineageEdgeCount: number }>;
    } = {
      async listAssetsByCriteria() {
        listCalls += 1;
        return [modelAsset];
      },
      async getLatestVersionForAsset() {
        latestCalls += 1;
        return modelVersion;
      },
      async listCanonicalIdentities() {
        identityCalls += 1;
        return [];
      },
      async getCurrentSourceSignature() {
        return signature;
      },
    };

    const service = new RegistryQueryService(
      new InMemoryAssetRecordRepository([modelAsset]),
      new InMemoryAssetVersionRepository([modelVersion]),
      new InMemoryLineageRepository([]),
      {
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
      },
      queryRepository,
    );

    const first = await service.queryRegistry({ structuralKinds: ["atomic"] });
    const second = await service.queryRegistry({ structuralKinds: ["atomic"] });
    expect(first).toEqual(second);
    expect(listCalls).toBe(1);
    expect(latestCalls).toBe(1);
    expect(identityCalls).toBe(1);
    expect(service.getCacheStats().hits).toBeGreaterThan(0);

    signature = { versionCount: 2, lineageEdgeCount: 0 };
    const third = await service.queryRegistry({ structuralKinds: ["atomic"] });
    expect(third).toEqual(first);
    expect(listCalls).toBe(2);
    expect(latestCalls).toBe(2);
    expect(identityCalls).toBe(2);
  });

  it("projects system detail and recursive dependency summaries for registry detail surfaces", async () => {
    const modelAsset = buildAsset("asset:model", "Model", "generic");
    const childAsset = buildAsset("asset:child-system", "Child System", "system-composition");
    const rootAsset = buildAsset("asset:root-system", "Root System", "system-composition");

    const modelVersion = buildVersion({
      assetId: "asset:model",
      versionId: "asset:model:v1",
      metadata: {
        metadata: {
          taxonomy: {
            structuralKind: TaxonomyStructuralKinds.atomic,
            semanticRole: TaxonomySemanticRoles.model,
            behaviorKind: TaxonomyBehaviorKinds.none,
          },
        },
      },
    });

    const childVersion = buildVersion({
      assetId: "asset:child-system",
      versionId: "asset:child-system:v1",
      metadata: {
        metadata: {
          taxonomy: {
            structuralKind: TaxonomyStructuralKinds.system,
            semanticRole: TaxonomySemanticRoles.system,
            behaviorKind: TaxonomyBehaviorKinds.deterministic,
          },
          provenance: { creatorId: "child-author", sourceType: "generated" },
        },
        dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1" }],
        content: JSON.stringify({
          systemSpec: {
            components: [{ componentKind: "atomic", assetId: "asset:model", versionId: "asset:model:v1", alias: "model" }],
            inputs: [{ inputId: "prompt", valueType: "string", required: true }],
            outputs: [{ outputId: "answer", valueType: "string" }],
            parameters: [{ parameterId: "temperature", valueType: "number", required: false, defaultValue: 0.3 }],
            bindings: [],
          },
        }),
      },
    });

    const rootVersion = buildVersion({
      assetId: "asset:root-system",
      versionId: "asset:root-system:v1",
      metadata: {
        metadata: {
          taxonomy: {
            structuralKind: TaxonomyStructuralKinds.system,
            semanticRole: TaxonomySemanticRoles.appTemplate,
            behaviorKind: TaxonomyBehaviorKinds.conditional,
          },
          provenance: { creatorId: "root-author", sourceType: "generated" },
        },
        dependencies: [{ assetId: "asset:child-system", versionId: "asset:child-system:v1" }],
        content: JSON.stringify({
          systemSpec: {
            components: [{ componentKind: "system", assetId: "asset:child-system", versionId: "asset:child-system:v1", alias: "child" }],
            inputs: [{ inputId: "userPrompt", valueType: "string", required: true }],
            outputs: [{ outputId: "finalAnswer", valueType: "string" }],
            parameters: [{ parameterId: "maxTokens", valueType: "number", required: false, defaultValue: 256 }],
            executionMetadata: {
              runtime: { environment: "python-3.11", requirements: ["numpy", "pandas"] },
              orchestration: { mode: "queued", hints: ["retryable"] },
              publish: { visibility: "team", exportTargets: ["registry"] },
              executionProfile: { profileId: "profile:prod", latencyTier: "standard" },
              operations: { ownerTeam: "platform", supportContact: "ops@loom.local" },
            },
            bindings: [
              {
                bindingId: "prompt-in",
                source: { scope: "system-input", endpointId: "userPrompt" },
                target: { scope: "component-input", componentAlias: "child", endpointId: "prompt" },
              },
            ],
          },
        }),
      },
      upstreamVersionIds: ["asset:child-system:v1", "asset:model:v1"],
    });

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria() {
        return [modelAsset, childAsset, rootAsset];
      },
      async getLatestVersionForAsset(assetId) {
        if (assetId === "asset:model") return modelVersion;
        if (assetId === "asset:child-system") return childVersion;
        if (assetId === "asset:root-system") return rootVersion;
        return undefined;
      },
      async listCanonicalIdentities() {
        return [
          {
            entityType: "execution-artifact" as const,
            entityId: "entity:root",
            assetId: "asset:root-system",
            latestVersionId: "asset:root-system:v1",
            taxonomy: {
              structuralKind: TaxonomyStructuralKinds.system,
              semanticRole: TaxonomySemanticRoles.appTemplate,
              behaviorKind: TaxonomyBehaviorKinds.conditional,
            },
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        ];
      },
    };

    const service = new RegistryQueryService(
      new InMemoryAssetRecordRepository([modelAsset, childAsset, rootAsset]),
      new InMemoryAssetVersionRepository([modelVersion, childVersion, rootVersion]),
      new InMemoryLineageRepository([]),
      {
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
      },
      queryRepository,
    );

    const result = await service.queryRegistry({
      structuralKinds: [TaxonomyStructuralKinds.system],
      semanticRoles: [TaxonomySemanticRoles.appTemplate],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.assetId).toBe("asset:root-system");
    expect(result[0]?.systemDetails?.selectedChildren.map((child) => child.assetId)).toEqual(["asset:child-system"]);
    expect(result[0]?.systemDetails?.interfaces.inputs.map((entry) => entry.id)).toEqual(["userPrompt"]);
    expect(result[0]?.systemDetails?.bindings.bindingIds).toEqual(["prompt-in"]);
    expect(result[0]?.systemDetails?.aggregatedDependencies.directCount).toBeGreaterThan(0);
    expect(result[0]?.systemDetails?.aggregatedDependencies.transitiveCount).toBeGreaterThan(0);
    expect(result[0]?.systemDetails?.aggregatedDependencies.traversalStatus).toBe("complete");
    expect(result[0]?.systemDetails?.versionLineage.currentVersionId).toBe("asset:root-system:v1");
    expect(result[0]?.systemDetails?.versionLineage.childVersionReferences.some((entry) => entry.includedInUpstream)).toBeTrue();
    expect(result[0]?.systemDetails?.executionMetadata?.runtimeEnvironment).toBe("python-3.11");
    expect(result[0]?.systemDetails?.executionMetadata?.runtimeRequirementCount).toBe(2);
    expect(result[0]?.systemDetails?.executionMetadata?.publishVisibility).toBe("team");
    expect(result[0]?.validation?.issues.some((issue) => issue.code === "taxonomy-semantic-role-mismatch")).toBeFalse();
  });

  it("projects bounded runtime activity summaries onto system registry detail views", async () => {
    const systemAsset = buildAsset("asset:runtime-system", "Runtime System", "system-composition");
    const systemVersion = buildVersion({
      assetId: "asset:runtime-system",
      versionId: "asset:runtime-system:v1",
      metadata: {
        metadata: {
          taxonomy: {
            structuralKind: TaxonomyStructuralKinds.system,
            semanticRole: TaxonomySemanticRoles.system,
            behaviorKind: TaxonomyBehaviorKinds.deterministic,
          },
        },
        content: JSON.stringify({
          systemSpec: {
            components: [],
            inputs: [{ inputId: "request", valueType: "string", required: true }],
            outputs: [{ outputId: "response", valueType: "string" }],
            parameters: [],
          },
        }),
      },
    });

    const queryRepository: Pick<IAssetSystemQueryRepository, "listAssetsByCriteria" | "getLatestVersionForAsset" | "listCanonicalIdentities"> = {
      async listAssetsByCriteria() { return [systemAsset]; },
      async getLatestVersionForAsset() { return systemVersion; },
      async listCanonicalIdentities() {
        return [{
          entityType: "workflow-definition",
          entityId: "entity:runtime-system",
          assetId: "asset:runtime-system",
          latestVersionId: "asset:runtime-system:v1",
          taxonomy: {
            structuralKind: TaxonomyStructuralKinds.system,
            semanticRole: TaxonomySemanticRoles.system,
            behaviorKind: TaxonomyBehaviorKinds.deterministic,
          },
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        }];
      },
    };

    const service = new RegistryQueryService(
      new InMemoryAssetRecordRepository([systemAsset]),
      new InMemoryAssetVersionRepository([systemVersion]),
      new InMemoryLineageRepository([]),
      {
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
      },
      queryRepository,
      undefined,
      undefined,
      undefined,
      {
        listRecentExecutionsForSystem() {
          return [{
            executionId: "exec:runtime-system:v1:1",
            status: "succeeded",
            result: "succeeded",
            startedAt: "2026-03-28T10:00:00.000Z",
            completedAt: "2026-03-28T10:00:05.000Z",
            rootVersionId: "asset:runtime-system:v1",
            traceEventCount: 12,
            traceLogCount: 6,
          }];
        },
      },
    );

    const detail = await service.getAssetDetailByAssetId("asset:runtime-system");
    expect(detail?.systemDetails?.runtimeActivity?.recentExecutionCount).toBe(1);
    expect(detail?.systemDetails?.runtimeActivity?.latestExecution?.executionId).toBe("exec:runtime-system:v1:1");
    expect(detail?.systemDetails?.runtimeActivity?.recentExecutions[0]?.rootVersionId).toBe("asset:runtime-system:v1");
  });
});

it("classifies workflow-template assets for registry discovery", async () => {
  const templateAsset = buildAsset("asset:workflow-template", "Workflow Template", "workflow-template");
  const templateVersion = buildVersion({
    assetId: "asset:workflow-template",
    versionId: "asset:workflow-template:v1",
    metadata: {
      metadata: {
        provenance: {
          creatorId: "template-author",
          sourceType: "generated",
          sourceLabel: "workflow-template-studio",
        },
      },
    },
  });

  const service = new RegistryQueryService(
    new InMemoryAssetRecordRepository([templateAsset]),
    new InMemoryAssetVersionRepository([templateVersion]),
    new InMemoryLineageRepository([]),
    {
      async resolveCanonicalEntityContract() {
        return undefined;
      },
      resolveContractForTaxonomy(descriptor) {
        if (descriptor.semanticRole === "workflow-template") {
          return {
            version: "1.0.0",
            parameters: [{ id: "supportedIntent", required: true }],
            execution: { invocationMode: "deferred", sideEffects: "none" },
          };
        }
        return undefined;
      },
    },
  );

  const rows = await service.queryRegistry({ semanticRoles: ["workflow-template"] });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.taxonomy?.semanticRole).toBe("workflow-template");
});

