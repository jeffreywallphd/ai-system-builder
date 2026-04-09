import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-feature-8-final-vertical-slice-completion.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-feature-8-final-vertical-slice-completion.ai.md",
);
const crossFeatureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-feature-8-cross-feature-operational-guidance.md",
);
const matrixDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-resilience-verification-matrix.md",
);
const readmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const readmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image manipulation feature 8 final vertical-slice completion documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents completion scope, explicit deferrals, and extension guidance", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("Feature 8 is complete for the image manipulation vertical slice");
    expect(doc).toContain("## Full-slice completion map (Features 1-8)");
    expect(doc).toContain("## Production-readiness boundaries");
    expect(doc).toContain("## Representative verification anchors");
    expect(doc).toContain("## Intentionally deferred and extension points");
    expect(doc).toContain("## Hidden placeholder assumption audit");
    expect(doc).toContain("No hidden placeholder assumptions are required");
    expect(doc).toContain("ImageManipulationFailurePaths.integration.test.ts");
    expect(doc).toContain("ImageManipulationStudioVerticalSlice.integration.test.ts");
  });

  it("keeps related feature 8 operations docs aligned to the final completion note", () => {
    const crossFeatureDoc = readFileSync(crossFeatureDocPath, "utf8");
    const matrixDoc = readFileSync(matrixDocPath, "utf8");

    expect(crossFeatureDoc).toContain("image-manipulation-feature-8-final-vertical-slice-completion.md");
    expect(matrixDoc).toContain("image-manipulation-feature-8-final-vertical-slice-completion.md");
  });

  it("keeps architecture indexes discoverable for the final completion note", () => {
    const readme = readFileSync(readmePath, "utf8");
    const readmeAi = readFileSync(readmeAiPath, "utf8");

    expect(readme).toContain("image-manipulation-feature-8-final-vertical-slice-completion.md");
    expect(readmeAi).toContain("image-manipulation-feature-8-final-vertical-slice-completion.md");
  });
});

