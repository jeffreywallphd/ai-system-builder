import { describe, expect, it } from "bun:test";
import { Asset } from "../../../domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSemanticMetadata, AssetSourceInfo, AssetTechnicalMetadata } from "../../../domain/assets/AssetMetadata";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import type { IAssetRecordRepository } from "../../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";
import { AtomicAssetExportService, CompositeAssetExportService } from "../AssetExportServices";

class InMemoryAssetRecordRepository implements IAssetRecordRepository {
  private readonly records = new Map<string, IAsset>();
  public async save(asset: IAsset): Promise<void> { this.records.set(asset.id, asset); }
  public async getById(assetId: string): Promise<IAsset | undefined> { return this.records.get(assetId); }
  public async list(): Promise<ReadonlyArray<IAsset>> { return Object.freeze([...this.records.values()]); }
  public async exists(assetId: string): Promise<boolean> { return this.records.has(assetId); }
}

class InMemoryAssetVersionRepository implements IAssetVersionRepository {
  private readonly records = new Map<string, AssetVersion>();
  public async saveVersion(version: AssetVersion): Promise<void> { this.records.set(version.versionId, version); }
  public async getByVersionId(versionId: string): Promise<AssetVersion | undefined> { return this.records.get(versionId); }
  public async listVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return Object.freeze([...this.records.values()].filter((entry) => entry.assetId.value === assetId));
  }
}

function createAsset(input: { readonly id: string; readonly kind?: IAsset["kind"]; readonly name?: string }): IAsset {
  return new Asset({
    id: input.id,
    name: input.name ?? input.id,
    kind: input.kind ?? "json",
    status: "available",
    source: new AssetSourceInfo({ type: "generated" }),
    location: new AssetLocation({ accessMethod: "virtual", location: `memory://${input.id}` }),
    technical: new AssetTechnicalMetadata({}),
    semantic: new AssetSemanticMetadata({}),
    audit: new AssetAuditInfo({ createdAt: new Date("2026-03-28T00:00:00.000Z"), updatedAt: new Date("2026-03-28T00:00:00.000Z") }),
  });
}

describe("Asset export services", () => {
  it("exports a version-pinned atomic asset through the authoritative flow deterministically", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();

    await assets.save(createAsset({ id: "installed-model:model-a", kind: "json" }));
    await assets.save(createAsset({ id: "asset:tokenizer", kind: "json" }));

    await versions.saveVersion(new AssetVersion({
      assetId: "asset:tokenizer",
      versionId: "asset:tokenizer:v1",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
    }));

    await versions.saveVersion(new AssetVersion({
      assetId: "installed-model:model-a",
      versionId: "installed-model:model-a:v3",
      upstreamVersionIds: ["asset:tokenizer:v1"],
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      metadata: {
        metadata: {
          title: "Model A",
          summary: "Pinned base model",
          tags: ["model", "portable"],
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        dependencies: [{ assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1", relation: "dependency" }],
      },
    }));

    const service = new AtomicAssetExportService(assets, versions);
    const first = await service.export({ assetId: "installed-model:model-a", versionId: "installed-model:model-a:v3" });
    const second = await service.export({ assetId: "installed-model:model-a", versionId: "installed-model:model-a:v3" });

    expect(first.ok).toBeTrue();
    expect(second.ok).toBeTrue();
    if (first.ok && second.ok) {
      expect(first.artifact.content).toBe(second.artifact.content);
      expect(first.bundleId).toBe("exchange:atomic:installed-model:model-a:installed-model:model-a:v3");
      expect(first.artifact.content).toContain('"assetId": "installed-model:model-a"');
      expect(first.artifact.content).toContain('"versionId": "installed-model:model-a:v3"');
      expect(first.artifact.content).toContain('"assetId": "asset:tokenizer"');
      expect(first.artifact.content).not.toContain("runtimeState");
      expect(first.artifact.content).not.toContain("deploymentState");
    }
  });

  it("returns structured failure outcomes for invalid atomic export requests", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();
    const service = new AtomicAssetExportService(assets, versions);

    const invalid = await service.export({ assetId: "", versionId: "" });
    const missingAsset = await service.export({ assetId: "asset:missing", versionId: "asset:missing:v1" });

    expect(invalid.ok).toBeFalse();
    if (!invalid.ok) {
      expect(invalid.code).toBe("invalid-request");
    }

    expect(missingAsset.ok).toBeFalse();
    if (!missingAsset.ok) {
      expect(missingAsset.code).toBe("asset-not-found");
    }
  });

  it("exports a version-pinned composite asset preserving composition and dependency meaning", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();

    await assets.save(createAsset({ id: "workflow-definition:wf-1", kind: "workflow-definition" }));
    await assets.save(createAsset({ id: "installed-model:model-a" }));
    await assets.save(createAsset({ id: "dataset-version:data-1" }));

    await versions.saveVersion(new AssetVersion({ assetId: "installed-model:model-a", versionId: "installed-model:model-a:v1" }));
    await versions.saveVersion(new AssetVersion({ assetId: "dataset-version:data-1", versionId: "dataset-version:data-1:v2" }));

    await versions.saveVersion(new AssetVersion({
      assetId: "workflow-definition:wf-1",
      versionId: "workflow-definition:wf-1:v5",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      upstreamVersionIds: ["installed-model:model-a:v1", "dataset-version:data-1:v2"],
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
          title: "Workflow 1",
        },
        composition: [
          { alias: "model", assetId: "installed-model:model-a", versionId: "installed-model:model-a:v1", relation: "component", taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } },
          { alias: "dataset", assetId: "dataset-version:data-1", versionId: "dataset-version:data-1:v2", relation: "component", taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" } },
        ],
        dependencies: [
          { assetId: "installed-model:model-a", versionId: "installed-model:model-a:v1", relation: "component" },
          { assetId: "dataset-version:data-1", versionId: "dataset-version:data-1:v2", relation: "dependency" },
        ],
      },
    }));

    const service = new CompositeAssetExportService(assets, versions);
    const result = await service.export({ assetId: "workflow-definition:wf-1", versionId: "workflow-definition:wf-1:v5" });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.compositionCount).toBe(2);
      expect(result.bundleId).toBe("exchange:composite:workflow-definition:wf-1:workflow-definition:wf-1:v5");
      expect(result.artifact.content).toContain('"type": "composite"');
      expect(result.artifact.content).toContain('"alias": "dataset"');
      expect(result.artifact.content).toContain('"alias": "model"');
      expect(result.artifact.content).toContain('"relation": "component"');
      expect(result.artifact.content).toContain('"relation": "dependency"');
      expect(result.artifact.content).not.toContain("runtimeState");
      expect(result.artifact.content).not.toContain("deploymentState");
    }
  });

  it("returns structured failures for invalid composite dependency/composition pins", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();

    await assets.save(createAsset({ id: "workflow-definition:wf-invalid", kind: "workflow-definition" }));
    await versions.saveVersion(new AssetVersion({
      assetId: "workflow-definition:wf-invalid",
      versionId: "workflow-definition:wf-invalid:v1",
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
        },
        composition: [{ alias: "child", assetId: "installed-model:model-a", relation: "component" }],
      },
    }));

    const service = new CompositeAssetExportService(assets, versions);
    const result = await service.export({ assetId: "workflow-definition:wf-invalid", versionId: "workflow-definition:wf-invalid:v1" });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.code).toBe("invalid-request");
      expect(result.message).toContain("pinned version id");
    }
  });
});
