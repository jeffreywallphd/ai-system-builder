import { describe, expect, it } from "../../../../testing/node-test";
import { createPackageEntry as entry, createPackageFixture, encodePackage as encode } from "../../../../testing/fixtures/asset-package-fixture";
import { createWorkspaceId } from "../../../../contracts/workspace";
import { createAisbPackageInspector } from "../createAisbPackageInspector";

describe(".aisb-package bounded inspector", () => {
  it("inspects a valid package without executing any entry", async () => {
    const inspector = createAisbPackageInspector();
    const packageFixture = await createPackageFixture(inspector);
    const inspected = await inspector.inspect({
      inspectionId: "inspection-1",
      workspaceId: createWorkspaceId("workspace-a"),
      bytes: packageFixture.bytes,
      inspectedAt: "2026-07-17T12:00:00.000Z",
    });
    expect(inspected.summary.eligibleForAdmission).toBe(true);
    expect(inspected.summary.provenanceStatus).toBe("unverified");
    expect(inspected.summary.sbomStatus).toBe("unverified");
    expect(inspected.summary.implementationCount).toBe(1);
    expect(JSON.stringify(inspected.summary)).not.toContain("contentBase64");
    expect(JSON.stringify(inspected.summary)).not.toContain("console.log");
  });

  it("fails closed for traversal, device paths, duplicates, oversize content, and digest tampering", async () => {
    const inspector = createAisbPackageInspector({ maxEntryBytes: 32, maxExpandedBytes: 64 });
    const fixture = await createPackageFixture(inspector);
    const base = fixture.container;
    const maliciousEntries = [
      entry("../escape.js", "application/javascript", "x"),
      entry("CON.txt", "text/plain", "x"),
      entry("safe/duplicate.js", "application/javascript", "x"),
      entry("SAFE/DUPLICATE.js", "application/javascript", "x"),
      { ...entry("safe/tampered.js", "application/javascript", "x"), digest: `sha256:${"0".repeat(64)}` as const },
      entry("safe/large.txt", "text/plain", "x".repeat(80)),
    ];
    const result = await inspector.inspect({
      inspectionId: "inspection-malicious",
      workspaceId: createWorkspaceId("workspace-a"),
      bytes: encode({ ...base, entries: maliciousEntries }),
      inspectedAt: "2026-07-17T12:00:00.000Z",
    });
    expect(result.summary.eligibleForAdmission).toBe(false);
    const codes = result.summary.issues.map((value) => value.code);
    expect(codes).toContain("package.entry.path-unsafe");
    expect(codes).toContain("package.entry.path-duplicate");
    expect(codes).toContain("package.entry.size-exceeded");
    expect(codes).toContain("package.entry.digest-mismatch");
  });
});
