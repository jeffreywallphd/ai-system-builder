import { describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const validatorScriptPath = resolve(repoRoot, "dev/scripts/validate-adr-records.cjs");

describe("ADR validation script", () => {
  it("passes for the repository's ADR records", () => {
    const result = spawnSync("node", [validatorScriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ADR validation passed.");
    expect(result.stdout).toContain("Checked required sections:");
  });

  it("detects missing required ADR sections", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "adr-validator-section-missing-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    for (const variant of [
      "adr-001-single-authoritative-control-plane.md",
      "adr-001-single-authoritative-control-plane.ai.md",
    ]) {
      const adrPath = join(fixtureRoot, "docs", "adr", "records", variant);
      const content = readFileSync(adrPath, "utf8").replace("## Decision Drivers", "## Decision Driver");
      writeFileSync(adrPath, content, "utf8");
    }

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ADR_REQUIRED_SECTION_MISSING]");
    expect(combinedOutput).toContain("## Decision Drivers");
  });

  it("detects identifier drift between registry and ADR metadata", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "adr-validator-identifier-mismatch-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const humanAdrPath = join(
      fixtureRoot,
      "docs",
      "adr",
      "records",
      "adr-001-single-authoritative-control-plane.md",
    );
    const humanContent = readFileSync(humanAdrPath, "utf8").replace(
      "adr_number: 001",
      "adr_number: 099",
    );
    writeFileSync(humanAdrPath, humanContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ADR_IDENTIFIER_MISMATCH]");
    expect(combinedOutput).toContain("adr_number '099'");
  });

  it("detects missing related documentation references in ADR records", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "adr-validator-related-doc-reference-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const humanAdrPath = join(
      fixtureRoot,
      "docs",
      "adr",
      "records",
      "adr-001-single-authoritative-control-plane.md",
    );
    const updatedContent = readFileSync(humanAdrPath, "utf8").replace(
      "docs/architecture/authoritative-server-host-assembly.md",
      "docs/architecture/missing-related-doc-for-test.md",
    );
    writeFileSync(humanAdrPath, updatedContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ADR_RELATED_DOC_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("missing-related-doc-for-test.md");
  });

  it("detects architecture related-ADR references that are not registered targets", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "adr-validator-architecture-related-adr-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const architectureDocPath = join(
      fixtureRoot,
      "docs",
      "architecture",
      "domain-and-application-core.md",
    );
    const updatedContent = readFileSync(architectureDocPath, "utf8").replace(
      "docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md",
      "docs/adr/records/adr-099-missing-architecture-reference.md",
    );
    writeFileSync(architectureDocPath, updatedContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ARCHITECTURE_ADR_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("adr-099-missing-architecture-reference.md");
  });

  it("detects context-pack ADR references that are not registered targets", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "adr-validator-context-pack-related-adr-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const packDocPath = join(
      fixtureRoot,
      "docs",
      "context",
      "packs",
      "architecture-core.pack.md",
    );
    const updatedContent = readFileSync(packDocPath, "utf8").replace(
      "docs/adr/records/adr-003-storage-as-managed-platform-resource.md",
      "docs/adr/records/adr-099-missing-context-pack-reference.md",
    );
    writeFileSync(packDocPath, updatedContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CONTEXT_PACK_ADR_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("adr-099-missing-context-pack-reference.md");
  });

  it("detects missing review expectations for heightened ADRs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "adr-validator-heightened-review-expectations-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    for (const variant of [
      "adr-005-trust-identity-and-security-boundary-enforcement.md",
      "adr-005-trust-identity-and-security-boundary-enforcement.ai.md",
    ]) {
      const adrPath = join(fixtureRoot, "docs", "adr", "records", variant);
      const content = readFileSync(adrPath, "utf8").replace(
        /\n## Review Expectations[\s\S]*?(?=\n## Related Documentation)/m,
        "\n",
      );
      writeFileSync(adrPath, content, "utf8");
    }

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ADR_REVIEW_EXPECTATIONS_SECTION_MISSING]");
    expect(combinedOutput).toContain("review_tier is 'heightened'");
  });
});
