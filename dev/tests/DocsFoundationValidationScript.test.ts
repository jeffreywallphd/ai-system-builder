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
});
