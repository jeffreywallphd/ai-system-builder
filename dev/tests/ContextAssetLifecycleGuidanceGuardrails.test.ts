import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const governanceReadmePath = resolve(repoRoot, "docs/context/governance/README.md");
const governanceAiReadmePath = resolve(repoRoot, "docs/context/governance/README.ai.md");
const lifecycleDocPath = resolve(repoRoot, "docs/context/governance/context-asset-lifecycle.md");
const lifecycleAiDocPath = resolve(repoRoot, "docs/context/governance/context-asset-lifecycle.ai.md");

const requiredHeadings = [
  "## Scope",
  "## Lifecycle Stages",
  "## Creation Criteria",
  "## Update Triggers",
  "## Ownership Expectations",
  "## Review Cadence",
  "## Deprecation and Supersession",
  "## Conflicts and Obsolete Context Resolution",
] as const;

const requiredStages = [
  "proposed",
  "authoring",
  "active",
  "in-review",
  "deprecated",
  "superseded",
  "retired",
] as const;

describe("context asset lifecycle guidance guardrails", () => {
  it("keeps lifecycle guidance docs present and linked from governance routers", () => {
    expect(existsSync(lifecycleDocPath)).toBe(true);
    expect(existsSync(lifecycleAiDocPath)).toBe(true);

    const governanceReadme = readFileSync(governanceReadmePath, "utf8");
    const governanceAiReadme = readFileSync(governanceAiReadmePath, "utf8");

    expect(governanceReadme).toContain("./context-asset-lifecycle.md");
    expect(governanceAiReadme).toContain("./context-asset-lifecycle.ai.md");
  });

  it("keeps lifecycle stages and maintenance expectations explicit for human and AI docs", () => {
    const lifecycleDoc = readFileSync(lifecycleDocPath, "utf8");
    const lifecycleAiDoc = readFileSync(lifecycleAiDocPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(lifecycleDoc).toContain(heading);
      expect(lifecycleAiDoc).toContain(heading);
    }

    for (const stage of requiredStages) {
      expect(lifecycleDoc).toContain(stage);
      expect(lifecycleAiDoc).toContain(stage);
    }
  });
});

