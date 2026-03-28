import { describe, expect, it } from "bun:test";
import { createPublishablePackage } from "../PublishablePackage";
import { ExchangeCatalogId, createExchangeCatalogEntry } from "../ExchangeCatalog";

describe("ExchangeCatalog domain", () => {
  it("creates bounded catalog entries with package/source/provenance linkage", () => {
    const publishable = createPublishablePackage({
      packageId: "package:system:root:v1",
      source: {
        bundleId: "exchange:system:system:root:system:root:v1",
        rootSubject: { kind: "system-asset", assetId: "system:root", versionId: "system:root:v1" },
      },
      metadata: {
        label: "Root System",
        summary: "Portable system-of-systems package",
        tags: ["system", "portable"],
        capabilityHints: ["gpu", "lan"],
        configurationHints: { childSystems: 2 },
      },
      readiness: { isReady: true, validationIssueCount: 0 },
      status: "ready",
      provenance: {
        origin: "imported",
        sourceBundleProvenance: {
          originType: "exchange-import",
          sourceBundleId: "exchange:source:bundle",
          sourceVersionLineage: ["system:root:v0"],
        },
      },
    });

    const entry = createExchangeCatalogEntry({
      catalogId: "catalog:local:default",
      package: publishable,
      storageReference: {
        storageKind: "local-file",
        location: "/tmp/exchange/system-root-v1.exchange.json",
        mediaType: "application/json",
      },
    });

    expect(entry.catalogId.value).toBe("catalog:local:default");
    expect(entry.packageId.value).toBe("package:system:root:v1");
    expect(entry.metadata.sourceBundleId).toBe("exchange:system:system:root:system:root:v1");
    expect(entry.metadata.sourceRootKind).toBe("system-asset");
    expect(entry.metadata.sourceProvenance?.origin).toBe("imported");
    expect(entry.storageReference.storageKind).toBe("local-file");
  });

  it("normalizes catalog identity and blocks empty identifiers", () => {
    expect(() => ExchangeCatalogId.from("   ")).toThrow("cannot be empty");
  });
});
