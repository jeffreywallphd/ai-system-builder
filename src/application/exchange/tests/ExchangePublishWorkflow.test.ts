import { describe, expect, it } from "bun:test";
import { createAtomicAssetPackageManifest, createCompositeAssetPackageManifest } from "@domain/exchange/AssetPackageManifest";
import { BundleDependencySnapshotBuilder } from "@domain/exchange/BundleDependencySnapshot";
import { createExchangeBundle } from "@domain/exchange/ExchangeBundleDomain";
import { ExchangeBundleSerializer } from "@domain/exchange/ExchangeBundleSerialization";
import { createPublishablePackage } from "@domain/exchange/PublishablePackage";
import { ExchangeAccessEvaluator, RoleBasedExchangeAccessPolicy } from "../ExchangeAccessControl";
import { LocalExchangeCatalog, InMemoryLocalExchangeCatalogEntryStore } from "../ExchangeCatalogServices";
import {
  ExchangePublishWorkflow,
  InMemoryPublishedPackageRecordRepository,
  type PublishedPackageRecord,
} from "../ExchangePublishWorkflow";
import type { IPublishablePackageRepository } from "../PublishablePackageService";
import type { PublishablePackage } from "@domain/exchange/PublishablePackage";

class InMemoryPublishablePackageRepository implements IPublishablePackageRepository {
  private readonly records = new Map<string, PublishablePackage>();

  public async save(entry: PublishablePackage): Promise<void> {
    this.records.set(entry.packageId.value, entry);
  }

  public async getById(packageId: string): Promise<PublishablePackage | undefined> {
    return this.records.get(packageId);
  }
}

class FailingCatalog extends LocalExchangeCatalog {
  public override async saveEntry(): Promise<void> {
    throw new Error("disk write failed");
  }
}

function buildSerializedBundle(input: {
  kind: "atomic-asset" | "composite-asset" | "system-asset";
  assetId: string;
  versionId: string;
  bundleId: string;
}) {
  const bundle = createExchangeBundle({
    bundleId: input.bundleId,
    subject: {
      root: {
        kind: input.kind,
        relation: "root",
        assetId: input.assetId,
        versionId: input.versionId,
      },
      references: [],
    },
    metadata: {
      createdAt: "2026-03-28T00:00:00.000Z",
      tags: [input.kind],
    },
  });

  if (input.kind === "system-asset") {
    const content = JSON.stringify({
      artifactVersion: "ai-loom.serialized-exchange-bundle.v1",
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
      bundle: {
        bundleId: input.bundleId,
        formatVersion: "ai-loom.exchange-bundle.v1",
        subject: bundle.subject,
        metadata: bundle.metadata,
        dependencySnapshot: [],
        scope: {
          excludesRuntimeState: true,
          excludesDeploymentState: true,
        },
      },
      manifest: {
        manifestVersion: "ai-loom.system-package-manifest.v1",
        bundleFormatVersion: "ai-loom.exchange-bundle.v1",
        subject: {
          assetId: input.assetId,
          versionId: input.versionId,
          taxonomy: {
            structuralKind: "system",
            semanticRole: "system",
            behaviorKind: "deterministic",
          },
        },
        metadata: {
          createdAt: "2026-03-28T00:00:00.000Z",
          tags: ["system"],
        },
        nodes: [],
        edges: [],
        composition: [],
        scope: {
          excludesRuntimeState: true,
          excludesDeploymentState: true,
        },
      },
      dependencySnapshot: {
        snapshotVersion: "ai-loom.bundle-dependency-snapshot.v1",
        bundleFormatVersion: "ai-loom.exchange-bundle.v1",
        rootSubject: {
          kind: "system-asset",
          assetId: input.assetId,
          versionId: input.versionId,
        },
        entries: [],
        scope: {
          excludesRuntimeResolutionState: true,
          excludesDeploymentResolutionState: true,
        },
      },
    }, null, 2);

    const byteLength = new TextEncoder().encode(content).byteLength;
    return {
      mediaType: "application/vnd.ai-loom.exchange-bundle+json" as const,
      encoding: "utf-8" as const,
      content,
      byteLength,
      fileName: `exchange-bundle-${input.bundleId.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`,
    };
  }

  const manifest = input.kind === "atomic-asset"
    ? createAtomicAssetPackageManifest({
      subject: {
        kind: "atomic-asset",
        assetId: input.assetId,
        versionId: input.versionId,
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "model",
          behaviorKind: "none",
        },
      },
      metadata: {
        createdAt: "2026-03-28T00:00:00.000Z",
      },
    })
    : createCompositeAssetPackageManifest({
      subject: {
        kind: "composite-asset",
        assetId: input.assetId,
        versionId: input.versionId,
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
      },
      composition: [],
      metadata: {
        createdAt: "2026-03-28T00:00:00.000Z",
      },
    });

  const dependencySnapshot = BundleDependencySnapshotBuilder.fromAssetPackageManifest(manifest);
  const serializer = new ExchangeBundleSerializer();
  const serialized = serializer.serialize({ bundle, manifest, dependencySnapshot });
  if (!serialized.ok) {
    throw new Error("Expected bundle serialization to succeed.");
  }
  return serialized.artifact;
}

