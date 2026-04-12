import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const boundariesPath = resolve(repoRoot, "docs/adr/records/rollout-boundaries.md");
const boundariesAiPath = resolve(repoRoot, "docs/adr/records/rollout-boundaries.ai.md");
const adrReadmePath = resolve(repoRoot, "docs/adr/README.md");
const adrReadmeAiPath = resolve(repoRoot, "docs/adr/README.ai.md");
const recordsReadmePath = resolve(repoRoot, "docs/adr/records/README.md");
const recordsReadmeAiPath = resolve(repoRoot, "docs/adr/records/README.ai.md");

const requiredHeadings = [
  "## Scope and Intent",
  "## Initial Rollout Scope (What Is Included)",
  "## Known Gaps and Explicit Non-Goals for Initial Rollout",
  "## Future ADR Expansion Areas",
  "## Responsible ADR Library Extension Rules",
  "## Definition of Complete for Initial ADR Rollout",
] as const;

describe("ADR rollout boundaries guardrails", () => {
  it("keeps rollout boundaries docs present and discoverable from ADR routers", () => {
    expect(existsSync(boundariesPath)).toBe(true);
    expect(existsSync(boundariesAiPath)).toBe(true);

    const adrReadme = readFileSync(adrReadmePath, "utf8");
    const adrReadmeAi = readFileSync(adrReadmeAiPath, "utf8");
    const recordsReadme = readFileSync(recordsReadmePath, "utf8");
    const recordsReadmeAi = readFileSync(recordsReadmeAiPath, "utf8");

    expect(adrReadme).toContain("./records/rollout-boundaries.md");
    expect(adrReadmeAi).toContain("./records/rollout-boundaries.ai.md");
    expect(recordsReadme).toContain("./rollout-boundaries.md");
    expect(recordsReadmeAi).toContain("./rollout-boundaries.ai.md");
  });

  it("keeps initial scope, non-exhaustive boundaries, and expansion areas explicit", () => {
    const boundaries = readFileSync(boundariesPath, "utf8");
    const boundariesAi = readFileSync(boundariesAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(boundaries).toContain(heading);
      expect(boundariesAi).toContain(heading);
    }

    for (const phrase of [
      "intentionally bounded",
      "not exhaustive",
      "does not require exhaustive",
      "Future ADR Expansion Areas",
      "considered complete",
      "new ADR when direction changes",
      "docs:validate:adr",
    ]) {
      expect(boundaries.toLowerCase()).toContain(phrase.toLowerCase());
      expect(boundariesAi.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });
});
