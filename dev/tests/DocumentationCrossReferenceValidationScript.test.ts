import { describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = process.cwd();
const validatorScriptPath = resolve(repoRoot, "dev/scripts/validate-docs-cross-references.cjs");

describe("documentation cross-reference validation script", () => {
  it("passes for the repository's current docs cross-reference graph", () => {
    const result = spawnSync("node", [validatorScriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Documentation cross-reference validation passed.");
    expect(result.stdout).toContain("Checked high-value markdown docs for internal documentation link validity:");
    expect(result.stdout).toContain("Checked routing doc references against registry record IDs:");
  });

  it("detects broken internal links in high-value markdown docs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-cross-reference-broken-link-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const indexPath = join(fixtureRoot, "docs", "context", "documentation-index.md");
    const updatedIndex = readFileSync(indexPath, "utf8").replace(
      "../architecture/domain-and-application-core.md",
      "../architecture/missing-doc-for-cross-reference-validator.md",
    );
    writeFileSync(indexPath, updatedIndex, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOC_INTERNAL_LINK_BROKEN]");
    expect(combinedOutput).toContain("missing-doc-for-cross-reference-validator.md");
  });

  it("detects missing relatedDocRecordIds for indexed routing doc references", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-cross-reference-routing-drift-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const routingSeedPath = join(fixtureRoot, "docs", "context", "routing", "task-to-context-routing.seed.json");
    const routingSeed = JSON.parse(readFileSync(routingSeedPath, "utf8")) as {
      mappings: Array<{
        taskId: string;
        relatedDocRecordIds?: string[];
      }>;
    };
    const documentationMapping = routingSeed.mappings.find(
      (mapping) => mapping.taskId === "documentation-refactor-context-and-architecture",
    );
    expect(documentationMapping).toBeDefined();
    if (!documentationMapping) {
      return;
    }

    documentationMapping.relatedDocRecordIds = (documentationMapping.relatedDocRecordIds ?? []).filter(
      (recordId) => recordId !== "doc-contributors-docs-placement-guide",
    );
    writeFileSync(routingSeedPath, `${JSON.stringify(routingSeed, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ROUTING_RELATED_RECORD_MISSING]");
    expect(combinedOutput).toContain("doc-contributors-docs-placement-guide");
  });

  it("detects unknown relatedDocRecordIds in routing mappings", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-cross-reference-routing-unknown-record-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const routingSeedPath = join(fixtureRoot, "docs", "context", "routing", "task-to-context-routing.seed.json");
    const routingSeed = JSON.parse(readFileSync(routingSeedPath, "utf8")) as {
      mappings: Array<{
        relatedDocRecordIds?: string[];
      }>;
    };
    expect(routingSeed.mappings.length).toBeGreaterThan(0);
    if (routingSeed.mappings.length === 0) {
      return;
    }

    routingSeed.mappings[0].relatedDocRecordIds = [
      ...(routingSeed.mappings[0].relatedDocRecordIds ?? []),
      "doc-missing-routing-record-id-for-test",
    ];
    writeFileSync(routingSeedPath, `${JSON.stringify(routingSeed, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ROUTING_RELATED_RECORD_UNKNOWN]");
    expect(combinedOutput).toContain("doc-missing-routing-record-id-for-test");
  });

  it("detects documentation-index record link mismatches", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-cross-reference-index-mismatch-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const indexPath = join(fixtureRoot, "docs", "context", "documentation-index.md");
    const updatedIndex = readFileSync(indexPath, "utf8").replace(
      /(\[Domain and Application Core\]\()([^)]*)(\)\s+\(`doc-architecture-domain-and-application-core`\))/,
      "$1../architecture/layers-and-boundaries.md$3",
    );
    writeFileSync(indexPath, updatedIndex, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[INDEX_RECORD_LINK_MISMATCH]");
    expect(combinedOutput).toContain("doc-architecture-domain-and-application-core");
  });

  it("detects supersession target drift between documentation and architecture registries", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-cross-reference-supersession-drift-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const documentationRegistryPath = join(
      fixtureRoot,
      "docs",
      "context",
      "documentation-registry.seed.json",
    );
    const documentationRegistry = JSON.parse(readFileSync(documentationRegistryPath, "utf8")) as {
      entries: Array<{
        recordId: string;
        supersededBy?: string;
      }>;
    };
    const supersededEntry = documentationRegistry.entries.find(
      (entry) => entry.recordId === "doc-architecture-superseded-presentation-and-state",
    );
    expect(supersededEntry).toBeDefined();
    if (!supersededEntry) {
      return;
    }

    supersededEntry.supersededBy = "docs/architecture/domain-and-application-core.md";
    writeFileSync(documentationRegistryPath, `${JSON.stringify(documentationRegistry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[SUPERSESSION_REGISTRY_ALIGNMENT_INVALID]");
    expect(combinedOutput).toContain("target mismatch");
  });
});
