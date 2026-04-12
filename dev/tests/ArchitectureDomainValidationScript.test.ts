import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const validatorScriptPath = resolve(repoRoot, "dev/scripts/validate-architecture-domains.cjs");

describe("architecture domain validation script", () => {
  it("passes for the repository's current domainized architecture docs", () => {
    const result = spawnSync("node", [validatorScriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Architecture domain validation passed.");
    expect(result.stdout).toContain("Checked taxonomy-backed domains:");
  });

  it("detects missing required domain files", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "architecture-domain-validator-missing-file-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    rmSync(
      join(
        fixtureRoot,
        "docs",
        "architecture",
        "domains",
        "runtime-host-surfaces",
        "overview.md",
      ),
    );

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOMAIN_REQUIRED_FILE_MISSING]");
    expect(combinedOutput).toContain("runtime-host-surfaces/overview.md");
  });

  it("detects broken core links in required domain docs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "architecture-domain-validator-broken-link-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const overviewPath = join(
      fixtureRoot,
      "docs",
      "architecture",
      "domains",
      "core-platform-and-composition",
      "overview.md",
    );
    const overviewContent = readFileSync(overviewPath, "utf8").replace(
      "../../../../src/infrastructure/composition",
      "../../../../src/infrastructure/missing-core-link-validator-path",
    );
    writeFileSync(overviewPath, overviewContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOMAIN_CORE_LINK_MISSING]");
    expect(combinedOutput).toContain("missing-core-link-validator-path");
  });

  it("detects missing .md/.ai.md companion pairing for domain reference docs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "architecture-domain-validator-reference-pair-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    rmSync(
      join(
        fixtureRoot,
        "docs",
        "architecture",
        "domains",
        "api-and-transport-surfaces",
        "references",
        "unified-api-surface-contracts.ai.md",
      ),
    );

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOMAIN_REFERENCE_PAIR_MISSING]");
    expect(combinedOutput).toContain("unified-api-surface-contracts.ai.md");
  });

  it("detects unexpected domain directories that are not in the taxonomy", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "architecture-domain-validator-unexpected-domain-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    mkdirSync(
      join(
        fixtureRoot,
        "docs",
        "architecture",
        "domains",
        "unexpected-domain-for-validator-test",
      ),
      { recursive: true },
    );

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOMAIN_DIRECTORY_UNEXPECTED]");
    expect(combinedOutput).toContain("unexpected-domain-for-validator-test");
  });
});
