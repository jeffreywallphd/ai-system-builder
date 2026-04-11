import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

type CoverageRule = {
  coverageMode: "required" | "selective" | "excluded";
  includePaths: string[];
  representation: string;
  expectedStatus: string[];
  expectedAuthoritativeness: string[];
};

type DocumentationRegistry = {
  coveragePolicy: {
    schemaVersion: string;
    canonicalHumanSpecPath: string;
    canonicalAiSpecPath: string;
    requiredCategories: string[];
    selectiveCategories: string[];
    excludedCategories: string[];
    categoryRules: Record<string, CoverageRule>;
  };
};

describe("story 6.1.5 documentation index coverage rules guardrails", () => {
  it("keeps canonical human and ai coverage rules docs present", () => {
    expect(existsSync(resolve(repoRoot, "docs/context/documentation-index-coverage-rules.md"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "docs/context/documentation-index-coverage-rules.ai.md"))).toBe(true);
  });

  it("keeps explicit required, selective, and excluded indexing boundaries", () => {
    const human = read("docs/context/documentation-index-coverage-rules.md");
    const ai = read("docs/context/documentation-index-coverage-rules.ai.md");

    for (const phrase of [
      "## Coverage Modes",
      "## Coverage Policy By Category",
      "Active architecture docs",
      "Active contributor docs",
      "Active operations docs",
      "Context packs",
      "ADR records",
      "Baselines and migration snapshots",
      "Superseded or historical",
      "Routers",
      "Templates",
      "AI companion duplicates",
      "## Inclusion Rules",
      "## Selective Indexing Rules",
      "## Exclusion Rules",
      "## Status and Authoritativeness Expectations",
      "## Registry Representation Rules",
      "coveragePolicy",
    ] as const) {
      expect(human).toContain(phrase);
    }

    for (const phrase of [
      "## Coverage Modes",
      "## Required Categories",
      "## Selective Categories",
      "## Excluded Categories",
      "## Status and Authority Rules",
      "## Registry Contract",
      "required",
      "selective",
      "excluded",
      "coveragePolicy",
    ] as const) {
      expect(ai).toContain(phrase);
    }
  });

  it("keeps coverage rules discoverable from root and context routers", () => {
    const docsReadme = read("docs/README.md");
    const docsReadmeAi = read("docs/README.ai.md");
    const contextReadme = read("docs/context/README.md");
    const contextReadmeAi = read("docs/context/README.ai.md");

    expect(docsReadme).toContain("./context/documentation-index-coverage-rules.md");
    expect(docsReadmeAi).toContain("./context/documentation-index-coverage-rules.ai.md");
    expect(contextReadme).toContain("./documentation-index-coverage-rules.md");
    expect(contextReadmeAi).toContain("./documentation-index-coverage-rules.ai.md");
  });

  it("keeps machine-readable category coverage policy in the registry seed", () => {
    const registry = JSON.parse(read("docs/context/documentation-registry.seed.json")) as DocumentationRegistry;
    const coveragePolicy = registry.coveragePolicy;

    expect(coveragePolicy.schemaVersion).toBe("1.0.0");
    expect(coveragePolicy.canonicalHumanSpecPath).toBe("docs/context/documentation-index-coverage-rules.md");
    expect(coveragePolicy.canonicalAiSpecPath).toBe("docs/context/documentation-index-coverage-rules.ai.md");
    expect(coveragePolicy.requiredCategories).toEqual(
      expect.arrayContaining([
        "active-architecture",
        "active-contributors",
        "active-operations",
        "context-packs",
        "adr-records",
      ]),
    );
    expect(coveragePolicy.selectiveCategories).toEqual(
      expect.arrayContaining([
        "baselines",
        "superseded-and-historical",
      ]),
    );
    expect(coveragePolicy.excludedCategories).toEqual(
      expect.arrayContaining([
        "router-readmes",
        "templates",
        "prompt-helpers",
        "ai-companion-duplicates",
      ]),
    );

    const allCategoryIds = [
      ...coveragePolicy.requiredCategories,
      ...coveragePolicy.selectiveCategories,
      ...coveragePolicy.excludedCategories,
    ];

    for (const categoryId of allCategoryIds) {
      const rule = coveragePolicy.categoryRules[categoryId];
      expect(rule).toBeDefined();
      if (!rule) {
        continue;
      }
      expect(["required", "selective", "excluded"]).toContain(rule.coverageMode);
      expect(rule.includePaths.length).toBeGreaterThan(0);
      expect(rule.representation.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(rule.expectedStatus)).toBe(true);
      expect(Array.isArray(rule.expectedAuthoritativeness)).toBe(true);
    }
  });
});
