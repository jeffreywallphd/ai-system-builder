import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SqliteAssetSystemRepository } from "../../../infrastructure/filesystem/SqliteAssetSystemRepository";
import { NoopAssetLineageGraphProjectionSink } from "../../../infrastructure/filesystem/NoopAssetLineageGraphProjectionSink";
import { RegisterAssetUseCase } from "../RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "../CreateAssetVersionUseCase";
import { RecordAssetTransformationUseCase } from "../RecordAssetTransformationUseCase";
import { LinkAssetLineageUseCase } from "../LinkAssetLineageUseCase";
import { ProjectArtifactToAssetSystemUseCase } from "../ProjectArtifactToAssetSystemUseCase";
import { Asset } from "../../../domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import { AssetVersion } from "../../../domain/assets/AssetVersion";

describe("ProjectArtifactToAssetSystemUseCase integration", () => {
  it("projects workflow outputs into canonical asset/version/lineage records", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-asset-projection-"));

    try {
      const repository = new SqliteAssetSystemRepository(path.join(root, "asset-system.sqlite"));
      if (!repository.isAvailable) {
        return;
      }
      const graphSink = new NoopAssetLineageGraphProjectionSink();
      const useCase = new ProjectArtifactToAssetSystemUseCase(
        new RegisterAssetUseCase(repository),
        new CreateAssetVersionUseCase(repository),
        new RecordAssetTransformationUseCase(repository, graphSink),
        new LinkAssetLineageUseCase(repository, graphSink),
      );

      await repository.save(new Asset({
        id: "input-asset",
        name: "Input",
        kind: "document",
        status: "available",
        source: new AssetSourceInfo({ type: "uploaded" }),
        location: new AssetLocation({ accessMethod: "local-file", location: "/tmp/in.txt" }),
      }));
      await repository.saveVersion(new AssetVersion({
        assetId: "input-asset",
        versionId: "input-v1",
      }));

      const projection = await useCase.execute({
        projectionKind: "workflow-output",
        assetId: "workflow-output:exec-1:asset-1",
        name: "Generated Summary",
        executionId: "exec-1",
        workflowId: "workflow-1",
        nodeId: "node-1",
        location: "/tmp/out.txt",
        contentType: "text/plain",
        inputVersionIds: ["input-v1"],
      });

      const versions = await repository.listVersionsByAssetId(projection.assetId);
      expect(versions).toHaveLength(1);
      expect((await repository.listEdgesByVersionId(versions[0].versionId, "upstream")).length).toBe(1);
      expect((await repository.listByVersionId(versions[0].versionId)).length).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
