import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 7.3.3 contributor docs quality checks run-and-fix guidance guardrails", () => {
  it("keeps run-and-fix guidance docs present and discoverable from contributor routers", () => {
    expect(existsSync(resolve(repoRoot, "docs/contributors/documentation-quality-checks-run-and-fix-guide.md"))).toBe(
      true,
    );
    expect(
      existsSync(resolve(repoRoot, "docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md")),
    ).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsAiReadme = read("docs/contributors/README.ai.md");

    expect(contributorsReadme).toContain("./documentation-quality-checks-run-and-fix-guide.md");
    expect(contributorsAiReadme).toContain("./documentation-quality-checks-run-and-fix-guide.ai.md");
  });

  it("documents practical local execution commands and targeted check workflows", () => {
    const human = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.md");
    const ai = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md");

    for (const content of [human, ai]) {
      for (const command of [
        "npm run docs:lint",
        "npm run docs:lint -- --list-checks",
        "npm run docs:lint -- --check foundation",
        "npm run docs:lint -- --checks registry,segmentation",
        "npm run docs:lint -- --strict-important",
      ]) {
        expect(content).toContain(command);
      }

      expect(content.toLowerCase()).toContain("re-run only the");
      expect(content.toLowerCase()).toContain("file:");
    }
  });

  it("keeps failure category interpretation and fix references explicit", () => {
    const human = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.md").toLowerCase();
    const ai = read("docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md").toLowerCase();

    for (const content of [human, ai]) {
      for (const phrase of [
        "metadata and document shape",
        "status and supersession integrity",
        "cross-reference",
        "routing, adr, and architecture",
        "category-compliance",
        "readability",
        "`critical`",
        "`important`",
        "`advisory`",
      ]) {
        expect(content).toContain(phrase);
      }

      for (const signal of [
        "frontmatter_invalid",
        "status_signal_marker_missing",
        "supersession_",
        "routing_",
        "registry_",
        "category_",
        "read-",
      ]) {
        expect(content).toContain(signal);
      }

      for (const pathFragment of [
        "docs/context/governance/documentation-quality-standard",
        "docs/contributors/documentation-quality-enforced-standards-guide",
        "docs/contributors/docs-foundation-validation",
        "docs/context/templates/readme",
      ]) {
        expect(content).toContain(pathFragment);
      }
    }
  });
});
