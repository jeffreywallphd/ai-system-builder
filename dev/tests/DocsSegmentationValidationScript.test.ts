import { describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const validatorScriptPath = resolve(repoRoot, "dev/scripts/validate-docs-segmentation.cjs");

describe("docs segmentation validation script", () => {
  it("passes for the repository's current segmentation contract", () => {
    const result = spawnSync("node", [validatorScriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Docs segmentation validation passed.");
    expect(result.stdout).toContain("Checked status-signal anchor docs:");
    expect(result.stdout).toContain("Checked supersession registry entries and redirect cross-references:");
    expect(result.stdout).toContain("Checked active router docs for invalid superseded links:");
    expect(result.stdout).toContain("Checked non-active registry docs for metadata/status/structure signals:");
  });

  it("detects missing status signal markers on anchor docs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-status-marker-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const baselinesRouterPath = join(fixtureRoot, "docs", "baselines", "README.md");
    const baselinesRouter = readFileSync(baselinesRouterPath, "utf8").replace(
      "## Documentation Status",
      "## Baseline Status",
    );
    writeFileSync(baselinesRouterPath, baselinesRouter, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[STATUS_SIGNAL_MARKER_MISSING]");
    expect(combinedOutput).toContain("docs/baselines/README.md");
  });

  it("detects active router links to superseded docs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-active-link-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const docsReadmePath = join(fixtureRoot, "docs", "README.md");
    const docsReadme = `${readFileSync(docsReadmePath, "utf8")}\n\nLegacy pointer: [Old Presentation Path](./architecture/presentation-and-state.md)\n`;
    writeFileSync(docsReadmePath, docsReadme, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[ACTIVE_PATH_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("presentation-and-state.md");
  });

  it("detects invalid supersession destinations in the registry", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-registry-destination-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "architecture", "architecture-supersession-registry.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      supersededDocuments: Array<{ supersededBy: string }>;
    };
    registry.supersededDocuments[0].supersededBy = "docs/baselines/architecture/missing-supersession-target.md";
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[SUPERSESSION_DESTINATION_INVALID]");
    expect(combinedOutput).toContain("missing-supersession-target.md");
  });

  it("detects missing canonical destinations in supersession registry cross-references", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-registry-canonical-destination-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "architecture", "architecture-supersession-registry.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      supersededDocuments: Array<{ canonicalDestinations: string[] }>;
    };
    registry.supersededDocuments[0].canonicalDestinations[0] = "docs/architecture/missing-canonical-destination.md";
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[SUPERSESSION_CANONICAL_DESTINATION_INVALID]");
    expect(combinedOutput).toContain("missing-canonical-destination.md");
  });

  it("detects broken redirect references in superseded stubs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-redirect-reference-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const sourceStubPath = join(fixtureRoot, "docs", "architecture", "presentation-and-state.md");
    const sourceStubContent = readFileSync(sourceStubPath, "utf8").replace(
      "docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md",
      "docs/architecture/domains/runtime-host-surfaces/references/missing-host-composition-root-contracts.md",
    );
    writeFileSync(sourceStubPath, sourceStubContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[SUPERSESSION_REDIRECT_REFERENCE_INVALID]");
    expect(combinedOutput).toContain("missing-host-composition-root-contracts.md");
  });

  it("detects non-baseline historical destination drift in segmentation inventory", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-baseline-destination-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const inventoryPath = join(fixtureRoot, "docs", "documentation-segmentation-migration-inventory.inventory.json");
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as {
      candidates: Array<{ category: string; recommendedAction: { targetHistoricalPath?: string } }>;
    };
    const candidate = inventory.candidates.find((entry) => entry.category === "historical");
    if (!candidate) {
      throw new Error("Expected fixture inventory to include a historical candidate.");
    }
    candidate.recommendedAction.targetHistoricalPath = "docs/architecture/";
    writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[BASELINE_DESTINATION_INVALID]");
  });

  it("detects missing required metadata on non-active registry docs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-non-active-metadata-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const baselinePath = join(fixtureRoot, "docs", "baselines", "feature-1-documentation-foundation-handoff.md");
    const baselineContent = readFileSync(baselinePath, "utf8").replace(
      /last_reviewed:\s*2026-04-11\r?\n/,
      "",
    );
    writeFileSync(baselinePath, baselineContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[NON_ACTIVE_METADATA_FIELD_MISSING]");
    expect(combinedOutput).toContain("feature-1-documentation-foundation-handoff.md");
  });

  it("detects missing documentation status section on archived registry docs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-non-active-status-structure-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const baselinePath = join(fixtureRoot, "docs", "baselines", "feature-1-documentation-foundation-handoff.md");
    const baselineContent = readFileSync(baselinePath, "utf8").replace(
      "## Documentation Status",
      "## Baseline Status",
    );
    writeFileSync(baselinePath, baselineContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[NON_ACTIVE_STRUCTURE_MISSING]");
    expect(combinedOutput).toContain("feature-1-documentation-foundation-handoff.md");
  });

  it("detects missing supersession sections on superseded registry docs", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-segmentation-validator-non-active-supersession-structure-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const supersededDocPath = join(fixtureRoot, "docs", "architecture", "presentation-and-state.md");
    const supersededDocContent = readFileSync(supersededDocPath, "utf8").replace(
      "## Redirect",
      "## Destination",
    );
    writeFileSync(supersededDocPath, supersededDocContent, "utf8");

    const result = spawnSync("node", [validatorScriptPath, "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("[NON_ACTIVE_STRUCTURE_MISSING]");
    expect(combinedOutput).toContain("presentation-and-state.md");
  });
});
