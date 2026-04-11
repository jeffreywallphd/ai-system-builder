import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 5.3.5 active-vs-historical worked examples guardrails", () => {
  it("keeps human and AI worked example guides present and routed from active routers", () => {
    const guideMd = "docs/contributors/active-vs-historical-docs-worked-examples.md";
    const guideAi = "docs/contributors/active-vs-historical-docs-worked-examples.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    const architectureReadme = read("docs/architecture/README.md");
    const architectureReadmeAi = read("docs/architecture/README.ai.md");

    expect(contributorsReadme).toContain("./active-vs-historical-docs-worked-examples.md");
    expect(contributorsReadmeAi).toContain("./active-vs-historical-docs-worked-examples.ai.md");
    expect(architectureReadme).toContain("../contributors/active-vs-historical-docs-worked-examples.md");
    expect(architectureReadmeAi).toContain("../contributors/active-vs-historical-docs-worked-examples.ai.md");
  });

  it("keeps repository-specific task examples showing active-first and historical isolation behavior", () => {
    const human = read("docs/contributors/active-vs-historical-docs-worked-examples.md");
    const ai = read("docs/contributors/active-vs-historical-docs-worked-examples.ai.md");

    for (const content of [human, ai]) {
      expect(content).toContain("## Usage Pattern");
      expect(content).toContain("## Worked Examples");
      expect(content).toContain("### Example 1: Feature Decomposition");
      expect(content).toContain("### Example 2: Architecture Review");
      expect(content).toContain("### Example 3: Migration Planning");
      expect(content).toContain("### Example 4: Runtime Troubleshooting");
      expect(content).toContain("Start with active docs");
      expect(content).toContain("Consult baselines only if");
      expect(content).toContain("Keep excluded by default");
      expect(content).toContain("docs/baselines/");
      expect(content).toContain("superseded");
      expect(content).toContain("transition");
      expect(content).toContain("## Quick Decision Matrix");
      expect(content).toContain("## Prompt and Review Notes");
      expect(content).toContain("run-lifecycle-state-authority");
      expect(content).toContain("identity-trust-and-security");
      expect(content).toContain("documentation-segmentation-taxonomy");
      expect(content).toContain("unified-api-observability-troubleshooting");
    }
  });
});
