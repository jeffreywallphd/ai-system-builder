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
});
