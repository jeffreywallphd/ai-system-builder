import { describe, expect, it } from "bun:test";
import {
  PublishablePackageStatuses,
  createPublishablePackage,
  withPublishablePackageStatus,
} from "../PublishablePackage";

describe("PublishablePackage", () => {
  it("represents atomic/composite/system subject roots with explicit package identity and source linkage", () => {
    const atomic = createPublishablePackage({
      packageId: "package:atomic:v1",
      source: {
        bundleId: "exchange:atomic:asset:model:asset:model:v1",
        rootSubject: { kind: "atomic-asset", assetId: "asset:model", versionId: "asset:model:v1" },
      },
      readiness: { isReady: true, checkedAt: "2026-03-28T00:00:00.000Z", validationIssueCount: 0 },
      status: "ready",
    });

    const composite = createPublishablePackage({
      packageId: "package:composite:v1",
      source: {
        bundleId: "exchange:composite:workflow:wf-1:workflow:wf-1:v1",
        rootSubject: { kind: "composite-asset", assetId: "workflow:wf-1", versionId: "workflow:wf-1:v1" },
      },
      readiness: { isReady: false, reasonCodes: ["curation-pending"] },
    });

    const system = createPublishablePackage({
      packageId: "package:system:v1",
      source: {
        bundleId: "exchange:system:system:root:system:root:v5",
        rootSubject: { kind: "system-asset", assetId: "system:root", versionId: "system:root:v5" },
      },
      metadata: {
        packageHint: "system-of-systems",
        capabilityHints: ["gpu", "network-lan"],
        configurationHints: { nestedSystemCount: 2 },
      },
      readiness: { isReady: true, validationIssueCount: 0 },
      status: "published",
    });

    expect(atomic.packageId.value).toBe("package:atomic:v1");
    expect(atomic.source.bundleId.value).toBe("exchange:atomic:asset:model:asset:model:v1");
    expect(atomic.source.rootSubject.versionId).toBe("asset:model:v1");

    expect(composite.packageId.value).toBe("package:composite:v1");
    expect(composite.status).toBe("draft");
    expect(composite.readiness.isReady).toBeFalse();

    expect(system.source.rootSubject.kind).toBe("system-asset");
    expect(system.metadata.packageHint).toBe("system-of-systems");
    expect(system.metadata.capabilityHints).toContain("network-lan");
    expect(system.scope.excludesRuntimeState).toBeTrue();
    expect(system.scope.excludesDeploymentState).toBeTrue();
  });

  it("keeps status/readiness deterministic and blocks invalid ready/published transitions", () => {
    expect(() => createPublishablePackage({
      packageId: "package:invalid-ready",
      source: {
        bundleId: "exchange:atomic:asset:a:asset:a:v1",
        rootSubject: { kind: "atomic-asset", assetId: "asset:a", versionId: "asset:a:v1" },
      },
      readiness: { isReady: false, validationIssueCount: 1 },
      status: "ready",
    })).toThrow("requires readiness.isReady=true");

    const draft = createPublishablePackage({
      packageId: "package:status",
      source: {
        bundleId: "exchange:atomic:asset:a:asset:a:v1",
        rootSubject: { kind: "atomic-asset", assetId: "asset:a", versionId: "asset:a:v1" },
      },
      readiness: { isReady: false, reasonCodes: ["validation-pending"], validationIssueCount: 1 },
    });

    const ready = withPublishablePackageStatus({
      existing: draft,
      status: PublishablePackageStatuses.ready,
      readiness: { isReady: true, validationIssueCount: 0 },
      updatedAt: "2026-03-28T04:00:00.000Z",
    });

    expect(ready.status).toBe("ready");
    expect(ready.readiness.isReady).toBeTrue();
    expect(ready.updatedAt).toBe("2026-03-28T04:00:00.000Z");
    expect(ready.packageId.value).toBe(draft.packageId.value);
    expect(ready.source.bundleId.value).toBe(draft.source.bundleId.value);
  });
});
