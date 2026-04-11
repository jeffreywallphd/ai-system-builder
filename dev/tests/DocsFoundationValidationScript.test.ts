import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
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
});
