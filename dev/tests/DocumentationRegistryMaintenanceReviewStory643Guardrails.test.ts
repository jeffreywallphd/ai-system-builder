import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 6.4.3 registry maintenance and review expectation guardrails", () => {
  it("documents realistic registry maintenance expectations in human and ai registry guides", () => {
    const human = read("docs/context/documentation-registry.md");
    const ai = read("docs/context/documentation-registry.ai.md");

    for (const content of [human, ai]) {
      expect(content).toContain("## Registry Maintenance and Review Expectations Status (Story 6.4.3)");
      expect(content).toContain("When Registry Entries Must Be Updated");
      expect(content).toMatch(/How .*New Documentation.*Registry/);
      expect(content).toContain("Who Should Care About Stale Entries");
      expect(content).toContain("Handling Superseded, Deprecated, and Historical Transitions");
      expect(content).toContain("relatedDocRecordIds");
      expect(content).toContain("team:developer-experience");
      expect(content).toContain("npm run docs:validate:registry");
      expect(content).toContain("npm run docs:generate:index-view");
      expect(content).toContain("status");
      expect(content).toContain("authoritativeness");
      expect(content).toContain("superseded");
      expect(content).toContain("archived");
      expect(content).toContain("historical");
      expect(content).toContain("active");
    }
  });

  it("keeps story 6.4.3 guardrail visibility in registry related code paths", () => {
    const human = read("docs/context/documentation-registry.md");
    const ai = read("docs/context/documentation-registry.ai.md");
    const testPath = "dev/tests/DocumentationRegistryMaintenanceReviewStory643Guardrails.test.ts";

    expect(human).toContain(testPath);
    expect(ai).toContain(testPath);
  });
});
