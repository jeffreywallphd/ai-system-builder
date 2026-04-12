import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const {
  buildDocumentationIndexMarkdown,
} = require("../scripts/generate-documentation-index-view.cjs") as {
  buildDocumentationIndexMarkdown: (
    registry: Record<string, unknown>,
    options?: { isAiCompanion?: boolean; useAiPaths?: boolean },
  ) => string;
};

const registryPath = resolve(repoRoot, "docs/context/documentation-registry.seed.json");
const humanIndexPath = resolve(repoRoot, "docs/context/documentation-index.md");
const aiIndexPath = resolve(repoRoot, "docs/context/documentation-index.ai.md");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("story 6.3.1 documentation index view guardrails", () => {
  it("keeps documentation index view artifacts present", () => {
    expect(existsSync(humanIndexPath)).toBe(true);
    expect(existsSync(aiIndexPath)).toBe(true);
    expect(existsSync(resolve(repoRoot, "dev/scripts/generate-documentation-index-view.cjs"))).toBe(true);
  });

  it("keeps human and AI index views in sync with the machine-readable registry", () => {
    const registry = readJson<Record<string, unknown>>(registryPath);
    const humanIndex = readFileSync(humanIndexPath, "utf8");
    const aiIndex = readFileSync(aiIndexPath, "utf8");

    const expectedHumanIndex = buildDocumentationIndexMarkdown(registry, {
      isAiCompanion: false,
      useAiPaths: false,
    });
    const expectedAiIndex = buildDocumentationIndexMarkdown(registry, {
      isAiCompanion: true,
      useAiPaths: true,
    });

    expect(humanIndex).toBe(expectedHumanIndex);
    expect(aiIndex).toBe(expectedAiIndex);
  });

  it("keeps the index view discoverable from root and context routers", () => {
    const docsReadme = readFileSync(resolve(repoRoot, "docs/README.md"), "utf8");
    const docsReadmeAi = readFileSync(resolve(repoRoot, "docs/README.ai.md"), "utf8");
    const contextReadme = readFileSync(resolve(repoRoot, "docs/context/README.md"), "utf8");
    const contextReadmeAi = readFileSync(resolve(repoRoot, "docs/context/README.ai.md"), "utf8");

    expect(docsReadme).toContain("./context/documentation-index.md");
    expect(docsReadmeAi).toContain("./context/documentation-index.ai.md");
    expect(contextReadme).toContain("./documentation-index.md");
    expect(contextReadmeAi).toContain("./documentation-index.ai.md");
  });
});
