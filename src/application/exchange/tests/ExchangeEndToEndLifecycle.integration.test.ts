import { describe, expect, it } from "bun:test";
import { Asset } from "../../../domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSemanticMetadata, AssetSourceInfo, AssetTechnicalMetadata } from "../../../domain/assets/AssetMetadata";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { ExchangeBundleDeserializer, ExchangeBundleSerializer } from "../../../domain/exchange/ExchangeBundleSerialization";
import type { PublishablePackage } from "../../../domain/exchange/PublishablePackage";
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
import { LocalExchangeCatalog, InMemoryLocalExchangeCatalogEntryStore } from "../ExchangeCatalogServices";
import { ExchangePublishWorkflow, InMemoryPublishedPackageRecordRepository } from "../ExchangePublishWorkflow";
import { PublishablePackageService, type IPublishablePackageRepository } from "../PublishablePackageService";

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

class InMemoryPublishablePackageRepository implements IPublishablePackageRepository {
  private readonly records = new Map<string, PublishablePackage>();
  public async save(entry: PublishablePackage): Promise<void> { this.records.set(entry.packageId.value, entry); }
  public async getById(packageId: string): Promise<PublishablePackage | undefined> { return this.records.get(packageId); }
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

describe("Exchange end-to-end lifecycle integration", () => {
  it("runs atomic export -> validate/deserialize -> publish/catalog -> import with provenance and lineage continuity", async () => {
    const exportAssets = new InMemoryAssetRecordRepository();
    const exportVersions = new InMemoryAssetVersionRepository();
    await exportAssets.save(createAsset({ id: "asset:tokenizer" }));
    await exportAssets.save(createAsset({ id: "installed-model:model-e2e" }));
    await exportVersions.saveVersion(new AssetVersion({ assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1" }));
    await exportVersions.saveVersion(new AssetVersion({
      assetId: "installed-model:model-e2e",
      versionId: "installed-model:model-e2e:v3",
      metadata: {
        metadata: {
          title: "Model E2E",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        dependencies: [{ assetId: "asset:tokenizer", versionId: "asset:tokenizer:v1", relation: "dependency" }],
      },
    }));

    const exporter = new AtomicAssetExportService(exportAssets, exportVersions);
    const exported = await exporter.export({
      assetId: "installed-model:model-e2e",
      versionId: "installed-model:model-e2e:v3",
      accessContext: { caller: { callerKind: "user", callerId: "exp-1", roles: ["exchange-exporter"] } },
    });
    expect(exported.ok).toBeTrue();
    if (!exported.ok) return;

    const deserializer = new ExchangeBundleDeserializer();
    const parsed = deserializer.deserialize({ content: exported.artifact.content });
    expect(parsed.ok).toBeTrue();
    if (!parsed.ok) return;

    const serializer = new ExchangeBundleSerializer();
    const reserialized = serializer.serialize(parsed.deserialized);
    expect(reserialized.ok).toBeTrue();
    if (reserialized.ok) {
      expect(reserialized.artifact.content).toBe(exported.artifact.content);
    }

    const packages = new InMemoryPublishablePackageRepository();
    const packageService = new PublishablePackageService(packages);
    const packageResult = await packageService.createFromBundle({
      packageId: "package:atomic:model-e2e:v3",
      bundle: parsed.deserialized.bundle,
      context: { caller: { callerKind: "user", callerId: "publisher-1", roles: ["exchange-publisher"] } },
      readiness: { isReady: true, validationIssueCount: 0 },
      status: "ready",
    });
    expect(packageResult.ok).toBeTrue();
    if (!packageResult.ok) return;

    const catalog = new LocalExchangeCatalog(new InMemoryLocalExchangeCatalogEntryStore());
    const publishedRecords = new InMemoryPublishedPackageRecordRepository();
    const publishWorkflow = new ExchangePublishWorkflow(packages, catalog, publishedRecords);
    const published = await publishWorkflow.publish({
      catalogId: "catalog:local:e2e",
      packageId: packageResult.package.packageId.value,
      artifact: exported.artifact,
      context: { caller: { callerKind: "user", callerId: "publisher-1", roles: ["exchange-publisher"] } },
    });
    expect(published.ok).toBeTrue();
    if (!published.ok) return;

    const listed = await catalog.listCatalogEntries({ catalogId: "catalog:local:e2e", packageKinds: ["atomic-asset"] });
    expect(listed.length).toBe(1);
    expect(listed[0]?.metadata.sourceRootVersionId).toBe("installed-model:model-e2e:v3");

    const importAssets = new InMemoryAssetRecordRepository();
    const importVersions = new InMemoryAssetVersionRepository();
    const importer = new AtomicAssetImportService(importAssets, importVersions, undefined, undefined, undefined, () => new Date("2026-03-28T03:00:00.000Z"));
    const imported = await importer.import({
      artifactContent: exported.artifact.content,
      accessContext: { caller: { callerKind: "user", callerId: "imp-1", roles: ["exchange-importer"] } },
    });

    expect(imported.ok).toBeTrue();
    if (!imported.ok) return;
    expect(imported.imported.sourceVersionLineage).toEqual([]);

    const storedVersion = await importVersions.getByVersionId("installed-model:model-e2e:v3");
    const metadata = storedVersion?.metadata as { readonly exchangeImport?: { readonly bundleId?: string }; readonly exchangeProvenance?: { readonly lineageEdges?: ReadonlyArray<unknown> } };
    expect(metadata.exchangeImport?.bundleId).toBe(exported.bundleId);
    expect(metadata.exchangeProvenance?.lineageEdges?.length).toBe(1);
  });

  it("runs composite + system exchange lifecycles including bounded system-of-systems composition continuity", async () => {
    const exportAssets = new InMemoryAssetRecordRepository();
    const exportVersions = new InMemoryAssetVersionRepository();

    await exportAssets.save(createAsset({ id: "workflow-definition:wf-e2e", kind: "workflow-definition" }));
    await exportAssets.save(createAsset({ id: "asset:model-e2e" }));
    await exportAssets.save(createAsset({ id: "dataset-version:data-e2e", kind: "dataset" }));
    await exportAssets.save(createAsset({ id: "system:root-e2e" }));
    await exportAssets.save(createAsset({ id: "system:child-e2e" }));
    await exportVersions.saveVersion(new AssetVersion({ assetId: "asset:model-e2e", versionId: "asset:model-e2e:v1" }));
    await exportVersions.saveVersion(new AssetVersion({ assetId: "dataset-version:data-e2e", versionId: "dataset-version:data-e2e:v1" }));

    await exportVersions.saveVersion(new AssetVersion({
      assetId: "workflow-definition:wf-e2e",
      versionId: "workflow-definition:wf-e2e:v4",
      metadata: {
        metadata: { taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" } },
        composition: [
          { alias: "dataset", assetId: "dataset-version:data-e2e", versionId: "dataset-version:data-e2e:v1", relation: "component", taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" } },
          { alias: "model", assetId: "asset:model-e2e", versionId: "asset:model-e2e:v1", relation: "component", taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } },
        ],
        dependencies: [
          { assetId: "dataset-version:data-e2e", versionId: "dataset-version:data-e2e:v1", relation: "dependency" },
          { assetId: "asset:model-e2e", versionId: "asset:model-e2e:v1", relation: "component" },
        ],
      },
    }));

    await exportVersions.saveVersion(new AssetVersion({
      assetId: "system:child-e2e",
      versionId: "system:child-e2e:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
        content: JSON.stringify({ systemSpec: { components: [{ componentKind: "atomic", alias: "dataset", assetId: "dataset-version:data-e2e", versionId: "dataset-version:data-e2e:v1" }] } }),
      },
    }));

    await exportVersions.saveVersion(new AssetVersion({
      assetId: "system:root-e2e",
      versionId: "system:root-e2e:v2",
      metadata: {
        metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "conditional" } },
        content: JSON.stringify({
          systemSpec: {
            components: [{ componentKind: "composite", alias: "workflow", assetId: "workflow-definition:wf-e2e", versionId: "workflow-definition:wf-e2e:v4" }],
            nestedSystems: [{ assetId: "system:child-e2e", versionId: "system:child-e2e:v1", alias: "child" }],
          },
        }),
      },
    }));

    const compositeExport = await new CompositeAssetExportService(exportAssets, exportVersions).export({ assetId: "workflow-definition:wf-e2e", versionId: "workflow-definition:wf-e2e:v4" });
    const systemExport = await new SystemAssetExportService(exportAssets, exportVersions).export({ assetId: "system:root-e2e", versionId: "system:root-e2e:v2" });
    expect(compositeExport.ok).toBeTrue();
    expect(systemExport.ok).toBeTrue();
    if (!compositeExport.ok || !systemExport.ok) return;

    const importAssets = new InMemoryAssetRecordRepository();
    const importVersions = new InMemoryAssetVersionRepository();
    const compositeImport = await new CompositeAssetImportService(importAssets, importVersions).import({ artifactContent: compositeExport.artifact.content });
    const systemImport = await new SystemAssetImportService(importAssets, importVersions).import({ artifactContent: systemExport.artifact.content });

    expect(compositeImport.ok).toBeTrue();
    expect(systemImport.ok).toBeTrue();
    if (compositeImport.ok) {
      expect(compositeImport.imported.compositionCount).toBe(2);
      expect(compositeImport.imported.dependencyCount).toBe(2);
    }
    if (systemImport.ok) {
      expect(systemImport.imported.compositionCount).toBeGreaterThanOrEqual(2);
      expect(systemImport.imported.nodeCount).toBeGreaterThanOrEqual(3);
    }

    const storedComposite = await importVersions.getByVersionId("workflow-definition:wf-e2e:v4");
    const storedSystem = await importVersions.getByVersionId("system:root-e2e:v2");
    expect(JSON.stringify(storedComposite?.metadata)).toContain("exchangeImport");
    expect(JSON.stringify(storedSystem?.metadata)).toContain("nestedSystems");
  });

  it("enforces access control and conflict outcomes without invalid publish/catalog side effects", async () => {
    const access = new ExchangeAccessEvaluator(new RoleBasedExchangeAccessPolicy());

    const exportAssets = new InMemoryAssetRecordRepository();
    const exportVersions = new InMemoryAssetVersionRepository();
    await exportAssets.save(createAsset({ id: "asset:deny-me" }));
    await exportVersions.saveVersion(new AssetVersion({
      assetId: "asset:deny-me",
      versionId: "asset:deny-me:v1",
      metadata: { metadata: { taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } } },
    }));
    const exported = await new AtomicAssetExportService(exportAssets, exportVersions).export({ assetId: "asset:deny-me", versionId: "asset:deny-me:v1" });
    expect(exported.ok).toBeTrue();
    if (!exported.ok) return;

    const packageRepo = new InMemoryPublishablePackageRepository();
    const packageService = new PublishablePackageService(packageRepo, access);
    const parsed = new ExchangeBundleDeserializer().deserialize({ content: exported.artifact.content });
    expect(parsed.ok).toBeTrue();
    if (!parsed.ok) return;

    const created = await packageService.createFromBundle({
      packageId: "package:deny-me:v1",
      bundle: parsed.deserialized.bundle,
      context: { tenantId: "tenant-a", caller: { callerKind: "user", callerId: "publisher", roles: ["exchange-publisher"] } },
      readiness: { isReady: true, validationIssueCount: 0 },
      status: "ready",
    });
    expect(created.ok).toBeTrue();
    if (!created.ok) return;

    const catalog = new LocalExchangeCatalog(new InMemoryLocalExchangeCatalogEntryStore(), access);
    const workflow = new ExchangePublishWorkflow(packageRepo, catalog, new InMemoryPublishedPackageRecordRepository(), access);
    const denied = await workflow.publish({
      catalogId: "catalog:local:secure",
      packageId: created.package.packageId.value,
      artifact: exported.artifact,
      context: { tenantId: "tenant-a", caller: { callerKind: "user", callerId: "importer", roles: ["exchange-importer"] } },
      resourceTenantId: "tenant-a",
    });
    expect(denied.ok).toBeFalse();
    if (!denied.ok) {
      expect(denied.failure.code).toBe("forbidden");
    }
    const afterDenied = await catalog.listCatalogEntries({ catalogId: "catalog:local:secure" }, { tenantId: "tenant-a", caller: { callerKind: "user", callerId: "publisher", roles: ["exchange-publisher"] } });
    expect(afterDenied.length).toBe(0);

    const conflictAssets = new InMemoryAssetRecordRepository();
    const conflictVersions = new InMemoryAssetVersionRepository();
    await conflictAssets.save(createAsset({ id: "asset:existing" }));
    await conflictVersions.saveVersion(new AssetVersion({ assetId: "asset:existing", versionId: "asset:deny-me:v1" }));
    const conflict = await new AtomicAssetImportService(conflictAssets, conflictVersions).import({ artifactContent: exported.artifact.content });

    expect(conflict.ok).toBeFalse();
    if (!conflict.ok) {
      expect(conflict.code).toBe("conflict");
      expect(JSON.stringify(conflict.details)).toContain("identity");
    }
  });
});
