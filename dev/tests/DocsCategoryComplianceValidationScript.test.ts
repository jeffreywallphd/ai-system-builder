import { describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const validatorScriptPath = resolve(repoRoot, "dev/scripts/validate-docs-category-compliance.cjs");

describe("docs category-compliance validation script", () => {
  it("passes for the repository documentation category contracts", () => {
    const result = spawnSync("node", [validatorScriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Documentation category-compliance validation passed.");
    expect(result.stdout).toContain("Checked ADR registry/category placement invariants:");
  });

  it("detects ADR registry entries that violate ADR placement paths", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-category-compliance-adr-path-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ docType: string; path: string; aiPath?: string }>;
    };

    const adrEntry = registry.entries.find((entry) => entry.docType === "adr");
    expect(adrEntry).toBeDefined();
    if (!adrEntry) {
      return;
    }

    adrEntry.path = "docs/architecture/domain-and-application-core.md";
    if (adrEntry.aiPath) {
      adrEntry.aiPath = "docs/architecture/domain-and-application-core.ai.md";
    }
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CATEGORY_ADR_PATH_INVALID]");
    expect(combinedOutput).toContain("domain-and-application-core.md");
  });

  it("detects baseline entries with invalid status or authoritativeness", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-category-compliance-baseline-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ docType: string; status: string; authoritativeness: string }>;
    };

    const baselineEntry = registry.entries.find((entry) => entry.docType === "baseline");
    expect(baselineEntry).toBeDefined();
    if (!baselineEntry) {
      return;
    }

    baselineEntry.status = "deprecated";
    baselineEntry.authoritativeness = "canonical";
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CATEGORY_BASELINE_STATUS_INVALID]");
    expect(combinedOutput).toContain("[CATEGORY_BASELINE_AUTHORITY_INVALID]");
  });

  it("detects routing references that target non-active registry records", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-category-compliance-routing-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const routingSeedPath = join(fixtureRoot, "docs", "context", "routing", "task-to-context-routing.seed.json");

    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ recordId: string; path: string; status: string }>;
    };
    const routingSeed = JSON.parse(readFileSync(routingSeedPath, "utf8")) as {
      mappings: Array<{ relatedDocPaths: string[]; relatedDocRecordIds?: string[] }>;
    };

    const supersededEntry = registry.entries.find((entry) => entry.status === "superseded");
    expect(supersededEntry).toBeDefined();
    expect(routingSeed.mappings.length).toBeGreaterThan(0);
    if (!supersededEntry || routingSeed.mappings.length === 0) {
      return;
    }

    routingSeed.mappings[0].relatedDocPaths = [supersededEntry.path];
    routingSeed.mappings[0].relatedDocRecordIds = [supersededEntry.recordId];

    writeFileSync(routingSeedPath, `${JSON.stringify(routingSeed, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CATEGORY_ROUTING_STATUS_INVALID]");
    expect(combinedOutput).toContain(supersededEntry.path);
  });
});
