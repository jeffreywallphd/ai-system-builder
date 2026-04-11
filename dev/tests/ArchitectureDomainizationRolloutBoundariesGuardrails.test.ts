import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const boundariesPath = resolve(repoRoot, "docs/architecture/architecture-domainization-rollout-boundaries.md");
const boundariesAiPath = resolve(
  repoRoot,
  "docs/architecture/architecture-domainization-rollout-boundaries.ai.md",
);
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureAiReadmePath = resolve(repoRoot, "docs/architecture/README.ai.md");
const migrationPath = resolve(repoRoot, "docs/architecture/architecture-migration-sequence-and-priority.md");
const migrationAiPath = resolve(
  repoRoot,
  "docs/architecture/architecture-migration-sequence-and-priority.ai.md",
);
const supersessionPath = resolve(
  repoRoot,
  "docs/architecture/architecture-supersession-and-retirement-governance.md",
);
const supersessionAiPath = resolve(
  repoRoot,
  "docs/architecture/architecture-supersession-and-retirement-governance.ai.md",
);

const requiredHeadings = [
  "## Scope and Intent",
  "## Initial Rollout Scope (What Is Included)",
  "## Explicit Non-Goals for Initial Rollout (What Is Not Included Yet)",
  "## Known Remaining Architecture Refactor Work",
  "## Definition of Complete for Initial Domainization Rollout",
  "## Follow-On Work (Prioritized)",
  "## Contributor Extension Rules for Remaining Work",
] as const;

describe("architecture domainization rollout boundaries guardrails", () => {
  it("keeps architecture rollout boundary docs present and discoverable from architecture routers", () => {
    expect(existsSync(boundariesPath)).toBe(true);
    expect(existsSync(boundariesAiPath)).toBe(true);

    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureAiReadme = readFileSync(architectureAiReadmePath, "utf8");
    const migration = readFileSync(migrationPath, "utf8");
    const migrationAi = readFileSync(migrationAiPath, "utf8");
    const supersession = readFileSync(supersessionPath, "utf8");
    const supersessionAi = readFileSync(supersessionAiPath, "utf8");

    for (const doc of [
      architectureReadme,
      architectureAiReadme,
      migration,
      migrationAi,
      supersession,
      supersessionAi,
    ]) {
      expect(doc).toContain("architecture-domainization-rollout-boundaries.md");
    }
  });

  it("keeps initial scope boundaries, known residual work, and completion criteria explicit", () => {
    const boundaries = readFileSync(boundariesPath, "utf8");
    const boundariesAi = readFileSync(boundariesAiPath, "utf8");

    for (const heading of requiredHeadings) {
      expect(boundaries).toContain(heading);
      expect(boundariesAi).toContain(heading);
    }

    for (const phrase of [
      "intentionally bounded",
      "not exhaustive",
      "materially improved",
      "usable now",
      "does not require exhaustive migration",
      "remaining refactor work is explicitly documented",
      "legacy link stubs",
      "follow-on stories",
    ]) {
      expect(boundaries.toLowerCase()).toContain(phrase.toLowerCase());
      expect(boundariesAi.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });
});
