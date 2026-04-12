import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const humanGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.md");
const aiGuidePath = resolve(repoRoot, "docs/contributors/docs-placement-guide.ai.md");
const contributorsReadmePath = resolve(repoRoot, "docs/contributors/README.md");
const contributorsAiReadmePath = resolve(repoRoot, "docs/contributors/README.ai.md");

describe("docs placement guide guardrails", () => {
  it("keeps human and AI placement guides present", () => {
    expect(existsSync(humanGuidePath)).toBe(true);
    expect(existsSync(aiGuidePath)).toBe(true);
  });

  it("keeps contributor router readmes linked to the placement guide", () => {
    const contributorsReadme = readFileSync(contributorsReadmePath, "utf8");
    const contributorsAiReadme = readFileSync(contributorsAiReadmePath, "utf8");

    expect(contributorsReadme).toContain("./docs-placement-guide.md");
    expect(contributorsAiReadme).toContain("./docs-placement-guide.md");
  });

  it("enforces routing examples, anti-patterns, and decision flow anchors", () => {
    const humanGuide = readFileSync(humanGuidePath, "utf8");
    const aiGuide = readFileSync(aiGuidePath, "utf8");

    expect(humanGuide).toContain("## Simple Decision Flow");
    expect(humanGuide).toContain("## ADR Thresholds For Planned Changes");
    expect(humanGuide).toContain("## Placement Examples");
    expect(humanGuide).toContain("## Anti-Patterns to Avoid");
    expect(humanGuide).toContain("### ADR Required");
    expect(humanGuide).toContain("### ADR Recommended");
    expect(humanGuide).toContain("### ADR Unnecessary");
    expect(humanGuide).toContain("architectural invariant");
    expect(humanGuide).toContain("control-plane");
    expect(humanGuide).toContain("workspace model");
    expect(humanGuide).toContain("security trust boundaries");
    expect(humanGuide).toContain("storage policy");
    expect(humanGuide).toContain("studio/system modeling");
    expect(humanGuide).toContain("## Placement For Non-ADR Changes");
    expect(humanGuide).toContain("documentation-supersession-and-redirect-conventions.md");
    expect(aiGuide).toContain("## ADR Thresholds For Planned Changes");
    expect(aiGuide).toContain("### ADR Required");
    expect(aiGuide).toContain("### ADR Recommended");
    expect(aiGuide).toContain("### ADR Unnecessary");
    expect(aiGuide).toContain("architectural invariant");
    expect(aiGuide).toContain("control-plane");
    expect(aiGuide).toContain("workspace model");
    expect(aiGuide).toContain("security trust boundaries");
    expect(aiGuide).toContain("storage policy");
    expect(aiGuide).toContain("studio/system modeling");
    expect(aiGuide).toContain("### Placement For Non-ADR Changes");
    expect(aiGuide).toContain("documentation-supersession-and-redirect-conventions.ai.md");

    const requiredAreas = [
      "docs/architecture/",
      "docs/contributors/",
      "docs/operations/",
      "docs/baselines/",
      "docs/adr/",
      "docs/context/",
      "docs/prompts/",
      "docs/ui/",
    ];

    for (const area of requiredAreas) {
      expect(humanGuide).toContain(area);
    }

    const requiredExamples = [
      "Architecture explanation example",
      "Runbook example",
      "Historical baseline example",
      "ADR example",
      "AI-context document example",
    ];

    for (const example of requiredExamples) {
      expect(humanGuide).toContain(example);
    }
  });
});
