import { describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const lintScriptPath = resolve(repoRoot, "dev/scripts/lint-docs.cjs");

describe("docs lint entrypoint script", () => {
  it("lists available checks for contributor discoverability", () => {
    const result = spawnSync("node", [lintScriptPath, "--list-checks"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Available docs lint checks:");
    expect(result.stdout).toContain("- foundation:");
    expect(result.stdout).toContain("- registry:");
    expect(result.stdout).toContain("- adr:");
    expect(result.stdout).toContain("- architecture-domains:");
    expect(result.stdout).toContain("- segmentation:");
  });

  it("runs a selected check successfully against the repository", () => {
    const result = spawnSync("node", [lintScriptPath, "--checks", "registry"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Docs lint passed.");
    expect(result.stdout).toContain("[PASS] registry");
  });

  it("returns argument error for unknown check identifiers", () => {
    const result = spawnSync("node", [lintScriptPath, "--checks", "missing-check"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(2);
    expect(combinedOutput).toContain("Argument error:");
    expect(combinedOutput).toContain("Unknown docs lint check id(s): missing-check");
  });

  it("propagates child validator failures with check context", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "docs-lint-entrypoint-registry-failure-"));
    cpSync(join(repoRoot, "docs"), join(fixtureRoot, "docs"), { recursive: true });

    const registryPath = join(fixtureRoot, "docs", "context", "documentation-registry.seed.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries: Array<{ title: string }>;
    };
    registry.entries[0].title = "";
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = spawnSync("node", [lintScriptPath, "--root", fixtureRoot, "--checks", "registry"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(combinedOutput).toContain("Docs lint failed.");
    expect(combinedOutput).toContain("[FAIL] registry");
    expect(combinedOutput).toContain("[REGISTRY_ENTRY_INVALID]");
    expect(combinedOutput).toContain("## registry");
  });
});
