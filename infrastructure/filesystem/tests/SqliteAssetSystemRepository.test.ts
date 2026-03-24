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

      await repo.upsertIdentity({ entityType: "workflow-definition", entityId: "wf-1", assetId: "asset-1", latestVersionId: "v2" });
      const identities = await repo.listCanonicalIdentities({ entityType: "workflow-definition" });
      expect(identities[0]?.entityId).toBe("wf-1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
