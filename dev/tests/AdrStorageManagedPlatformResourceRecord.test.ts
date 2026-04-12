import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ADR-003 storage as managed platform resource record", () => {
  const humanAdrPath =
    "docs/adr/records/adr-003-storage-as-managed-platform-resource.md";
  const aiAdrPath =
    "docs/adr/records/adr-003-storage-as-managed-platform-resource.ai.md";

  it("keeps required ADR metadata and section contract in both variants", () => {
    for (const path of [humanAdrPath, aiAdrPath]) {
      const doc = read(path);

      const requiredMetadataTokens = [
        "title: ADR-003 Storage as Managed Platform Resource",
        "doc_type: adr",
        "status: active",
        "authoritativeness: canonical",
        "adr_number: 003",
        "decision_status: accepted",
        "decision_date: 2026-04-11",
      ] as const;

      const requiredSectionHeadings = [
        "## Status",
        "## Decision Date",
        "## Decision Statement",
        "## Context and Problem Statement",
        "## Decision Drivers",
        "## Considered Options",
        "## Chosen Approach",
        "## Consequences",
        "## Related Documentation",
        "## Related Code Paths",
      ] as const;

      for (const token of requiredMetadataTokens) {
        expect(doc).toContain(token);
      }
      for (const heading of requiredSectionHeadings) {
        expect(doc).toContain(heading);
      }
    }
  });

  it("captures platform-managed storage implications, including provisioning, directories, and user-facing abstractions", () => {
    const humanAdr = read(humanAdrPath).toLowerCase();
    const aiAdr = read(aiAdrPath).toLowerCase();

    for (const doc of [humanAdr, aiAdr]) {
      expect(doc).toContain("managed platform");
      expect(doc).toContain("provisioned storage instances");
      expect(doc).toContain("directory conventions");
      expect(doc).toContain("user-facing storage abstractions");
      expect(doc).toContain("logical object");
      expect(doc).toContain("path");
    }
  });

  it("is indexed in ADR records and linked from storage architecture references", () => {
    const recordsReadme = read("docs/adr/records/README.md");
    const recordsReadmeAi = read("docs/adr/records/README.ai.md");

    const storageFoundation = read("docs/architecture/storage-foundation.md");
    const storageFoundationAi = read("docs/architecture/storage-foundation.ai.md");
    const storageProvisioning = read("docs/architecture/storage-provisioning-orchestration.md");
    const storageProvisioningAi = read("docs/architecture/storage-provisioning-orchestration.ai.md");
    const storageApplicationPorts = read("docs/architecture/storage-application-ports.md");
    const storageApplicationPortsAi = read("docs/architecture/storage-application-ports.ai.md");
    const storageAccessSemantics = read("docs/architecture/storage-access-semantics.md");
    const storageAccessSemanticsAi = read("docs/architecture/storage-access-semantics.ai.md");
    const storageExtensionGuidance = read("docs/architecture/storage-feature-extension-guidance.md");
    const storageExtensionGuidanceAi = read("docs/architecture/storage-feature-extension-guidance.ai.md");

    expect(recordsReadme).toContain("adr-003-storage-as-managed-platform-resource.md");
    expect(recordsReadmeAi).toContain("adr-003-storage-as-managed-platform-resource.ai.md");

    for (const doc of [
      storageFoundation,
      storageProvisioning,
      storageApplicationPorts,
      storageAccessSemantics,
      storageExtensionGuidance,
    ]) {
      expect(doc).toContain("## Related ADRs");
      expect(doc).toContain("adr-003-storage-as-managed-platform-resource.md");
    }

    for (const doc of [
      storageFoundationAi,
      storageProvisioningAi,
      storageApplicationPortsAi,
      storageAccessSemanticsAi,
      storageExtensionGuidanceAi,
    ]) {
      expect(doc).toContain("## Related ADRs");
      expect(doc).toContain("adr-003-storage-as-managed-platform-resource.ai.md");
    }
  });
});
