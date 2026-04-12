import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type RegistrySeed = {
  entries: Array<{ recordId: string; path: string }>;
  discoveryIndex: {
    byDocType: Record<string, string[]>;
    byDomain: Record<string, string[]>;
    byStatus: Record<string, string[]>;
    byAuthoritativeness: Record<string, string[]>;
    byTaskCategory: Record<string, string[]>;
  };
};

describe("story 6.3.5 index-assisted discovery worked examples guardrails", () => {
  it("keeps worked examples docs present and routed from contributor and architecture navigation", () => {
    const guideMd = "docs/contributors/documentation-index-assisted-discovery-worked-examples.md";
    const guideAi = "docs/contributors/documentation-index-assisted-discovery-worked-examples.ai.md";

    expect(existsSync(resolve(repoRoot, guideMd))).toBe(true);
    expect(existsSync(resolve(repoRoot, guideAi))).toBe(true);

    const contributorsReadme = read("docs/contributors/README.md");
    const contributorsReadmeAi = read("docs/contributors/README.ai.md");
    const architectureReadme = read("docs/architecture/README.md");
    const architectureReadmeAi = read("docs/architecture/README.ai.md");

    expect(contributorsReadme).toContain("./documentation-index-assisted-discovery-worked-examples.md");
    expect(contributorsReadmeAi).toContain("./documentation-index-assisted-discovery-worked-examples.ai.md");
    expect(architectureReadme).toContain("../contributors/documentation-index-assisted-discovery-worked-examples.md");
    expect(architectureReadmeAi).toContain("../contributors/documentation-index-assisted-discovery-worked-examples.ai.md");
  });

  it("keeps examples practical for architecture, docs-refactor, decomposition, diagnostics, and security tasks", () => {
    const human = read("docs/contributors/documentation-index-assisted-discovery-worked-examples.md");
    const ai = read("docs/contributors/documentation-index-assisted-discovery-worked-examples.ai.md");

    for (const content of [human, ai]) {
      expect(content).toContain("## Usage Pattern");
      expect(content).toContain("## Worked Examples");
      expect(content).toContain("### Example 1: Architecture Review");
      expect(content).toContain("### Example 2: Documentation Refactor");
      expect(content).toContain("### Example 3: Feature Decomposition");
      expect(content).toContain("### Example 4: Runtime Troubleshooting");
      expect(content).toContain("### Example 5: Security-Sensitive Change");
      expect(content).toContain("Browse by Task Workflow");
      expect(content).toContain("Browse by Domain");
      expect(content).toContain("Browse by Status");
      expect(content).toContain("recordId");
      expect(content).toContain("taskId");
      expect(content).toContain("relatedDocRecordIds");
      expect(content).toContain("status");
      expect(content).toContain("authoritativeness");
      expect(content).toContain("active");
      expect(content).toContain("canonical");
      expect(content).toContain("superseded");
      expect(content).toContain("documentation-taxonomy");
      expect(content).toContain("task-to-context-routing.seed.json");
    }
  });

  it("keeps story 6.3.5 integration visible in registry guidance and seed indexes", () => {
    const recordId = "doc-contributors-documentation-index-assisted-discovery-worked-examples";
    const registryGuideHuman = read("docs/context/documentation-registry.md");
    const registryGuideAi = read("docs/context/documentation-registry.ai.md");

    expect(registryGuideHuman).toContain("## Worked Index-Assisted Discovery Examples Status (Story 6.3.5)");
    expect(registryGuideAi).toContain("## Worked Index-Assisted Discovery Examples Status (Story 6.3.5)");
    expect(registryGuideHuman).toContain("documentation-index-assisted-discovery-worked-examples.md");
    expect(registryGuideAi).toContain("documentation-index-assisted-discovery-worked-examples.ai.md");
    expect(registryGuideHuman).toContain("relatedDocRecordIds");
    expect(registryGuideAi).toContain("relatedDocRecordIds");

    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as RegistrySeed;
    const entry = registry.entries.find((candidate) => candidate.recordId === recordId);
    expect(entry).toBeDefined();
    expect(entry?.path).toBe("docs/contributors/documentation-index-assisted-discovery-worked-examples.md");

    expect(registry.discoveryIndex.byDocType["contributor-guide"]).toContain(recordId);
    expect(registry.discoveryIndex.byDomain.contributors).toContain(recordId);
    expect(registry.discoveryIndex.byStatus.active).toContain(recordId);
    expect(registry.discoveryIndex.byAuthoritativeness.canonical).toContain(recordId);

    for (const taskCategory of [
      "architecture-review",
      "feature-decomposition",
      "documentation-change",
      "diagnostics",
      "runtime-security",
    ] as const) {
      expect(registry.discoveryIndex.byTaskCategory[taskCategory]).toContain(recordId);
    }
  });
});
