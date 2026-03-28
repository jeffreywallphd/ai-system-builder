import { describe, expect, it } from "bun:test";
import { Asset } from "../../../domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSemanticMetadata, AssetSourceInfo, AssetTechnicalMetadata } from "../../../domain/assets/AssetMetadata";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import type { IAsset } from "../../../domain/assets/interfaces/IAsset";
import type { IAssetRecordRepository } from "../../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";
import {
  AtomicAssetExportService,
  AtomicAssetImportService,
  CompositeAssetExportService,
  CompositeAssetImportService,
  SystemAssetExportService,
  SystemAssetImportService,
} from "../AssetExportServices";
import { ExchangeAccessEvaluator, RoleBasedExchangeAccessPolicy } from "../ExchangeAccessControl";

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

  it("denies unauthorized exchange export/import at authoritative service entry points", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();
    await assets.save(createAsset({ id: "asset:secure-a", kind: "json" }));
    await versions.saveVersion(new AssetVersion({ assetId: "asset:secure-a", versionId: "asset:secure-a:v1" }));

    const access = new ExchangeAccessEvaluator(new RoleBasedExchangeAccessPolicy());
    const exportService = new AtomicAssetExportService(assets, versions, access);
    const exportDenied = await exportService.export({
      assetId: "asset:secure-a",
      versionId: "asset:secure-a:v1",
      accessContext: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "import-only", roles: ["exchange-importer"] },
      },
      resourceTenantId: "tenant-a",
    });
    expect(exportDenied.ok).toBeFalse();
    if (!exportDenied.ok) {
      expect(exportDenied.code).toBe("forbidden");
    }

    const importService = new AtomicAssetImportService(new InMemoryAssetRecordRepository(), new InMemoryAssetVersionRepository(), access);
    const importDenied = await importService.import({
      artifactContent: "{\"broken\":true}",
      accessContext: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "export-only", roles: ["exchange-exporter"] },
      },
      resourceTenantId: "tenant-a",
    });
    expect(importDenied.ok).toBeFalse();
    if (!importDenied.ok) {
      expect(importDenied.code).toBe("forbidden");
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

  it("exports a version-pinned system asset with nested system-of-systems composition deterministically", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();

    await assets.save(createAsset({ id: "system:root", kind: "json" }));
    await assets.save(createAsset({ id: "system:child", kind: "json" }));
    await assets.save(createAsset({ id: "system:grandchild", kind: "json" }));
    await assets.save(createAsset({ id: "asset:model", kind: "json" }));
    await assets.save(createAsset({ id: "asset:workflow", kind: "workflow-definition" }));
    await assets.save(createAsset({ id: "asset:dataset", kind: "dataset" }));

    await versions.saveVersion(new AssetVersion({ assetId: "asset:model", versionId: "asset:model:v2" }));
    await versions.saveVersion(new AssetVersion({ assetId: "asset:workflow", versionId: "asset:workflow:v4" }));
    await versions.saveVersion(new AssetVersion({ assetId: "asset:dataset", versionId: "asset:dataset:v6" }));

    await versions.saveVersion(new AssetVersion({
      assetId: "system:grandchild",
      versionId: "system:grandchild:v1",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "conditional" },
          title: "Grandchild",
        },
        content: JSON.stringify({
          systemSpec: {
            components: [{ componentKind: "atomic", alias: "dataset", assetId: "asset:dataset", versionId: "asset:dataset:v6" }],
          },
        }),
      },
    }));

    await versions.saveVersion(new AssetVersion({
      assetId: "system:child",
      versionId: "system:child:v3",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
          title: "Child",
        },
        content: JSON.stringify({
          systemSpec: {
            components: [{ componentKind: "composite", alias: "workflow", assetId: "asset:workflow", versionId: "asset:workflow:v4" }],
            nestedSystems: [{ assetId: "system:grandchild", versionId: "system:grandchild:v1", alias: "grandchild" }],
          },
        }),
      },
    }));

    await versions.saveVersion(new AssetVersion({
      assetId: "system:root",
      versionId: "system:root:v5",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      metadata: {
        metadata: {
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "conditional" },
          title: "Root System",
          summary: "System-of-systems root",
          tags: ["system", "portable"],
        },
        dependencies: [{ assetId: "asset:model", versionId: "asset:model:v2" }],
        content: JSON.stringify({
          systemSpec: {
            components: [{ componentKind: "atomic", alias: "model", assetId: "asset:model", versionId: "asset:model:v2" }],
            nestedSystems: [{ assetId: "system:child", versionId: "system:child:v3", alias: "child" }],
            executionMetadata: {
              runtime: { requirements: ["gpu"] },
              orchestration: { hints: ["lane-aware"] },
            },
          },
        }),
      },
    }));

    const service = new SystemAssetExportService(assets, versions);
    const first = await service.export({ assetId: "system:root", versionId: "system:root:v5" });
    const second = await service.export({ assetId: "system:root", versionId: "system:root:v5" });

    expect(first.ok).toBeTrue();
    expect(second.ok).toBeTrue();
    if (first.ok && second.ok) {
      expect(first.bundleId).toBe("exchange:system:system:root:system:root:v5");
      expect(first.artifact.content).toBe(second.artifact.content);
      expect(first.compositionCount).toBeGreaterThanOrEqual(4);
      expect(first.nodeCount).toBeGreaterThanOrEqual(6);
      expect(first.artifact.content).toContain('"kind": "system-asset"');
      expect(first.artifact.content).toContain('"edgeKind": "nested-system"');
      expect(first.artifact.content).toContain('"assetId": "system:grandchild"');
      expect(first.artifact.content).toContain('"assetId": "asset:dataset"');
      expect(first.artifact.content).not.toContain("runtimeState");
      expect(first.artifact.content).not.toContain("deploymentState");
    }
  });

  it("imports serialized atomic bundles through the authoritative flow and preserves provenance linkage", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();

    await assets.save(createAsset({ id: "asset:tokenizer", kind: "json" }));
    await versions.saveVersion(new AssetVersion({
      assetId: "asset:tokenizer",
      versionId: "asset:tokenizer:v1",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
    }));

    const exporterAsset = createAsset({ id: "asset:import-me", kind: "json" });
    await assets.save(exporterAsset);
    await versions.saveVersion(new AssetVersion({
      assetId: "asset:import-me",
      versionId: "asset:import-me:v3",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      metadata: {
        metadata: {
          title: "Import Me",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        dependencies: [{ assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1", relation: "dependency" }],
      },
    }));

    const exported = await new AtomicAssetExportService(assets, versions).export({
      assetId: "asset:import-me",
      versionId: "asset:import-me:v3",
    });
    expect(exported.ok).toBeTrue();
    if (!exported.ok) {
      return;
    }

    const importAssets = new InMemoryAssetRecordRepository();
    const importVersions = new InMemoryAssetVersionRepository();
    const imported = await new AtomicAssetImportService(importAssets, importVersions, undefined, undefined, undefined, () => new Date("2026-03-28T01:00:00.000Z")).import({
      artifactContent: exported.artifact.content,
    });

    expect(imported.ok).toBeTrue();
    if (imported.ok) {
      expect(imported.imported.assetId).toBe("asset:import-me");
      expect(imported.imported.versionId).toBe("asset:import-me:v3");
      expect(imported.dependencyCount).toBe(1);
      expect(imported.imported.sourceVersionLineage).toEqual([]);
      expect(imported.imported.existingAsset).toBeFalse();
      expect(imported.imported.existingVersion).toBeFalse();
    }

    const storedAsset = await importAssets.getById("asset:import-me");
    const storedVersion = await importVersions.getByVersionId("asset:import-me:v3");
    expect(storedAsset?.source.type).toBe("imported");
    expect(storedAsset?.location.location).toContain("exchange://exchange:atomic:asset:import-me:asset:import-me:v3");
    expect(storedVersion?.metadata).toMatchObject({
      metadata: {
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        provenance: { sourceType: "imported", sourceLabel: "exchange-bundle" },
      },
      dependencies: [{ assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1", relation: "dependency" }],
    });
    expect(JSON.stringify(storedVersion?.metadata)).not.toContain("runtimeState");
    expect(JSON.stringify(storedVersion?.metadata)).not.toContain("deploymentState");
  });

  it("imports serialized composite bundles through the authoritative flow and preserves composition semantics", async () => {
    const exportAssets = new InMemoryAssetRecordRepository();
    const exportVersions = new InMemoryAssetVersionRepository();
    await exportAssets.save(createAsset({ id: "workflow-definition:wf-2", kind: "workflow-definition" }));
    await exportAssets.save(createAsset({ id: "asset:model-x", kind: "json" }));
    await exportAssets.save(createAsset({ id: "dataset-version:data-2", kind: "dataset" }));
    await exportVersions.saveVersion(new AssetVersion({ assetId: "asset:model-x", versionId: "asset:model-x:v1" }));
    await exportVersions.saveVersion(new AssetVersion({ assetId: "dataset-version:data-2", versionId: "dataset-version:data-2:v1" }));
    await exportVersions.saveVersion(new AssetVersion({
      assetId: "workflow-definition:wf-2",
      versionId: "workflow-definition:wf-2:v7",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      metadata: {
        metadata: {
          title: "Composite Import",
          taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
        },
        composition: [
          { alias: "model", assetId: "asset:model-x", versionId: "asset:model-x:v1", relation: "component", taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } },
          { alias: "dataset", assetId: "dataset-version:data-2", versionId: "dataset-version:data-2:v1", relation: "component", taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" } },
        ],
        dependencies: [
          { assetId: "asset:model-x", versionId: "asset:model-x:v1", relation: "component" },
          { assetId: "dataset-version:data-2", versionId: "dataset-version:data-2:v1", relation: "dependency" },
        ],
      },
    }));

    const exported = await new CompositeAssetExportService(exportAssets, exportVersions).export({
      assetId: "workflow-definition:wf-2",
      versionId: "workflow-definition:wf-2:v7",
    });
    expect(exported.ok).toBeTrue();
    if (!exported.ok) {
      return;
    }

    const importAssets = new InMemoryAssetRecordRepository();
    const importVersions = new InMemoryAssetVersionRepository();
    const imported = await new CompositeAssetImportService(importAssets, importVersions, undefined, undefined, undefined, () => new Date("2026-03-28T02:00:00.000Z")).import({
      artifactContent: exported.artifact.content,
    });

    expect(imported.ok).toBeTrue();
    if (imported.ok) {
      expect(imported.imported.assetId).toBe("workflow-definition:wf-2");
      expect(imported.imported.versionId).toBe("workflow-definition:wf-2:v7");
      expect(imported.imported.compositionCount).toBe(2);
      expect(imported.imported.dependencyCount).toBe(2);
    }

    const stored = await importVersions.getByVersionId("workflow-definition:wf-2:v7");
    const metadata = stored?.metadata as {
      readonly composition?: ReadonlyArray<{ readonly alias: string; readonly assetId: string; readonly versionId: string }>;
      readonly dependencies?: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>;
      readonly exchangeImport?: { readonly bundleId?: string };
    };
    expect(metadata.composition?.map((entry) => entry.alias)).toEqual(["dataset", "model"]);
    expect(metadata.dependencies?.length).toBe(2);
    expect(metadata.exchangeImport?.bundleId).toBe("exchange:composite:workflow-definition:wf-2:workflow-definition:wf-2:v7");
    expect(JSON.stringify(metadata)).not.toContain("runtimeState");
    expect(JSON.stringify(metadata)).not.toContain("deploymentState");
  });

  it("imports serialized system bundles through the authoritative flow and preserves system-of-systems semantics", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();

    await assets.save(createAsset({ id: "system:root", kind: "json" }));
    await assets.save(createAsset({ id: "system:child", kind: "json" }));
    await assets.save(createAsset({ id: "asset:model", kind: "json" }));
    await versions.saveVersion(new AssetVersion({ assetId: "asset:model", versionId: "asset:model:v1" }));
    await versions.saveVersion(new AssetVersion({
      assetId: "system:child",
      versionId: "system:child:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
        content: JSON.stringify({
          systemSpec: {
            components: [{ componentKind: "atomic", alias: "model", assetId: "asset:model", versionId: "asset:model:v1" }],
          },
        }),
      },
    }));
    await versions.saveVersion(new AssetVersion({
      assetId: "system:root",
      versionId: "system:root:v2",
      metadata: {
        metadata: {
          title: "Importable Root",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "conditional" },
        },
        content: JSON.stringify({
          systemSpec: {
            components: [{ componentKind: "atomic", alias: "model", assetId: "asset:model", versionId: "asset:model:v1" }],
            nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
            executionMetadata: { orchestration: { hints: ["portable"] } },
          },
        }),
      },
    }));

    const exported = await new SystemAssetExportService(assets, versions).export({
      assetId: "system:root",
      versionId: "system:root:v2",
    });
    expect(exported.ok).toBeTrue();
    if (!exported.ok) {
      return;
    }

    const importAssets = new InMemoryAssetRecordRepository();
    const importVersions = new InMemoryAssetVersionRepository();
    const imported = await new SystemAssetImportService(importAssets, importVersions, undefined, undefined, undefined, () => new Date("2026-03-28T03:00:00.000Z")).import({
      artifactContent: exported.artifact.content,
    });

    expect(imported.ok).toBeTrue();
    if (imported.ok) {
      expect(imported.imported.assetId).toBe("system:root");
      expect(imported.imported.versionId).toBe("system:root:v2");
      expect(imported.imported.nodeCount).toBeGreaterThanOrEqual(3);
      expect(imported.imported.compositionCount).toBeGreaterThanOrEqual(2);
    }

    const stored = await importVersions.getByVersionId("system:root:v2");
    const payload = stored?.metadata as { readonly content?: string; readonly exchangeImport?: { readonly bundleId?: string } };
    expect(payload.exchangeImport?.bundleId).toBe("exchange:system:system:root:system:root:v2");
    expect(payload.content).toContain("\"nestedSystems\"");
    expect(payload.content).toContain("\"assetId\":\"system:child\"");
    expect(payload.content).toContain("\"executionMetadata\"");
    expect(payload.content).not.toContain("runtimeState");
    expect(payload.content).not.toContain("deploymentState");
  });

  it("returns structured failures for unsupported composite/system import artifacts", async () => {
    const compositeService = new CompositeAssetImportService(new InMemoryAssetRecordRepository(), new InMemoryAssetVersionRepository());
    const systemService = new SystemAssetImportService(new InMemoryAssetRecordRepository(), new InMemoryAssetVersionRepository());

    const malformedComposite = await compositeService.import({ artifactContent: "not-json" });
    const malformedSystem = await systemService.import({ artifactContent: "not-json" });
    expect(malformedComposite.ok).toBeFalse();
    expect(malformedSystem.ok).toBeFalse();
    if (!malformedComposite.ok) {
      expect(malformedComposite.code).toBe("deserialization-failed");
    }
    if (!malformedSystem.ok) {
      expect(malformedSystem.code).toBe("deserialization-failed");
    }
  });

  it("returns structured failures for malformed and unsupported atomic import artifacts", async () => {
    const service = new AtomicAssetImportService(new InMemoryAssetRecordRepository(), new InMemoryAssetVersionRepository());

    const malformed = await service.import({ artifactContent: "not-json" });
    expect(malformed.ok).toBeFalse();
    if (!malformed.ok) {
      expect(malformed.code).toBe("deserialization-failed");
    }

    const exportAssets = new InMemoryAssetRecordRepository();
    const exportVersions = new InMemoryAssetVersionRepository();
    await exportAssets.save(createAsset({ id: "asset:source", kind: "json" }));
    await exportVersions.saveVersion(new AssetVersion({
      assetId: "asset:source",
      versionId: "asset:source:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } },
      },
    }));
    const exported = await new AtomicAssetExportService(exportAssets, exportVersions).export({
      assetId: "asset:source",
      versionId: "asset:source:v1",
    });
    expect(exported.ok).toBeTrue();
    if (!exported.ok) {
      return;
    }
    const unsupported = await service.import({
      artifactContent: exported.artifact.content.replaceAll("ai-loom.exchange-bundle.v1", "ai-loom.exchange-bundle.v9"),
    });
    expect(unsupported.ok).toBeFalse();
    if (!unsupported.ok) {
      expect(unsupported.code).toBe("unsupported-format-version");
    }
  });

  it("records exchange export provenance on bundles", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();
    await assets.save(createAsset({ id: "asset:prov", kind: "json" }));
    await versions.saveVersion(new AssetVersion({
      assetId: "asset:prov",
      versionId: "asset:prov:v1",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      metadata: { metadata: { taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } } },
    }));

    const exported = await new AtomicAssetExportService(assets, versions).export({ assetId: "asset:prov", versionId: "asset:prov:v1" });
    expect(exported.ok).toBeTrue();
    if (exported.ok) {
      expect(exported.artifact.content).toContain("\"exchangeExport\"");
      expect(exported.artifact.content).toContain("\"exportedAssetId\": \"asset:prov\"");
    }
  });

  it("returns structured identity conflict outcomes for imports", async () => {
    const assets = new InMemoryAssetRecordRepository();
    const versions = new InMemoryAssetVersionRepository();
    await assets.save(createAsset({ id: "asset:existing", kind: "json" }));
    await versions.saveVersion(new AssetVersion({ assetId: "asset:existing", versionId: "asset:target:v1" }));

    const exportAssets = new InMemoryAssetRecordRepository();
    const exportVersions = new InMemoryAssetVersionRepository();
    await exportAssets.save(createAsset({ id: "asset:source", kind: "json" }));
    await exportVersions.saveVersion(new AssetVersion({
      assetId: "asset:source",
      versionId: "asset:target:v1",
      metadata: { metadata: { taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } } },
    }));
    const exported = await new AtomicAssetExportService(exportAssets, exportVersions).export({ assetId: "asset:source", versionId: "asset:target:v1" });
    expect(exported.ok).toBeTrue();
    if (!exported.ok) {
      return;
    }

    const imported = await new AtomicAssetImportService(assets, versions).import({ artifactContent: exported.artifact.content });
    expect(imported.ok).toBeFalse();
    if (!imported.ok) {
      expect(imported.code).toBe("conflict");
      expect(JSON.stringify(imported.details)).toContain("\"kind\":\"identity\"");
    }
  });

  it("remaps composite dependency versions when bounded candidates exist and records provenance", async () => {
    const exportAssets = new InMemoryAssetRecordRepository();
    const exportVersions = new InMemoryAssetVersionRepository();
    await exportAssets.save(createAsset({ id: "workflow-definition:wf-remap", kind: "workflow-definition" }));
    await exportVersions.saveVersion(new AssetVersion({
      assetId: "workflow-definition:wf-remap",
      versionId: "workflow-definition:wf-remap:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" } },
        dependencies: [{ assetId: "asset:model", versionId: "asset:model:v1", relation: "dependency" }],
        composition: [{ alias: "model", assetId: "asset:model", versionId: "asset:model:v1", relation: "component" }],
      },
    }));

    const exported = await new CompositeAssetExportService(exportAssets, exportVersions).export({
      assetId: "workflow-definition:wf-remap",
      versionId: "workflow-definition:wf-remap:v1",
    });
    expect(exported.ok).toBeTrue();
    if (!exported.ok) {
      return;
    }

    const importAssets = new InMemoryAssetRecordRepository();
    const importVersions = new InMemoryAssetVersionRepository();
    await importAssets.save(createAsset({ id: "asset:model", kind: "json" }));
    await importVersions.saveVersion(new AssetVersion({ assetId: "asset:model", versionId: "asset:model:v3" }));

    const imported = await new CompositeAssetImportService(importAssets, importVersions).import({ artifactContent: exported.artifact.content });
    expect(imported.ok).toBeTrue();
    if (!imported.ok) {
      return;
    }
    const stored = await importVersions.getByVersionId("workflow-definition:wf-remap:v1");
    const metadataText = JSON.stringify(stored?.metadata);
    expect(metadataText).toContain("\"decision\":\"remap-reference\"");
    expect(metadataText).toContain("\"asset:model:v1\":\"asset:model:v3\"");
    expect(metadataText).toContain("\"exchangeProvenance\"");
  });
});
