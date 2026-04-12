import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  readonly scripts?: Readonly<Record<string, string>>;
};

function readPackageScripts(): Readonly<Record<string, string>> {
  const packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as PackageJson;

  return packageJson.scripts ?? {};
}

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("story 7.3.1 documentation workflow integration guardrails", () => {
  it("integrates docs linting into practical repository workflow entry points", () => {
    const scripts = readPackageScripts();

    expect(scripts["docs:lint"]).toBe("node dev/scripts/lint-docs.cjs");
    expect(scripts["test:unit"]).toBe("bun test");
    expect(scripts.test).toBe("npm run docs:lint && npm run test:unit");
    expect(scripts.validate).toBe("npm run typecheck && npm run docs:lint");
    expect(scripts["validate:ci"]).toBe("npm run validate && npm run test:unit");
  });

  it("documents integrated docs quality entry points in contributor guidance", () => {
    const foundationGuide = read("docs/contributors/docs-foundation-validation.md");
    const foundationGuideAi = read("docs/contributors/docs-foundation-validation.ai.md");
    const standardsGuide = read("docs/contributors/documentation-quality-enforced-standards-guide.md");
    const standardsGuideAi = read("docs/contributors/documentation-quality-enforced-standards-guide.ai.md");

    for (const content of [foundationGuide, foundationGuideAi, standardsGuide, standardsGuideAi]) {
      expect(content).toContain("npm test");
      expect(content).toContain("npm run test:unit");
      expect(content).toContain("npm run validate");
      expect(content).toContain("npm run validate:ci");
    }
  });
});
