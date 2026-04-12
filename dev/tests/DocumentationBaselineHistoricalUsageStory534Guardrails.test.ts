import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 5.3.4 baseline and historical usage guidance guardrails", () => {
  it("keeps human and AI contributor guidance docs present and linked from contributor routers", () => {
    const guideMd = "docs/contributors/baseline-and-historical-material-usage-guide.md";
    const guideAi = "docs/contributors/baseline-and-historical-material-usage-guide.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    expect(contributorsReadme).toContain("./baseline-and-historical-material-usage-guide.md");
    expect(contributorsReadmeAi).toContain("./baseline-and-historical-material-usage-guide.ai.md");
  });

  it("keeps practical workflow guidance for implementation, design review, and ai prompt construction", () => {
    const human = read("docs/contributors/baseline-and-historical-material-usage-guide.md");
    const ai = read("docs/contributors/baseline-and-historical-material-usage-guide.ai.md");

    for (const content of [human, ai]) {
      expect(content).toContain("## Active-First Rule");
      expect(content).toContain("### Implementation Tasks");
      expect(content).toContain("### Design Reviews");
      expect(content).toContain("### AI Prompt Construction");
      expect(content).toContain("Use it when");
      expect(content).toContain("Do not use it when");
    }
  });

  it("keeps historical material explicitly non-authoritative and aligned to routing contracts", () => {
    const human = read("docs/contributors/baseline-and-historical-material-usage-guide.md");
    const ai = read("docs/contributors/baseline-and-historical-material-usage-guide.ai.md");

    for (const content of [human, ai]) {
      expect(content).toContain("non-authoritative");
      expect(content).toContain("docs/baselines/");
      expect(content).toContain("task-to-context-routing.contract.json");
      expect(content).toContain("task-to-context-routing.seed.json");
      expect(content).toContain("docs/context/context-map.json");
      expect(content).toContain("docs/context/prompt-routing");
      expect(content).toContain("exclude");
      expect(content).toContain("conflict");
    }

    expect(human).toContain("Baselines, Transitional Notes, and Superseded Documents: Quick Decision Table");
    expect(ai).toContain("## Quick Decision Table");
  });
});
