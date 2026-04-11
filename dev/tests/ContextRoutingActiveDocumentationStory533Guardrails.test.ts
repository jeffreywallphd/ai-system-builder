import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 5.3.3 active-documentation routing guardrails", () => {
  it("keeps feature-decomposition routing active-first and historical context opt-in", () => {
    const seed = JSON.parse(read("docs/context/routing/task-to-context-routing.seed.json")) as {
      routingExamples: Array<{
        taskId: string;
        expectedRelatedDocOrder: string[];
        expectedExclusions: string[];
      }>;
      mappings: Array<{
        taskId: string;
        routingInputs: { changedPaths: string[]; exclusions: string[] };
        relatedDocPaths: string[];
      }>;
    };

    const decompositionExample = seed.routingExamples.find(
      (example) => example.taskId === "example-feature-decomposition-context-engineering",
    );
    expect(decompositionExample).toBeDefined();
    expect(decompositionExample?.expectedRelatedDocOrder).toContain("docs/architecture/README.md");
    expect(decompositionExample?.expectedRelatedDocOrder).toContain(
      "docs/context/documentation-segmentation-taxonomy.md",
    );
    expect(decompositionExample?.expectedRelatedDocOrder).not.toContain("docs/baselines/README.md");
    expect(decompositionExample?.expectedExclusions).toContain("docs/baselines/README.md");

    const decompositionMapping = seed.mappings.find(
      (mapping) => mapping.taskId === "feature-decomposition-epic-story-planning",
    );
    expect(decompositionMapping).toBeDefined();
    expect(decompositionMapping?.routingInputs.changedPaths).not.toContain("docs/baselines");
    expect(decompositionMapping?.relatedDocPaths).not.toContain("docs/baselines/README.md");
    expect(decompositionMapping?.routingInputs.exclusions).toContain(
      "baseline-and-historical-docs-unless-explicitly-requested",
    );
    expect(decompositionMapping?.routingInputs.exclusions).toContain(
      "superseded-pointer-docs-unless-target-of-task",
    );
  });

  it("keeps documentation refactor routing and pack catalog anchored to active docs by default", () => {
    const seed = JSON.parse(read("docs/context/routing/task-to-context-routing.seed.json")) as {
      routingExamples: Array<{ taskId: string; expectedExclusions: string[] }>;
      mappings: Array<{ taskId: string; routingInputs: { exclusions: string[] } }>;
    };
    const catalog = JSON.parse(read("docs/context/packs/context-pack-catalog.seed.json")) as {
      packs: Array<{ id: string; relatedDocPaths: string[] }>;
    };

    const documentationExample = seed.routingExamples.find(
      (example) => example.taskId === "example-documentation-routing-restructure",
    );
    expect(documentationExample).toBeDefined();
    expect(documentationExample?.expectedExclusions).toContain("docs/baselines/README.md");

    const documentationMapping = seed.mappings.find(
      (mapping) => mapping.taskId === "documentation-refactor-context-and-architecture",
    );
    expect(documentationMapping).toBeDefined();
    expect(documentationMapping?.routingInputs.exclusions).toContain(
      "baseline-and-historical-docs-unless-explicitly-requested",
    );
    expect(documentationMapping?.routingInputs.exclusions).toContain(
      "superseded-pointer-docs-unless-target-of-task",
    );

    const documentationPack = catalog.packs.find((pack) => pack.id === "documentation-refactor");
    expect(documentationPack).toBeDefined();
    expect(documentationPack?.relatedDocPaths).toContain("docs/context/documentation-status-signals.md");
    expect(documentationPack?.relatedDocPaths).toContain(
      "docs/context/documentation-baseline-and-historical-folder-strategy.md",
    );
    expect(documentationPack?.relatedDocPaths).toContain(
      "docs/context/documentation-supersession-and-redirect-conventions.md",
    );
    expect(documentationPack?.relatedDocPaths).not.toContain("docs/documentation-migration-baseline.md");
  });

  it("documents baseline and superseded exclusions in routing guidance and context map", () => {
    const promptRouting = read("docs/context/prompt-routing.md");
    const promptRoutingAi = read("docs/context/prompt-routing.ai.md");
    const contextMap = JSON.parse(read("docs/context/context-map.json")) as {
      globalExclusionRules: string[];
      globalExclusionTags: Array<{ tagId: string }>;
    };

    for (const content of [promptRouting, promptRoutingAi]) {
      expect(content).toContain("baseline snapshots unless requested outcomes explicitly require historical evidence");
      expect(content).toContain(
        "superseded pointer docs unless the task is pointer maintenance, redirect validation, or migration traceability",
      );
    }

    expect(
      contextMap.globalExclusionRules.includes(
        "exclude baseline snapshots and superseded pointer docs by default unless historical evidence is explicitly required",
      ),
    ).toBe(true);
    const globalExclusionTagIds = new Set(contextMap.globalExclusionTags.map((tag) => tag.tagId));
    expect(globalExclusionTagIds.has("exclude-baseline-and-superseded-default")).toBe(true);
  });
});
