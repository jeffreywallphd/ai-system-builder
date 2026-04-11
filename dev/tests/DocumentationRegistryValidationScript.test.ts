import { describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const validatorScriptPath = resolve(repoRoot, "dev/scripts/validate-documentation-registry.cjs");

describe("documentation registry validation script", () => {
  it("passes for the repository documentation registry", () => {
    const result = spawnSync("node", [validatorScriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Documentation registry validation passed.");
    expect(result.stdout).toContain("Checked required metadata fields and entry-level invariants.");
  });

  it("detects required metadata field drift", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-registry-validator-required-fields-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ title: string }>;
    };
    registry.entries[0].title = "";
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[REGISTRY_ENTRY_INVALID]");
    expect(combinedOutput).toContain("missing required field 'title'");
  });

  it("detects invalid enumerations for status and document type", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-registry-validator-enum-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ status: string; docType: string }>;
    };
    registry.entries[0].status = "invalid-status-for-test";
    registry.entries[0].docType = "invalid-doc-type-for-test";
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[REGISTRY_ENTRY_INVALID]");
    expect(combinedOutput).toContain("invalid-status-for-test");
    expect(combinedOutput).toContain("invalid-doc-type-for-test");
  });

  it("detects unknown relatedRecordIds and discovery references", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-registry-validator-related-record-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ relatedRecordIds: string[] }>;
      discoveryIndex: {
        byStatus: Record<string, string[]>;
      };
    };
    registry.entries[0].relatedRecordIds = ["doc-missing-related-record-id-for-test"];
    registry.discoveryIndex.byStatus.active.push("doc-missing-related-record-id-for-test");
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[REGISTRY_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("doc-missing-related-record-id-for-test");
  });
});
