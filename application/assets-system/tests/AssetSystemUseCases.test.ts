import { describe, expect, it } from "bun:test";
import { Asset } from "../../../domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import { RegisterAssetUseCase } from "../RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "../CreateAssetVersionUseCase";
import { RecordAssetTransformationUseCase } from "../RecordAssetTransformationUseCase";
import { LinkAssetLineageUseCase } from "../LinkAssetLineageUseCase";
import { GetAssetHistoryUseCase } from "../GetAssetHistoryUseCase";
import { GetAssetLineageSummaryUseCase } from "../GetAssetLineageSummaryUseCase";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { AssetLineageEdge } from "../../../domain/assets/AssetLineageEdge";
import { AssetTransformation } from "../../../domain/assets/AssetTransformation";

class InMemoryAssetSystemRepository {
  public readonly assets = new Map<string, Asset>();
  public readonly versions = new Map<string, AssetVersion>();
  public readonly edges = new Map<string, AssetLineageEdge>();
  public readonly transformations = new Map<string, AssetTransformation>();

  public async save(asset: Asset): Promise<void> { this.assets.set(asset.id, asset); }
  public async getById(assetId: string): Promise<Asset | undefined> { return this.assets.get(assetId.trim()); }
  public async list(): Promise<ReadonlyArray<Asset>> { return [...this.assets.values()]; }
  public async exists(assetId: string): Promise<boolean> { return this.assets.has(assetId.trim()); }
  public async saveVersion(version: AssetVersion): Promise<void> { this.versions.set(version.versionId, version); }
  public async getByVersionId(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId.trim()); }
  public async listVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return [...this.versions.values()].filter((version) => version.assetId.value === assetId.trim());
  }
  public async saveEdge(edge: AssetLineageEdge): Promise<void> { this.edges.set(edge.edgeId, edge); }
  public async listEdgesByVersionId(versionId: string, direction: "upstream" | "downstream" | "both" = "both"): Promise<ReadonlyArray<AssetLineageEdge>> {
    return [...this.edges.values()].filter((edge) => direction === "upstream"
      ? edge.toVersionId === versionId
      : direction === "downstream"
        ? edge.fromVersionId === versionId
        : edge.fromVersionId === versionId || edge.toVersionId === versionId);
  }
  public async saveTransformation(transformation: AssetTransformation): Promise<void> { this.transformations.set(transformation.transformationId, transformation); }
  public async getTransformationById(transformationId: string): Promise<AssetTransformation | undefined> { return this.transformations.get(transformationId.trim()); }
  public async listByVersionId(versionId: string): Promise<ReadonlyArray<AssetTransformation>> {
    return [...this.transformations.values()].filter((transformation) => transformation.inputVersionIds.includes(versionId) || transformation.outputVersionIds.includes(versionId));
  }
}

describe("Asset system use cases", () => {
  it("registers assets, versions, transformations, and links lineage", async () => {
    const repository = new InMemoryAssetSystemRepository();
    const registerAsset = new RegisterAssetUseCase(repository as any);
    const createVersion = new CreateAssetVersionUseCase(repository as any);
    const recordTransformation = new RecordAssetTransformationUseCase({
      saveTransformation: repository.saveTransformation.bind(repository),
      getById: repository.getTransformationById.bind(repository),
      listByVersionId: repository.listByVersionId.bind(repository),
    });
    const linkLineage = new LinkAssetLineageUseCase(repository as any);

    const asset = new Asset({
      id: "asset-1",
      name: "Asset 1",
      kind: "document",
      source: new AssetSourceInfo({ type: "uploaded" }),
      location: new AssetLocation({ accessMethod: "local-file", location: "/tmp/a.txt" }),
      status: "available",
    });

    await registerAsset.execute({ asset });
    await createVersion.execute({ assetId: asset.id, versionId: "v1" });
    await createVersion.execute({ assetId: asset.id, versionId: "v2", upstreamVersionIds: ["v1"] });
    await recordTransformation.execute({
      transformationId: "tx-1",
      kind: "test-transform",
      status: "completed",
      inputVersionIds: ["v1"],
      outputVersionIds: ["v2"],
    });
    await linkLineage.execute({
      edgeId: "edge-1",
      fromVersionId: "v1",
      toVersionId: "v2",
      kind: "derived-from",
      transformationId: "tx-1",
    });

    const history = await new GetAssetHistoryUseCase(
      repository as any,
      repository as any,
      repository as any,
      {
        saveTransformation: repository.saveTransformation.bind(repository),
        getById: repository.getTransformationById.bind(repository),
        listByVersionId: repository.listByVersionId.bind(repository),
      },
    ).execute(asset.id);
    expect(history.versions).toHaveLength(2);

    const lineage = await new GetAssetLineageSummaryUseCase(repository as any).execute({
      versionId: "v2",
      direction: "upstream",
      maxDepth: 2,
      maxEdges: 10,
    });
    expect(lineage.visitedVersionIds).toContain("v1");
    expect(lineage.traversedEdgeIds).toContain("edge-1");
  });
});
