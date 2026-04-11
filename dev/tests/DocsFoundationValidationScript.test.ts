import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const validatorScriptPath = resolve(repoRoot, "dev/scripts/validate-docs-foundation.cjs");

describe("docs foundation validation script", () => {
  it("passes for the repository's current docs foundation contract", () => {
    const result = spawnSync("node", [validatorScriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Docs foundation validation passed.");
    expect(result.stdout).toContain("Checked context foundation assets:");
    expect(result.stdout).toContain("Checked metadata seed docs:");
  });

  it("returns understandable errors for missing structure", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-"));
    mkdirSync(join(fixtureRoot, "docs"), { recursive: true });

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("Docs foundation validation failed.");
    expect(combinedOutput).toContain("[TOP_LEVEL_FOLDER_MISSING]");
    expect(combinedOutput).toContain("[ROUTER_FILE_MISSING]");
    expect(combinedOutput).toContain("[CONTEXT_SUBFOLDER_MISSING]");
  });

  it("detects invalid context-map pack references", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-context-map-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const contextMapPath = join(fixtureRoot, "docs", "context", "context-map.json");
    const contextMap = JSON.parse(readFileSync(contextMapPath, "utf8")) as {
      taskCategoryMappings: Array<{ packRefs: Array<{ packId: string }> }>;
    };
    contextMap.taskCategoryMappings[0].packRefs[0].packId = "missing-pack-id-for-validator-test";
    writeFileSync(contextMapPath, `${JSON.stringify(contextMap, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CONTEXT_MAP_INVALID_REFERENCE]");
    expect(combinedOutput).toContain("missing-pack-id-for-validator-test");
  });

  it("detects missing required headings in context packs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-pack-shape-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const packPath = join(fixtureRoot, "docs", "context", "packs", "repository-overview.pack.md");
    const packContent = readFileSync(packPath, "utf8").replace("## Anti-Patterns", "## Anti Patterns");
    writeFileSync(packPath, packContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CONTEXT_PACK_SHAPE_INVALID]");
    expect(combinedOutput).toContain("repository-overview.pack.md is missing required heading '## Anti-Patterns'.");
  });

  it("detects missing authoritative references inside context packs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-pack-authority-ref-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const packPath = join(fixtureRoot, "docs", "context", "packs", "repository-overview.pack.md");
    const packContent = readFileSync(packPath, "utf8").replace(
      "- `docs/architecture/layers-and-boundaries.md`",
      "- `docs/architecture/missing-authoritative-doc.md`",
    );
    writeFileSync(packPath, packContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CONTEXT_PACK_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("missing-authoritative-doc.md");
  });

  it("detects missing routing mapping core reference paths", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-routing-core-ref-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const routingSeedPath = join(fixtureRoot, "docs", "context", "routing", "task-to-context-routing.seed.json");
    const routingSeed = JSON.parse(readFileSync(routingSeedPath, "utf8")) as {
      mappings: Array<{ relatedDocPaths: string[] }>;
    };
    routingSeed.mappings[0].relatedDocPaths[0] = "docs/architecture/missing-routing-reference.md";
    writeFileSync(routingSeedPath, `${JSON.stringify(routingSeed, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ROUTING_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("missing-routing-reference.md");
  });

  it("detects missing required headings in documentation indexing model", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-index-model-shape-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const indexingModelPath = join(fixtureRoot, "docs", "context", "documentation-indexing-model.md");
    const indexingModelContent = readFileSync(indexingModelPath, "utf8").replace(
      "## Goals",
      "## Outcomes",
    );
    writeFileSync(indexingModelPath, indexingModelContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOCUMENTATION_INDEX_MODEL_INVALID]");
    expect(combinedOutput).toContain("documentation-indexing-model.md is missing required heading '## Goals'.");
  });

  it("detects missing required headings in documentation index coverage rules", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-index-coverage-rules-shape-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const coverageRulesPath = join(fixtureRoot, "docs", "context", "documentation-index-coverage-rules.md");
    const coverageRulesContent = readFileSync(coverageRulesPath, "utf8").replace(
      "## Inclusion Rules",
      "## Inclusion Guidance",
    );
    writeFileSync(coverageRulesPath, coverageRulesContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOCUMENTATION_INDEX_COVERAGE_RULES_INVALID]");
    expect(combinedOutput).toContain("documentation-index-coverage-rules.md is missing required heading '## Inclusion Rules'.");
  });

  it("detects out-of-sync documentation index views", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-index-view-sync-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const indexViewPath = join(fixtureRoot, "docs", "context", "documentation-index.md");
    const indexViewContent = readFileSync(indexViewPath, "utf8").replace(
      "## At a Glance",
      "## At A Glance",
    );
    writeFileSync(indexViewPath, indexViewContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOCUMENTATION_INDEX_VIEW_INVALID]");
    expect(combinedOutput).toContain("documentation-index.md is missing required heading '## At a Glance'.");
  });

  it("detects missing required headings in documentation quality standard", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-quality-standard-shape-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const qualityStandardPath = join(
      fixtureRoot,
      "docs",
      "context",
      "governance",
      "documentation-quality-standard.md",
    );
    const qualityStandardContent = readFileSync(qualityStandardPath, "utf8").replace(
      "## Recommended Guidance (Non-Blocking)",
      "## Guidance",
    );
    writeFileSync(qualityStandardPath, qualityStandardContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[DOCUMENTATION_QUALITY_STANDARD_INVALID]");
    expect(combinedOutput).toContain(
      "documentation-quality-standard.md is missing required heading '## Recommended Guidance (Non-Blocking)'.",
    );
  });

  it("detects invalid indexed document metadata contract shape", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-indexed-metadata-contract-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const contractPath = join(fixtureRoot, "docs", "context", "documentation-indexed-document-metadata.contract.json");
    const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
      artifactType: string;
    };
    contract.artifactType = "invalid-indexed-doc-contract-type";
    writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CONTEXT_CONTRACT_INVALID]");
    expect(combinedOutput).toContain("documentation-indexed-document-metadata.contract.json");
  });

  it("detects invalid documentation registry entries", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-documentation-registry-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ docType: string }>;
    };
    registry.entries[0].docType = "invalid-doc-type";
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CONTEXT_REGISTRY_INVALID]");
    expect(combinedOutput).toContain("invalid-doc-type");
  });

  it("detects unknown stable-key references in registry entries", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-documentation-registry-record-ref-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ relatedRecordIds?: string[] }>;
    };
    registry.entries[0].relatedRecordIds = ["doc-missing-record-for-validator-test"];
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CONTEXT_REGISTRY_INVALID]");
    expect(combinedOutput).toContain("doc-missing-record-for-validator-test");
  });

  it("detects invalid task-discovery routing hints in documentation registry", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-doc-registry-task-routing-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      taskRoutingIndex: {
        routeHintsByTaskCategory: Record<string, { routeTaskIds: string[] }>;
      };
    };
    registry.taskRoutingIndex.routeHintsByTaskCategory["architecture-review"].routeTaskIds = [
      "missing-routing-task-id-for-validator-test",
    ];
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[CONTEXT_REGISTRY_INVALID]");
    expect(combinedOutput).toContain("missing-routing-task-id-for-validator-test");
  });

  it("detects missing ADR registry record references", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-adr-registry-ref-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const adrRegistryPath = join(fixtureRoot, "docs", "adr", "records", "adr-registry.json");
    const adrRegistry = JSON.parse(readFileSync(adrRegistryPath, "utf8")) as {
      records: Array<{ humanDocPath: string }>;
    };
    adrRegistry.records[0].humanDocPath = "docs/adr/records/missing-adr-record.md";
    writeFileSync(adrRegistryPath, `${JSON.stringify(adrRegistry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ADR_REGISTRY_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("missing-adr-record.md");
  });

  it("detects ADR supersession metadata conflicts", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-adr-supersession-conflict-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    for (const variant of [
      "adr-001-single-authoritative-control-plane.md",
      "adr-001-single-authoritative-control-plane.ai.md",
    ]) {
      const adrPath = join(fixtureRoot, "docs", "adr", "records", variant);
      const content = readFileSync(adrPath, "utf8").replace(
        "last_reviewed: 2026-04-11",
        [
          "supersedes: docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md",
          "superseded_by: docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md",
          "last_reviewed: 2026-04-11",
        ].join("\n"),
      );
      writeFileSync(adrPath, content, "utf8");
    }

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ADR_SUPERSESSION_CONFLICT]");
    expect(combinedOutput).toContain("cannot set both supersedes and superseded_by");
  });

  it("detects superseded_by targets that are not accepted ADRs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-adr-supersession-target-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    for (const variant of [
      "adr-001-single-authoritative-control-plane.md",
      "adr-001-single-authoritative-control-plane.ai.md",
    ]) {
      const adrPath = join(fixtureRoot, "docs", "adr", "records", variant);
      const content = readFileSync(adrPath, "utf8").replace(
        "last_reviewed: 2026-04-11",
        "superseded_by: docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md\nlast_reviewed: 2026-04-11",
      );
      writeFileSync(adrPath, content, "utf8");
    }

    for (const variant of [
      "adr-002-workspace-centered-tenancy-and-resource-ownership.md",
      "adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md",
    ]) {
      const adrPath = join(fixtureRoot, "docs", "adr", "records", variant);
      const content = readFileSync(adrPath, "utf8").replace(
        "decision_status: accepted",
        "decision_status: proposed",
      );
      writeFileSync(adrPath, content, "utf8");
    }

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ADR_SUPERSESSION_TARGET_INVALID]");
    expect(combinedOutput).toContain("must be decision_status 'accepted'");
  });

  it("detects missing supersession backlinks from replacement ADRs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-foundation-validator-adr-supersession-backlink-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    for (const variant of [
      "adr-001-single-authoritative-control-plane.md",
      "adr-001-single-authoritative-control-plane.ai.md",
    ]) {
      const adrPath = join(fixtureRoot, "docs", "adr", "records", variant);
      const content = readFileSync(adrPath, "utf8").replace(
        "last_reviewed: 2026-04-11",
        "superseded_by: docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md\nlast_reviewed: 2026-04-11",
      );
      writeFileSync(adrPath, content, "utf8");
    }

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ADR_SUPERSESSION_BACKLINK_MISSING]");
    expect(combinedOutput).toContain("must set supersedes");
  });
});
