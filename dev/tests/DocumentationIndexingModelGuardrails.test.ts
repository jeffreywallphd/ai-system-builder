import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("story 6.1.1 documentation indexing model guardrails", () => {
  it("keeps canonical human and ai indexing model docs present", () => {
    expect(existsSync(resolve(repoRoot, "docs/context/documentation-indexing-model.md"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "docs/context/documentation-indexing-model.ai.md"))).toBe(true);
  });

  it("keeps explicit indexing model goals, boundaries, and relationships", () => {
    const human = read("docs/context/documentation-indexing-model.md");
    const ai = read("docs/context/documentation-indexing-model.ai.md");

    for (const phrase of [
      "## Discovery Problems This Model Solves",
      "## Indexing Model",
      "## Goals",
      "## Non-Goals and Complexity Boundaries",
      "## Relationship to Taxonomy, Routing, and Context Packs",
      "folder structure",
      "metadata headers",
      "registry",
      "routing",
      "context packs",
      "does not replace",
      "lightweight",
    ] as const) {
      expect(human).toContain(phrase);
    }

    for (const phrase of [
      "## Model Summary",
      "## Core Goals",
      "## Discovery Problems Addressed",
      "## Relationship Contract",
      "## Non-Goals",
      "## Complexity Target",
      "Folder structure remains primary organization.",
      "Routing and context packs consume indexed signals; they are not replaced by indexing.",
    ] as const) {
      expect(ai).toContain(phrase);
    }
  });

  it("keeps indexing model discoverable from root and context routers", () => {
    const docsReadme = read("docs/README.md");
    const docsReadmeAi = read("docs/README.ai.md");
    const contextReadme = read("docs/context/README.md");
    const contextReadmeAi = read("docs/context/README.ai.md");

    expect(docsReadme).toContain("./context/documentation-indexing-model.md");
    expect(docsReadmeAi).toContain("./context/documentation-indexing-model.ai.md");
    expect(contextReadme).toContain("./documentation-indexing-model.md");
    expect(contextReadmeAi).toContain("./documentation-indexing-model.ai.md");
  });
});
