import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

type ReviewTier = "routine" | "heightened";

type AdrRegistryRecord = {
  identifier: string;
  relatedDomains: string[];
  reviewTier: ReviewTier;
  humanDocPath: string;
  aiDocPath: string;
};

type AdrRegistry = {
  records: AdrRegistryRecord[];
};

const highRiskDomains = new Set([
  "control-plane",
  "runtime-host-composition",
  "workspace-tenancy",
  "ownership",
  "authorization",
  "identity-security",
  "transport-trust",
  "execution",
  "policy-enforcement",
]);

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("ADR high-risk review expectation guardrails", () => {
  it("keeps ADR router and template explicit about review tiers and high-risk review requirements", () => {
    const adrRouter = read("docs/adr/README.md");
    const adrRouterAi = read("docs/adr/README.ai.md");
    const template = read("docs/context/templates/adr.template.md");
    const templateAi = read("docs/context/templates/adr.template.ai.md");

    for (const doc of [adrRouter, adrRouterAi]) {
      expect(doc).toContain("## High-Risk ADR Review Expectations");
      expect(doc).toContain("review_tier");
      expect(doc).toContain("routine");
      expect(doc).toContain("heightened");
      expect(doc).toContain("### High-Risk ADR Classes");
      expect(doc).toContain("### Broader Architecture Review Triggers");
    }

    for (const doc of [template, templateAi]) {
      expect(doc).toContain("review_tier: routine");
      expect(doc).toContain("## Review Expectations");
      expect(doc).toContain("Risk Class");
      expect(doc).toContain("Required Reviewers");
      expect(doc).toContain("Broader Architecture Review Trigger");
      expect(doc).toContain("Recertification Cadence");
    }
  });

  it("keeps high-risk ADRs on heightened review tier with concrete review expectations", () => {
    const registry = JSON.parse(
      readFileSync(resolve(repoRoot, "docs/adr/records/adr-registry.json"), "utf8"),
    ) as AdrRegistry;

    const heightenedRecords = registry.records.filter((record) => record.reviewTier === "heightened");
    const routineRecords = registry.records.filter((record) => record.reviewTier === "routine");

    expect(heightenedRecords.length).toBeGreaterThan(0);
    expect(routineRecords.length).toBeGreaterThan(0);

    for (const record of heightenedRecords) {
      const hasHighRiskDomain = record.relatedDomains.some((domain) => highRiskDomains.has(domain));
      expect(hasHighRiskDomain).toBe(true);

      for (const docPath of [record.humanDocPath, record.aiDocPath]) {
        const doc = read(docPath);
        expect(doc).toContain("review_tier: heightened");
        expect(doc).toContain("## Review Expectations");
        expect(doc.toLowerCase()).toContain("risk class");
        expect(doc.toLowerCase()).toContain("required reviewers");
        expect(doc.toLowerCase()).toContain("broader architecture review trigger");
        expect(doc.toLowerCase()).toContain("recertification cadence");
      }
    }

    for (const record of routineRecords) {
      for (const docPath of [record.humanDocPath, record.aiDocPath]) {
        const doc = read(docPath);
        expect(doc).toContain("review_tier: routine");
      }
    }
  });
});
