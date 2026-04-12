import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 5.3.2 documentation status signals guardrails", () => {
  it("keeps canonical status signal guidance docs for human and ai paths", () => {
    const guideMd = "docs/context/documentation-status-signals.md";
    const guideAi = "docs/context/documentation-status-signals.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const human = read(guideMd);
    const ai = read(guideAi);

    for (const content of [human, ai]) {
      expect(content).toContain("## Standard Status Block");
      expect(content).toContain("## Required Interpretation Rules");
      expect(content).toContain("## Documentation Status");
      expect(content).toContain("Current guidance stance");
      expect(content).toContain("Canonical active path(s)");
      expect(content).toContain("Supersession Notice");
      expect(content).toContain("status");
      expect(content).toContain("authoritativeness");
    }
  });

  it("keeps status signal guidance discoverable from root, context, and contributor placement docs", () => {
    const docsReadme = read("docs/README.md");
    const docsReadmeAi = read("docs/README.ai.md");
    const contextReadme = read("docs/context/README.md");
    const contextReadmeAi = read("docs/context/README.ai.md");
    const placementGuide = read("docs/contributors/docs-placement-guide.md");
    const placementGuideAi = read("docs/contributors/docs-placement-guide.ai.md");
    const templatesReadme = read("docs/context/templates/README.md");
    const templatesReadmeAi = read("docs/context/templates/README.ai.md");

    expect(docsReadme).toContain("./context/documentation-status-signals.md");
    expect(docsReadmeAi).toContain("./context/documentation-status-signals.ai.md");
    expect(contextReadme).toContain("./documentation-status-signals.md");
    expect(contextReadmeAi).toContain("./documentation-status-signals.ai.md");
    expect(placementGuide).toContain("documentation-status-signals.md");
    expect(placementGuideAi).toContain("documentation-status-signals.ai.md");
    expect(templatesReadme).toContain("documentation-status-signals.md");
    expect(templatesReadmeAi).toContain("documentation-status-signals.ai.md");
  });

  it("keeps explicit documentation status blocks on baseline and migration anchor docs", () => {
    for (const path of [
      "docs/baselines/README.md",
      "docs/baselines/README.ai.md",
      "docs/baselines/architecture/README.md",
      "docs/baselines/architecture/README.ai.md",
      "docs/documentation-migration-baseline.md",
      "docs/documentation-migration-baseline.ai.md",
      "docs/documentation-segmentation-migration-inventory.md",
      "docs/documentation-segmentation-migration-inventory.ai.md",
    ] as const) {
      const content = read(path);
      expect(content).toContain("## Documentation Status");
      expect(content).toContain("Lifecycle status (`status`):");
      expect(content).toContain("Authority state (`authoritativeness`):");
      expect(content).toContain("Current guidance stance:");
      expect(content).toContain("Canonical active path(s):");
    }
  });
});
