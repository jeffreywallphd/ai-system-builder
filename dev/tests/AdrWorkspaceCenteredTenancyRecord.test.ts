import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ADR-002 workspace-centered tenancy and resource ownership record", () => {
  const humanAdrPath =
    "docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md";
  const aiAdrPath =
    "docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md";

  it("keeps required ADR metadata and section contract in both variants", () => {
    for (const path of [humanAdrPath, aiAdrPath]) {
      const doc = read(path);

      const requiredMetadataTokens = [
        "title: ADR-002 Workspace-Centered Tenancy and Resource Ownership",
        "doc_type: adr",
        "status: active",
        "authoritativeness: canonical",
        "adr_number: 002",
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

  it("captures implications for storage, assets, execution, policy, and user-private resources", () => {
    const humanAdr = read(humanAdrPath).toLowerCase();
    const aiAdr = read(aiAdrPath).toLowerCase();

    for (const doc of [humanAdr, aiAdr]) {
      expect(doc).toContain("workspace-centered tenancy model");
      expect(doc).toContain("storage");
      expect(doc).toContain("assets");
      expect(doc).toContain("execution");
      expect(doc).toContain("policy");
      expect(doc).toContain("user-private resources");
      expect(doc).toContain("workspace-scoped");
    }
  });

  it("is indexed in ADR records and linked from core workspace ownership architecture references", () => {
    const recordsReadme = read("docs/adr/records/README.md");
    const recordsReadmeAi = read("docs/adr/records/README.ai.md");

    const workspaceFoundation = read("docs/architecture/workspace-foundation.md");
    const workspaceFoundationAi = read("docs/architecture/workspace-foundation.ai.md");
    const storageFoundation = read("docs/architecture/storage-foundation.md");
    const storageFoundationAi = read("docs/architecture/storage-foundation.ai.md");
    const storageAccess = read("docs/architecture/storage-access-semantics.md");
    const storageAccessAi = read("docs/architecture/storage-access-semantics.ai.md");
    const sharedAssets = read("docs/architecture/shared-asset-contracts.md");
    const sharedAssetsAi = read("docs/architecture/shared-asset-contracts.ai.md");
    const workflowExecution = read("docs/architecture/workflow-execution-and-tools.md");
    const workflowExecutionAi = read("docs/architecture/workflow-execution-and-tools.ai.md");
    const visibilitySharing = read(
      "docs/architecture/authorization-visibility-sharing-contracts.md",
    );
    const visibilitySharingAi = read(
      "docs/architecture/authorization-visibility-sharing-contracts.ai.md",
    );

    expect(recordsReadme).toContain(
      "adr-002-workspace-centered-tenancy-and-resource-ownership.md",
    );
    expect(recordsReadmeAi).toContain(
      "adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md",
    );

    for (const doc of [
      workspaceFoundation,
      storageFoundation,
      storageAccess,
      sharedAssets,
      workflowExecution,
      visibilitySharing,
    ]) {
      expect(doc).toContain("## Related ADRs");
      expect(doc).toContain("adr-002-workspace-centered-tenancy-and-resource-ownership.md");
    }

    for (const doc of [
      workspaceFoundationAi,
      storageFoundationAi,
      storageAccessAi,
      sharedAssetsAi,
      workflowExecutionAi,
      visibilitySharingAi,
    ]) {
      expect(doc).toContain("## Related ADRs");
      expect(doc).toContain(
        "adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md",
      );
    }
  });
});
