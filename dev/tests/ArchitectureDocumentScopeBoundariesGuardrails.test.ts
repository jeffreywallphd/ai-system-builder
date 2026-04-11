import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanDocPath = resolve(repoRoot, "docs/architecture/architecture-document-scope-boundaries.md");
const aiDocPath = resolve(repoRoot, "docs/architecture/architecture-document-scope-boundaries.ai.md");
const architectureReadmePath = resolve(repoRoot, "docs/architecture/README.md");
const architectureAiReadmePath = resolve(repoRoot, "docs/architecture/README.ai.md");
const domainsReadmePath = resolve(repoRoot, "docs/architecture/domains/README.md");
const domainsAiReadmePath = resolve(repoRoot, "docs/architecture/domains/README.ai.md");

describe("architecture document scope boundaries guardrails", () => {
  it("keeps architecture scope boundary docs present and discoverable from architecture routers", () => {
    expect(existsSync(humanDocPath)).toBe(true);
    expect(existsSync(aiDocPath)).toBe(true);

    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureAiReadme = readFileSync(architectureAiReadmePath, "utf8");
    const domainsReadme = readFileSync(domainsReadmePath, "utf8");
    const domainsAiReadme = readFileSync(domainsAiReadmePath, "utf8");

    expect(architectureReadme).toContain("./architecture-document-scope-boundaries.md");
    expect(architectureAiReadme).toContain("./architecture-document-scope-boundaries.md");
    expect(domainsReadme).toContain("../architecture-document-scope-boundaries.md");
    expect(domainsAiReadme).toContain("../architecture-document-scope-boundaries.md");
  });

  it("keeps explicit scope rules, anti-patterns, and migration triage anchors in both variants", () => {
    const humanDoc = readFileSync(humanDocPath, "utf8");
    const aiDoc = readFileSync(aiDocPath, "utf8");

    for (const heading of [
      "## Architecture Scope Rules",
      "## Architecture Anti-Patterns and Corrective Actions",
      "## Migration Triage Rules for Later Stories",
      "## Where Non-Architecture Content Goes",
    ] as const) {
      expect(humanDoc).toContain(heading);
      expect(aiDoc).toContain(heading);
    }

    for (const signal of [
      "overloaded README files",
      "mixed historical and active guidance",
      "repeated design rationale",
      "implementation-specific sprawl",
      "docs/contributors/",
      "docs/operations/",
      "docs/baselines/",
      "docs/adr/records/",
      "docs/context/packs/",
      "Router overload",
      "Historical-active blend",
      "Runbook leakage",
      "Cross-domain contract duplication",
    ] as const) {
      expect(humanDoc).toContain(signal);
      expect(aiDoc).toContain(signal);
    }
  });
});
