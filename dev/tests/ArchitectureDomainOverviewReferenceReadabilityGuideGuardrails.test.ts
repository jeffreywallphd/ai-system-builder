import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanGuidePath = resolve(repoRoot, "docs/contributors/architecture-domain-overview-reference-readability-guide.md");
const aiGuidePath = resolve(repoRoot, "docs/contributors/architecture-domain-overview-reference-readability-guide.ai.md");
const contributorsReadmePath = resolve(repoRoot, "docs/contributors/README.md");
const contributorsAiReadmePath = resolve(repoRoot, "docs/contributors/README.ai.md");
const domainsReadmePath = resolve(repoRoot, "docs/architecture/domains/README.md");
const domainsAiReadmePath = resolve(repoRoot, "docs/architecture/domains/README.ai.md");

describe("architecture domain overview/reference readability guide guardrails", () => {
  it("keeps human and AI readability guides present and discoverable", () => {
    expect(existsSync(humanGuidePath)).toBe(true);
    expect(existsSync(aiGuidePath)).toBe(true);

    const contributorsReadme = readFileSync(contributorsReadmePath, "utf8");
    const contributorsAiReadme = readFileSync(contributorsAiReadmePath, "utf8");
    const domainsReadme = readFileSync(domainsReadmePath, "utf8");
    const domainsAiReadme = readFileSync(domainsAiReadmePath, "utf8");

    expect(contributorsReadme).toContain("./architecture-domain-overview-reference-readability-guide.md");
    expect(contributorsAiReadme).toContain("./architecture-domain-overview-reference-readability-guide.ai.md");
    expect(domainsReadme).toContain("../../contributors/architecture-domain-overview-reference-readability-guide.md");
    expect(domainsAiReadme).toContain("../../contributors/architecture-domain-overview-reference-readability-guide.md");
  });

  it("keeps role-specific readability guidance for overviews and references in both variants", () => {
    const humanGuide = readFileSync(humanGuidePath, "utf8");
    const aiGuide = readFileSync(aiGuidePath, "utf8");

    for (const anchor of [
      "## Scope",
      "## Document Role Distinction",
      "## Recommended Section Ordering",
      "### Domain Overview Section Order",
      "### Domain Reference Section Order",
      "## Brevity and Scannability Rules",
      "## Concept-First and Boundary Clarity Rules",
      "## Avoid Repeating ADR and Baseline Material",
      "## Editing Checklist",
      "## Related Documentation",
    ] as const) {
      expect(humanGuide).toContain(anchor);
      expect(aiGuide).toContain(anchor);
    }

    for (const roleSignal of [
      "overview.md",
      "references/README.md",
      "Do not collapse these roles into a single narrative document.",
      "route to references for contract detail",
      "endpoint payload tables",
      "runbook procedure flow",
      "one contract surface",
    ] as const) {
      expect(humanGuide).toContain(roleSignal);
      expect(aiGuide).toContain(roleSignal);
    }

    for (const readabilitySignal of [
      "concept-first",
      "boundary-first",
      "in scope",
      "out of scope",
      "handoff to neighboring domain",
      "ownership and dependency direction",
      "short orienting paragraph",
      "Prefer compact bullets over long prose blocks.",
    ] as const) {
      expect(humanGuide).toContain(readabilitySignal);
      expect(aiGuide).toContain(readabilitySignal);
    }

    for (const dedupSignal of [
      "docs/adr/records/",
      "docs/baselines/",
      "linked, not duplicated",
      "Do not copy ADR rationale history into overview or reference docs.",
      "Do not copy baseline snapshots into active domain docs.",
    ] as const) {
      expect(humanGuide).toContain(dedupSignal);
      expect(aiGuide).toContain(dedupSignal);
    }
  });
});

