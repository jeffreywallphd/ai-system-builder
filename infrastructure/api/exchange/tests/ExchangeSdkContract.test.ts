import { describe, expect, it } from "bun:test";
import { createPublishablePackage } from "../../../../src/domain/exchange/PublishablePackage";
import { createExchangeCatalogEntry } from "../../../../src/domain/exchange/ExchangeCatalog";
import {
  toExchangeSdkCatalogEntrySummary,
  toExchangeSdkExportResult,
  toExchangeSdkImportResult,
  toExchangeSdkPublishResult,
} from "../sdk/ExchangeSdkMapper";

describe("PublicExchangeSdkContract mapper", () => {
  it("maps successful export/import outcomes into stable public DTOs", () => {
    const exportResult = toExchangeSdkExportResult({
      ok: true,
      subjectKind: "composite-asset",
      assetId: "workflow:wf-1",
      versionId: "workflow:wf-1:v2",
      bundleId: "exchange:composite:workflow:wf-1:workflow:wf-1:v2",
      compositionCount: 3,
      artifact: {
        fileName: "wf.json",
        mediaType: "application/vnd.ai-loom.exchange-bundle+json",
        byteLength: 128,
        sha256: "abc",
        content: "{}",
      },
    });

    const importResult = toExchangeSdkImportResult({
      ok: true,
      subjectKind: "system-asset",
      imported: {
        assetId: "system:root",
        versionId: "system:root:v1",
        bundleId: "exchange:system:system:root:system:root:v1",
        sourceVersionLineage: ["system:root:v0"],
        importedAt: "2026-03-28T00:00:00.000Z",
        existingAsset: false,
        existingVersion: false,
        compositionCount: 2,
        dependencyCount: 4,
        nodeCount: 5,
      },
    });

    expect(exportResult.identity.subjectKind).toBe("composite-asset");
    expect(exportResult.counts?.compositionCount).toBe(3);
    expect(importResult.identity.subjectKind).toBe("system-asset");
    expect(importResult.counts?.nodeCount).toBe(5);
  });

  it("maps publish and catalog metadata with identity boundaries preserved", () => {
    const pkg = createPublishablePackage({
      packageId: "package:system:root:v4",
      source: {
        bundleId: "exchange:system:system:root:system:root:v4",
        rootSubject: {
          kind: "system-asset",
          assetId: "system:root",
          versionId: "system:root:v4",
        },
      },
      readiness: { isReady: true, validationIssueCount: 0 },
      status: "published",
      metadata: {
        label: "System Root",
        tags: ["system", "system-of-systems"],
        capabilityHints: ["network-lan"],
      },
      provenance: {
        origin: "imported",
        sourceBundleProvenance: {
          sourceBundleId: "exchange:source:1",
          sourceVersionLineage: ["system:root:v3"],
        },
      },
    });

    const entry = createExchangeCatalogEntry({
      catalogId: "catalog:local:systems",
      package: pkg,
      storageReference: {
        storageKind: "local-file",
        location: "/local/exchange/systems/root-v4.json",
        mediaType: "application/vnd.ai-loom.exchange-bundle+json",
      },
      registeredAt: "2026-03-28T00:00:00.000Z",
      updatedAt: "2026-03-28T00:00:00.000Z",
    });

    const summary = toExchangeSdkCatalogEntrySummary(entry);
    const publish = toExchangeSdkPublishResult({
      ok: true,
      package: pkg,
      catalogEntry: entry,
      publishedRecord: {
        recordId: "published:catalog:local:systems:package:system:root:v4",
        catalogId: "catalog:local:systems",
        packageId: "package:system:root:v4",
        bundleId: "exchange:system:system:root:system:root:v4",
        sourceAssetId: "system:root",
        sourceVersionId: "system:root:v4",
        sourceKind: "system-asset",
        publishedAt: "2026-03-28T00:00:00.000Z",
        publishedBy: "publisher-1",
        accessPolicyId: "role-based-exchange-access-v1",
        artifact: {
          mediaType: "application/vnd.ai-loom.exchange-bundle+json",
          location: "/local/exchange/systems/root-v4.json",
          byteLength: 256,
          sha256: "def",
        },
      },
      decision: {
        allowed: true,
        policyId: "role-based-exchange-access-v1",
      },
    });

    expect(summary.identity.assetId).toBe("system:root");
    expect(summary.identity.bundleId).toBe("exchange:system:system:root:system:root:v4");
    expect(summary.identity.packageId).toBe("package:system:root:v4");

    expect(publish.identity.catalogEntryId).toBe("catalog:local:systems:package:system:root:v4");
    expect(publish.metadata.provenance?.sourceBundleId).toBe("exchange:source:1");
    expect(publish.catalog.artifact.location).toBe("/local/exchange/systems/root-v4.json");
  });
});
