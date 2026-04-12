import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function section(content: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`${escapedHeading}\\n([\\s\\S]*?)(?:\\n## |\\n?$)`));
  return match?.[1] ?? "";
}

describe("story 5.3.1 active-path navigation guardrails", () => {
  it("keeps an active-first quick start section in root documentation routers", () => {
    const docsRoot = read("docs/README.md");
    const docsRootAi = read("docs/README.ai.md");

    for (const content of [docsRoot, docsRootAi]) {
      expect(content).toContain("## Active Documentation Quick Start");
      expect(content).toContain("./architecture/README");
      expect(content).toContain("./contributors/README");
      expect(content).toContain("./operations/README");
      expect(content).toContain("./context/README");
      expect(content).toContain("./ui/README");
      expect(content).toContain("./prompts/README");
      expect(content).toContain("./adr/README");
    }

    const quickStart = section(docsRoot, "## Active Documentation Quick Start");
    const quickStartAi = section(docsRootAi, "## Active Documentation Quick Start");
    expect(quickStart).not.toContain("./baselines/README");
    expect(quickStartAi).not.toContain("./baselines/README");
  });

  it("keeps baseline routing explicitly isolated as historical navigation", () => {
    const docsRoot = read("docs/README.md");
    const docsRootAi = read("docs/README.ai.md");

    expect(docsRoot).toContain("Historical and migration routers");
    expect(docsRootAi).toContain("Historical and migration routers");
    expect(docsRoot).toContain("[Baselines](./baselines/README.md)");
    expect(docsRootAi).toContain("[Baselines](./baselines/README.ai.md)");
    expect(docsRoot).toContain("default path active-first");
    expect(docsRootAi).toContain("default path active-first");
  });

  it("marks architecture, contributor, and operations routers as active authority entry points", () => {
    const pathsWithExpectedBaselineLinks = [
      ["docs/architecture/README.md", "../baselines/architecture/README.md"],
      ["docs/architecture/README.ai.md", "../baselines/architecture/README.ai.md"],
      ["docs/contributors/README.md", "../baselines/README.md"],
      ["docs/contributors/README.ai.md", "../baselines/README.ai.md"],
      ["docs/operations/README.md", "../baselines/README.md"],
      ["docs/operations/README.ai.md", "../baselines/README.ai.md"],
    ] as const;

    for (const [path, baselineLink] of pathsWithExpectedBaselineLinks) {
      const content = read(path);
      expect(content).toContain("## Active Authority Scope");
      expect(content).toContain("current");
      expect(content).toContain(baselineLink);
    }
  });
});
