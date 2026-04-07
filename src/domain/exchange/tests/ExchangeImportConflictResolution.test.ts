import { describe, expect, it } from "bun:test";
import { ExchangeImportConflictResolver } from "../ExchangeImportConflictResolution";

describe("ExchangeImportConflictResolver", () => {
  it("reuses exact existing versions deterministically", () => {
    const resolver = new ExchangeImportConflictResolver();
    const result = resolver.resolve({
      subjectKind: "atomic-asset",
      bundleId: "exchange:atomic:asset:a:asset:a:v1",
      incomingAssetId: "asset:a",
      incomingVersionId: "asset:a:v1",
      hasExistingAsset: true,
      hasExistingVersion: true,
      existingAssetIdForVersion: "asset:a",
    });

    expect(result.decision).toBe("reuse-existing");
    expect(result.conflicts[0]?.kind).toBe("version");
  });

  it("rejects identity conflicts when version id belongs to another asset", () => {
    const resolver = new ExchangeImportConflictResolver();
    const result = resolver.resolve({
      subjectKind: "composite-asset",
      bundleId: "exchange:composite:asset:b:asset:b:v2",
      incomingAssetId: "asset:b",
      incomingVersionId: "asset:b:v2",
      hasExistingAsset: true,
      hasExistingVersion: true,
      existingAssetIdForVersion: "asset:other",
    });

    expect(result.decision).toBe("reject-import");
    expect(result.conflicts[0]?.kind).toBe("identity");
  });

  it("remaps missing dependencies when bounded candidates exist", () => {
    const resolver = new ExchangeImportConflictResolver();
    const result = resolver.resolve({
      subjectKind: "system-asset",
      bundleId: "exchange:system:sys:root:sys:root:v1",
      incomingAssetId: "sys:root",
      incomingVersionId: "sys:root:v1",
      hasExistingAsset: false,
      hasExistingVersion: false,
      dependencyVersionExists: { "asset:model:v1": false },
      dependencyVersionRemapCandidates: { "asset:model:v1": "asset:model:v3" },
    });

    expect(result.decision).toBe("remap-reference");
    expect(result.remappedDependencyVersionIds["asset:model:v1"]).toBe("asset:model:v3");
  });
});
