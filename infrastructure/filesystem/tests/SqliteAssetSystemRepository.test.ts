import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SqliteAssetSystemRepository } from "../SqliteAssetSystemRepository";
import { Asset } from "../../../domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { AssetTransformation } from "../../../domain/assets/AssetTransformation";
import { AssetLineageEdge, AssetLineageRelationshipType } from "../../../domain/assets/AssetLineageEdge";

describe("SqliteAssetSystemRepository", () => {
  it("persists asset, version, lineage edges, and transformations", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-asset-system-"));

    try {
      const repo = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repo.isAvailable) {
        return;
      }
      const asset = new Asset({
        id: "asset-1",
        name: "Asset 1",
        kind: "document",
        status: "available",
        source: new AssetSourceInfo({ type: "uploaded" }),
        location: new AssetLocation({ accessMethod: "local-file", location: "/tmp/a.txt" }),
      });

      await repo.save(asset);
      await repo.saveVersion(new AssetVersion({ assetId: asset.id, versionId: "v1", versionLabel: "1" }));
      await repo.saveVersion(new AssetVersion({ assetId: asset.id, versionId: "v2", versionLabel: "2", parentVersionId: "v1", upstreamVersionIds: ["v1"] }));
      await repo.saveTransformation(new AssetTransformation({
        transformationId: "tx-1",
        transformationType: "test-transform",
        status: "success",
        inputVersionIds: ["v1"],
        outputVersionIds: ["v2"],
      }));
      await repo.saveEdge(new AssetLineageEdge({
        edgeId: "edge-1",
        fromVersionId: "v1",
        toVersionId: "v2",
        type: AssetLineageRelationshipType.DERIVED_FROM,
        transformationId: "tx-1",
      }));

      expect((await repo.getById("asset-1"))?.name).toBe("Asset 1");
      const versions = await repo.listVersionsByAssetId("asset-1");
      expect(versions.length).toBe(2);
      expect(versions[0].versionLabel).toBe("2");
      expect(versions[0].parentVersionId).toBe("v1");
      expect((await repo.listByVersionId("v2")).length).toBe(1);
      expect((await repo.listEdgesByVersionId("v2", "upstream")).length).toBe(1);
      expect((await repo.listVersionChainByAssetId("asset-1")).map((version) => version.versionId)).toEqual(["v2", "v1"]);
      expect((await repo.listLineageEdgesByAssetId("asset-1")).length).toBe(1);

      await repo.upsertIdentity({
        entityType: "workflow-definition",
        entityId: "wf-1",
        assetId: "asset-1",
        latestVersionId: "v2",
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
      });
      const identities = await repo.listCanonicalIdentities({ entityType: "workflow-definition" });
      expect(identities[0]?.entityId).toBe("wf-1");
      expect(identities[0]?.taxonomy?.semanticRole).toBe("workflow");
      expect((await repo.listAssetsByCriteria({ semanticRoles: ["workflow"] })).length).toBe(1);
      expect((await repo.listAssetsByCriteria({ semanticRoles: ["model"] })).length).toBe(0);

      await repo.saveDependencyState({
        versionId: "v2",
        computedAt: new Date("2026-03-24T00:00:00.000Z"),
        summary: {
          versionId: "v2",
          state: "impacted",
          lineageConfidence: "partial",
          reasons: ["upstream changed"],
          impactedByUpstreamVersionIds: ["v1"],
          staleBecauseUpstreamAdvanced: [],
          nextActions: ["Refresh dependency state after upstream changes and review downstream exposure."],
        },
      });
      const dependencyState = await repo.getDependencyState("v2");
      expect(dependencyState?.summary.state).toBe("impacted");
      expect(dependencyState?.summary.reasons[0]).toBe("upstream changed");

      const projectionStateAfterWrites = await repo.getProjectionState();
      expect(projectionStateAfterWrites?.dirty).toBeTrue();
      await repo.saveProjection({
        nodes: Object.freeze([
          Object.freeze({
            assetId: "asset-1",
            versionId: "v2",
            name: "Asset 1",
            kind: "document",
            status: "available",
            isRegistryProjected: true,
          }),
        ]),
        edges: Object.freeze([
          Object.freeze({
            fromAssetId: "asset-1",
            fromVersionId: "v2",
            toAssetId: "asset-1",
            toVersionId: "v1",
            source: "version-upstream" as const,
          }),
        ]),
        computedAt: new Date("2026-03-24T00:05:00.000Z"),
        sourceSignature: Object.freeze({ versionCount: 2, lineageEdgeCount: 1 }),
      });
      const loadedProjection = await repo.loadProjection();
      expect(loadedProjection?.nodes.length).toBe(1);
      expect(loadedProjection?.edges.length).toBe(1);
      const projectionState = await repo.getProjectionState();
      expect(projectionState?.dirty).toBeFalse();
      expect(projectionState?.sourceSignature?.versionCount).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
