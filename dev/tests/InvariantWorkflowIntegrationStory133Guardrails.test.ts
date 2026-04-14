import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  readonly scripts?: Readonly<Record<string, string>>;
};

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function readPackageScripts(): Readonly<Record<string, string>> {
  const packageJson = JSON.parse(read("package.json")) as PackageJson;
  return packageJson.scripts ?? {};
}

describe("story 1.3.3 invariant workflow and contributor guidance guardrails", () => {
  it("keeps invariant suites executable through standard test workflow entry points", () => {
    const scripts = readPackageScripts();

    expect(scripts["test:unit"]).toBe("bun test");
    expect(scripts.test).toBe("npm run docs:lint && npm run test:unit");
    expect(existsSync(resolve(process.cwd(), "src/testing/invariants/tests/InvariantFramework.test.ts"))).toBe(true);
    expect(
      existsSync(
        resolve(process.cwd(), "src/application/authorization/tests/AssetAuthorizationRuntimeComposedInvariantCoverage.test.ts"),
      ),
    ).toBe(true);
  });

  it("documents concrete invariant adoption guidance for permission-sensitive changes", () => {
    const guide = read("docs/unified-api-contributor-guide.md");
    const guideAi = read("docs/unified-api-contributor-guide.ai.md");
    const invariantReadme = read("src/testing/invariants/README.md");
    const foundationGuide = read("docs/contributors/docs-foundation-validation.md");
    const foundationGuideAi = read("docs/contributors/docs-foundation-validation.ai.md");

    for (const content of [guide, guideAi]) {
      expect(content).toContain("Permission-sensitive invariant");
      expect(content).toContain("When invariant");
      expect(content).toContain("How to add");
      expect(content).toContain("Choose test");
      expect(content).toContain("Permission-sensitive PR checklist");
      expect(content).toContain(
        "npm run test:unit -- src/testing/invariants/tests src/application/authorization/tests/*InvariantCoverage.test.ts",
      );
    }

    expect(invariantReadme).toContain("Workflow Integration");
    expect(invariantReadme).toContain("When Invariant Coverage Is Expected");
    expect(invariantReadme).toContain("Test Selection Guidance");
    expect(invariantReadme).toContain("Permission-Sensitive PR Checklist");

    for (const content of [foundationGuide, foundationGuideAi]) {
      expect(content).toContain(
        "npm run test:unit -- src/testing/invariants/tests src/application/authorization/tests/*InvariantCoverage.test.ts",
      );
    }
  });
});
