import { describe, expect, it } from "bun:test";
import { createPublishablePackage } from "@domain/exchange/PublishablePackage";
import {
  InMemoryLocalExchangeCatalogEntryStore,
  LocalExchangeCatalog,
} from "../ExchangeCatalogServices";
import { ExchangeAccessEvaluator, RoleBasedExchangeAccessPolicy } from "../ExchangeAccessControl";

function makePackage(input: {
  readonly packageId: string;
  readonly kind: "atomic-asset" | "composite-asset" | "system-asset";
  readonly assetId: string;
  readonly versionId: string;
  readonly bundleId: string;
  readonly tags?: ReadonlyArray<string>;
  readonly capabilityHints?: ReadonlyArray<string>;
  readonly packageHint?: string;
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
    metadata: {
      label: input.packageId,
      tags: input.tags,
      capabilityHints: input.capabilityHints,
      packageHint: input.packageHint,
    },
    readiness: { isReady: true, validationIssueCount: 0 },
    status: "ready",
  });
}

describe("LocalExchangeCatalog", () => {
  it("registers/lists/details atomic/composite/system package entries deterministically", async () => {
    const catalog = new LocalExchangeCatalog(new InMemoryLocalExchangeCatalogEntryStore());

    const atomic = await catalog.registerPackage({
      catalogId: "catalog:local:default",
      package: makePackage({
        packageId: "package:atomic:model:v1",
        kind: "atomic-asset",
        assetId: "asset:model",
        versionId: "asset:model:v1",
        bundleId: "exchange:atomic:asset:model:asset:model:v1",
        tags: ["atomic", "model"],
        capabilityHints: ["cpu"],
      }),
      storageReference: {
        storageKind: "local-file",
        location: "/local/exchange/package-atomic-model-v1.json",
      },
    });

    const composite = await catalog.registerPackage({
      catalogId: "catalog:local:default",
      package: makePackage({
        packageId: "package:composite:wf:v2",
        kind: "composite-asset",
        assetId: "workflow:wf-1",
        versionId: "workflow:wf-1:v2",
        bundleId: "exchange:composite:workflow:wf-1:workflow:wf-1:v2",
        tags: ["composite", "workflow"],
        capabilityHints: ["tooling"],
      }),
      storageReference: {
        storageKind: "local-file",
        location: "/local/exchange/package-composite-wf-v2.json",
      },
    });

    const system = await catalog.registerPackage({
      catalogId: "catalog:local:default",
      package: makePackage({
        packageId: "package:system:root:v3",
        kind: "system-asset",
        assetId: "system:root",
        versionId: "system:root:v3",
        bundleId: "exchange:system:system:root:system:root:v3",
        tags: ["system", "system-of-systems"],
        capabilityHints: ["gpu", "network-lan"],
        packageHint: "system-of-systems",
      }),
      storageReference: {
        storageKind: "local-file",
        location: "/local/exchange/package-system-root-v3.json",
      },
    });

    expect(atomic.ok).toBeTrue();
    expect(composite.ok).toBeTrue();
    expect(system.ok).toBeTrue();

    const list = await catalog.listCatalogEntries({ catalogId: "catalog:local:default" });
    expect(list.length).toBe(3);
    expect(list.map((entry) => entry.metadata.sourceRootKind)).toEqual([
      "atomic-asset",
      "composite-asset",
      "system-asset",
    ]);

    const detail = await catalog.getCatalogEntry("catalog:local:default", "package:system:root:v3");
    expect(detail?.metadata.sourceRootAssetId).toBe("system:root");
    expect(detail?.metadata.capabilityHints).toContain("network-lan");

    const artifact = await catalog.resolveCatalogArtifactReference("catalog:local:default", "package:system:root:v3");
    expect(artifact?.location).toBe("/local/exchange/package-system-root-v3.json");
  });

  it("supports deterministic bounded query/list filtering and access hooks", async () => {
    const evaluator = new ExchangeAccessEvaluator(new RoleBasedExchangeAccessPolicy());
    const catalog = new LocalExchangeCatalog(new InMemoryLocalExchangeCatalogEntryStore(), evaluator);

    const denied = await catalog.registerPackage({
      catalogId: "catalog:local:secure",
      package: makePackage({
        packageId: "package:secure:v1",
        kind: "atomic-asset",
        assetId: "asset:secure",
        versionId: "asset:secure:v1",
        bundleId: "exchange:atomic:asset:secure:asset:secure:v1",
        tags: ["secure", "atomic"],
      }),
      storageReference: {
        storageKind: "local-file",
        location: "/local/exchange/package-secure-v1.json",
      },
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "reader-1", roles: ["exchange-exporter"] },
      },
      resourceTenantId: "tenant-a",
    });

    expect(denied.ok).toBeFalse();
    if (!denied.ok) {
      expect(denied.code).toBe("forbidden");
    }

    const allowed = await catalog.registerPackage({
      catalogId: "catalog:local:secure",
      package: makePackage({
        packageId: "package:secure:v1",
        kind: "atomic-asset",
        assetId: "asset:secure",
        versionId: "asset:secure:v1",
        bundleId: "exchange:atomic:asset:secure:asset:secure:v1",
        tags: ["secure", "atomic"],
      }),
      storageReference: {
        storageKind: "local-file",
        location: "/local/exchange/package-secure-v1.json",
      },
      context: {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "publisher-1", roles: ["exchange-publisher"] },
      },
      resourceTenantId: "tenant-a",
    });

    expect(allowed.ok).toBeTrue();

    const filtered = await catalog.listCatalogEntries(
      { catalogId: "catalog:local:secure", query: "secure", tags: ["atomic"] },
      {
        tenantId: "tenant-a",
        caller: { callerKind: "user", callerId: "publisher-1", roles: ["exchange-publisher"] },
      },
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.packageId.value).toBe("package:secure:v1");
  });
});

