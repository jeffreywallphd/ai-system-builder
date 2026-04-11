import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 6.3.4 contributor index daily-usage guidance guardrails", () => {
  it("keeps daily index usage guidance docs present and linked from active routers", () => {
    const guideMd = "docs/contributors/documentation-index-daily-usage-guide.md";
    const guideAi = "docs/contributors/documentation-index-daily-usage-guide.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    const architectureReadme = read("docs/architecture/README.md");
    const architectureReadmeAi = read("docs/architecture/README.ai.md");

    expect(contributorsReadme).toContain("./documentation-index-daily-usage-guide.md");
    expect(contributorsReadmeAi).toContain("./documentation-index-daily-usage-guide.ai.md");
    expect(architectureReadme).toContain("../contributors/documentation-index-daily-usage-guide.md");
    expect(architectureReadmeAi).toContain("../contributors/documentation-index-daily-usage-guide.ai.md");
  });

  it("keeps guidance practical for daily index usage and authority validation", () => {
    const human = read("docs/contributors/documentation-index-daily-usage-guide.md");
    const ai = read("docs/contributors/documentation-index-daily-usage-guide.ai.md");

    for (const content of [human, ai]) {
      expect(content).toContain("## When to Consult the Index");
      expect(content).toContain("## Daily Workflow");
      expect(content).toContain("Browse by Task Workflow");
      expect(content).toContain("Browse by Domain");
      expect(content).toContain("Browse by Status");
      expect(content).toContain("recordId");
      expect(content).toContain("status");
      expect(content).toContain("authoritativeness");
      expect(content).toContain("findability");
      expect(content).toContain("authority");
      expect(content).toContain("historical");
      expect(content).toContain("superseded");
      expect(content).toContain("active canonical");
      expect(content).toContain("## Prompt and Review");
    }
  });

  it("keeps story 6.3.4 integration visible in registry and contributor workflow guidance", () => {
    const registryHuman = read("docs/context/documentation-registry.md");
    const registryAi = read("docs/context/documentation-registry.ai.md");
    const contributorWorkflowHuman = read("docs/contributors/context-engineering-system-guide.md");
    const contributorWorkflowAi = read("docs/contributors/context-engineering-system-guide.ai.md");

    expect(registryHuman).toContain("## Contributor Index Usage Guidance Status (Story 6.3.4)");
    expect(registryAi).toContain("## Contributor Index Usage Guidance Status (Story 6.3.4)");
    expect(registryHuman).toContain("findability");
    expect(registryAi).toContain("findability");
    expect(registryHuman).toContain("authoritativeness");
    expect(registryAi).toContain("authoritativeness");

    expect(contributorWorkflowHuman).toContain("## Index-First Discovery in Daily Work (Story 6.3.4)");
    expect(contributorWorkflowAi).toContain("## Index-First Discovery in Daily Work (Story 6.3.4)");
    expect(contributorWorkflowHuman).toContain("documentation-index-daily-usage-guide.md");
    expect(contributorWorkflowAi).toContain("documentation-index-daily-usage-guide.ai.md");
  });
});
