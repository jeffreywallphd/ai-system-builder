import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 7.1.6 contributor-facing standards guidance guardrails", () => {
  it("keeps contributor guidance docs present and discoverable from contributor routers", () => {
    expect(existsSync(resolve(repoRoot, "docs/contributors/documentation-quality-enforced-standards-guide.md"))).toBe(
      true,
    );
    expect(existsSync(resolve(repoRoot, "docs/contributors/documentation-quality-enforced-standards-guide.ai.md"))).toBe(
      true,
    );

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsAiReadme = read("docs/contributors/README.ai.md");
    const governanceReadme = read("docs/context/governance/README.md");
    const governanceAiReadme = read("docs/context/governance/README.ai.md");

    expect(contributorsReadme).toContain("./documentation-quality-enforced-standards-guide.md");
    expect(contributorsAiReadme).toContain("./documentation-quality-enforced-standards-guide.ai.md");
    expect(governanceReadme).toContain("../contributors/documentation-quality-enforced-standards-guide.md");
    expect(governanceAiReadme).toContain("../contributors/documentation-quality-enforced-standards-guide.ai.md");
  });

  it("keeps standards guidance practical and aligned with enforced rule groups and severity", () => {
    const human = read("docs/contributors/documentation-quality-enforced-standards-guide.md").toLowerCase();
    const ai = read("docs/contributors/documentation-quality-enforced-standards-guide.ai.md").toLowerCase();

    for (const content of [human, ai]) {
      for (const headingOrPhrase of [
        "canonical standard and scope",
        "workflow",
        "rule categories",
        "templates and examples",
        "interpreting common failure categories",
        "severity and review expectations",
      ]) {
        expect(content).toContain(headingOrPhrase);
      }

      for (const phrase of [
        "rule group 1",
        "rule group 2",
        "rule group 3",
        "rule group 4",
        "rule group 5",
        "`critical`",
        "`important`",
        "`advisory`",
        "frontmatter",
        "status",
        "authoritativeness",
        "routing",
        "cross-link",
        "readability",
      ]) {
        expect(content).toContain(phrase);
      }
    }
  });

  it("keeps commands, templates/examples, and common failure-code categories explicit", () => {
    const human = read("docs/contributors/documentation-quality-enforced-standards-guide.md");
    const ai = read("docs/contributors/documentation-quality-enforced-standards-guide.ai.md");

    for (const content of [human, ai]) {
      for (const command of [
        "npm run docs:validate:foundation",
        "npm run docs:validate:registry",
        "npm run docs:validate:adr",
        "npm run docs:validate:architecture-domains",
        "npm run docs:validate:segmentation",
      ]) {
        expect(content).toContain(command);
      }

      for (const path of [
        "docs/context/governance/documentation-quality-standard",
        "docs/context/templates/README",
        "docs/contributors/docs-placement-guide",
        "docs/contributors/router-overview-writing-standard",
        "docs/contributors/docs-foundation-validation",
      ]) {
        expect(content).toContain(path);
      }

      for (const signal of [
        "frontmatter_invalid",
        "header_enum_invalid",
        "seed_pair_mismatch",
        "status_signal_marker_missing",
        "active_path_reference_invalid",
        "supersession",
        "context_",
        "routing_",
        "registry_",
      ]) {
        // Keep failure category guidance resilient to code-list expansion while
        // still requiring stable references to common validator categories.
        expect(content.toLowerCase()).toContain(signal);
      }
    }
  });
});