function makePackage(input: {
  packageId: string;
  kind: "atomic-asset" | "composite-asset" | "system-asset";
  assetId: string;
  versionId: string;
  bundleId: string;
  status?: "draft" | "ready";
}) {
  return createPublishablePackage({
    packageId: input.packageId,
    source: {
      bundleId: input.bundleId,
      rootSubject: {
        kind: input.kind,
        assetId: input.assetId,
        versionId: input.versionId,
      },
    },
    readiness: {
      isReady: input.status !== "draft",
      validationIssueCount: input.status === "draft" ? 1 : 0,
      reasonCodes: input.status === "draft" ? ["validation-failed"] : [],
    },
    status: input.status ?? "ready",
    metadata: {
      label: input.packageId,
      capabilityHints: input.kind === "system-asset" ? ["system-of-systems"] : ["portable"],
      tags: [input.kind],
    },
  });
}

describe("ExchangePublishWorkflow", () => {
  it("publishes ready atomic/composite/system packages through one authoritative workflow", async () => {
    const packages = new InMemoryPublishablePackageRepository();
    const catalog = new LocalExchangeCatalog(new InMemoryLocalExchangeCatalogEntryStore());
    const records = new InMemoryPublishedPackageRecordRepository();
    const workflow = new ExchangePublishWorkflow(packages, catalog, records);

    const publishables = [
      makePackage({
        packageId: "package:atomic:model:v1",
        kind: "atomic-asset",
        assetId: "asset:model",
        versionId: "asset:model:v1",
        bundleId: "exchange:atomic:asset:model:asset:model:v1",
      }),
      makePackage({
        packageId: "package:composite:wf:v2",
        kind: "composite-asset",
        assetId: "workflow:wf-1",
        versionId: "workflow:wf-1:v2",
        bundleId: "exchange:composite:workflow:wf-1:workflow:wf-1:v2",
      }),
      makePackage({
        packageId: "package:system:root:v3",
        kind: "system-asset",
        assetId: "system:root",
        versionId: "system:root:v3",
        bundleId: "exchange:system:system:root:system:root:v3",
      }),
    ];
    for (const entry of publishables) {
      await packages.save(entry);
    }

    for (const entry of publishables) {
      const result = await workflow.publish({
        catalogId: "catalog:local:default",
        packageId: entry.packageId.value,
        artifact: buildSerializedBundle({
          kind: entry.source.rootSubject.kind,
          assetId: entry.source.rootSubject.assetId,
          versionId: entry.source.rootSubject.versionId,
          bundleId: entry.source.bundleId.value,
        }),
        context: {
          caller: {
            callerKind: "user",
            callerId: "publisher-1",
            roles: ["exchange-publisher"],
          },
        },
      });

      expect(result.ok).toBeTrue();
      if (result.ok) {
        expect(result.package.status).toBe("published");
        expect(result.catalogEntry.metadata.sourceBundleId).toBe(entry.source.bundleId.value);
        expect(result.publishedRecord.sourceVersionId).toBe(entry.source.rootSubject.versionId);
      }
    }

    const list = await catalog.listCatalogEntries({ catalogId: "catalog:local:default" });
    expect(list.map((entry) => entry.packageId.value)).toEqual([
      "package:atomic:model:v1",
      "package:composite:wf:v2",
      "package:system:root:v3",
    ]);
  });

  it("rejects unauthorized publish attempts with structured failure", async () => {
    const packages = new InMemoryPublishablePackageRepository();
    const catalog = new LocalExchangeCatalog(new InMemoryLocalExchangeCatalogEntryStore(), new ExchangeAccessEvaluator(new RoleBasedExchangeAccessPolicy()));
    const records = new InMemoryPublishedPackageRecordRepository();
    const access = new ExchangeAccessEvaluator(new RoleBasedExchangeAccessPolicy());
    const workflow = new ExchangePublishWorkflow(packages, catalog, records, access);

    const readyPackage = makePackage({
      packageId: "package:secure:v1",
      kind: "atomic-asset",
      assetId: "asset:secure",
      versionId: "asset:secure:v1",
      bundleId: "exchange:atomic:asset:secure:asset:secure:v1",
    });
    await packages.save(readyPackage);

    const denied = await workflow.publish({
      catalogId: "catalog:local:secure",
      packageId: readyPackage.packageId.value,
      artifact: buildSerializedBundle({
        kind: "atomic-asset",
        assetId: "asset:secure",
        versionId: "asset:secure:v1",
        bundleId: "exchange:atomic:asset:secure:asset:secure:v1",
      }),
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "reader-1", roles: ["exchange-importer"] },
      },
      resourceTenantId: "tenant-a",
    });

    expect(denied.ok).toBeFalse();
    if (!denied.ok) {
      expect(denied.failure.code).toBe("forbidden");
      expect(denied.decision.allowed).toBeFalse();
    }
  });

  it("enforces publish readiness and does not treat raw export artifact as published state", async () => {
    const packages = new InMemoryPublishablePackageRepository();
    const catalog = new LocalExchangeCatalog(new InMemoryLocalExchangeCatalogEntryStore());
    const records = new InMemoryPublishedPackageRecordRepository();
    const workflow = new ExchangePublishWorkflow(packages, catalog, records);

    const draftPackage = makePackage({
      packageId: "package:draft:v1",
      kind: "atomic-asset",
      assetId: "asset:draft",
      versionId: "asset:draft:v1",
      bundleId: "exchange:atomic:asset:draft:asset:draft:v1",
      status: "draft",
    });
    await packages.save(draftPackage);

    const artifact = buildSerializedBundle({
      kind: "atomic-asset",
      assetId: "asset:draft",
      versionId: "asset:draft:v1",
      bundleId: "exchange:atomic:asset:draft:asset:draft:v1",
    });

    const result = await workflow.publish({
      catalogId: "catalog:local:default",
      packageId: draftPackage.packageId.value,
      artifact,
      context: {
        caller: { callerKind: "user", callerId: "publisher-1", roles: ["exchange-publisher"] },
      },
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.failure.code).toBe("package-not-ready");
    }

    const list = await catalog.listCatalogEntries({ catalogId: "catalog:local:default" });
    expect(list.length).toBe(0);

    const saved = await packages.getById("package:draft:v1");
    expect(saved?.status).toBe("draft");
  });

  it("publishes system-of-systems package linkage with bounded provenance record", async () => {
    const packages = new InMemoryPublishablePackageRepository();
    const catalog = new LocalExchangeCatalog(new InMemoryLocalExchangeCatalogEntryStore());
    const records = new InMemoryPublishedPackageRecordRepository();
    const workflow = new ExchangePublishWorkflow(packages, catalog, records);

    const systemPackage = createPublishablePackage({
      packageId: "package:system:sos:v9",
      source: {
        bundleId: "exchange:system:system:root:system:root:v9",
        rootSubject: {
          kind: "system-asset",
          assetId: "system:root",
          versionId: "system:root:v9",
        },
      },
      readiness: { isReady: true, validationIssueCount: 0 },
      status: "ready",
      metadata: {
        tags: ["system-of-systems"],
        capabilityHints: ["network-lan", "distributed-ready"],
      },
      provenance: {
        origin: "automation",
        metadata: { topology: "sos" },
      },
    });
    await packages.save(systemPackage);

    const published = await workflow.publish({
      catalogId: "catalog:local:systems",
      packageId: systemPackage.packageId.value,
      artifact: buildSerializedBundle({
        kind: "system-asset",
        assetId: "system:root",
        versionId: "system:root:v9",
        bundleId: "exchange:system:system:root:system:root:v9",
      }),
      context: {
        source: "exchange-api",
        caller: { callerKind: "service", callerId: "publisher-bot", roles: ["exchange-publisher"] },
      },
    });

    expect(published.ok).toBeTrue();
    if (published.ok) {
      const storedRecord = await records.getByPackageId("catalog:local:systems", "package:system:sos:v9") as PublishedPackageRecord;
      expect(storedRecord.sourceKind).toBe("system-asset");
      expect(storedRecord.provenance?.packageOrigin).toBe("automation");
      expect(storedRecord.publishedBy).toBe("publisher-bot");
    }
  });

  it("returns a structured write failure when catalog persistence fails", async () => {
    const packages = new InMemoryPublishablePackageRepository();
    const catalog = new FailingCatalog(new InMemoryLocalExchangeCatalogEntryStore());
    const records = new InMemoryPublishedPackageRecordRepository();
    const workflow = new ExchangePublishWorkflow(packages, catalog, records);

    const readyPackage = makePackage({
      packageId: "package:catalog-failure:v1",
      kind: "atomic-asset",
      assetId: "asset:catalog-failure",
      versionId: "asset:catalog-failure:v1",
      bundleId: "exchange:atomic:asset:catalog-failure:asset:catalog-failure:v1",
    });
    await packages.save(readyPackage);

    const result = await workflow.publish({
      catalogId: "catalog:local:broken",
      packageId: readyPackage.packageId.value,
      artifact: buildSerializedBundle({
        kind: "atomic-asset",
        assetId: "asset:catalog-failure",
        versionId: "asset:catalog-failure:v1",
        bundleId: "exchange:atomic:asset:catalog-failure:asset:catalog-failure:v1",
      }),
      context: {
        caller: { callerKind: "user", callerId: "publisher-1", roles: ["exchange-publisher"] },
      },
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.failure.code).toBe("catalog-write-failed");
      expect(result.failure.message).toContain("disk write failed");
    }
  });
});

