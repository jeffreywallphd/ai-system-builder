import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const guidePath = resolve(repoRoot, "docs/contributors/docs-foundation-validation.md");
const guideAiPath = resolve(repoRoot, "docs/contributors/docs-foundation-validation.ai.md");
const contributorsReadmePath = resolve(repoRoot, "docs/contributors/README.md");
const contributorsAiReadmePath = resolve(repoRoot, "docs/contributors/README.ai.md");
const packageJsonPath = resolve(repoRoot, "package.json");

describe("documentation foundation validation guide guardrails", () => {
  it("keeps docs foundation validation guides present", () => {
    expect(existsSync(guidePath)).toBe(true);
    expect(existsSync(guideAiPath)).toBe(true);
  });

  it("keeps contributor routers linked to the validation guides", () => {
    const contributorsReadme = readFileSync(contributorsReadmePath, "utf8");
    const contributorsAiReadme = readFileSync(contributorsAiReadmePath, "utf8");

    expect(contributorsReadme).toContain("./docs-foundation-validation.md");
    expect(contributorsAiReadme).toContain("./docs-foundation-validation.ai.md");
  });

  it("documents and wires the local and CI validation command", () => {
    const guide = readFileSync(guidePath, "utf8");
    const guideAi = readFileSync(guideAiPath, "utf8");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(guide).toContain("npm run docs:lint");
    expect(guideAi).toContain("npm run docs:lint");
    expect(guide).toContain("npm run docs:validate:foundation");
    expect(guideAi).toContain("npm run docs:validate:foundation");
    expect(guide).toContain("npm run docs:validate:segmentation");
    expect(guideAi).toContain("npm run docs:validate:segmentation");
    expect(guide).toContain("## CI Usage");
    expect(guideAi).toContain("## CI Contract");
    expect(packageJson.scripts?.["docs:lint"]).toBe(
      "node dev/scripts/lint-docs.cjs",
    );
    expect(packageJson.scripts?.["docs:validate:foundation"]).toBe(
      "node dev/scripts/validate-docs-foundation.cjs",
    );
    expect(packageJson.scripts?.["docs:validate:segmentation"]).toBe(
      "node dev/scripts/validate-docs-segmentation.cjs",
    );
  });
});
