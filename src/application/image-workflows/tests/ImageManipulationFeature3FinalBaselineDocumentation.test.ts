import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-feature-3-final-baseline.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-feature-3-final-baseline.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image manipulation feature 3 final baseline documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents completion baseline, boundaries, support coverage, and follow-on dependencies", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Feature 3 Final Baseline: ComfyUI Execution Adapter and Translation Layer");
    expect(doc).toContain("## What Feature 3 provides");
    expect(doc).toContain("## Consumption contract for later features");
    expect(doc).toContain("Feature 4 (run orchestration)");
    expect(doc).toContain("Feature 5 (node-based execution)");
    expect(doc).toContain("Feature 6 (result persistence and lineage)");
    expect(doc).toContain("## Known limits and intentional non-goals");
    expect(doc).toContain("## Verification coverage and cross-references");
    expect(doc).toContain("ComfyUiTranslationDispatch.integration.test.ts");
    expect(doc).toContain("GetImageManipulationExecutionReadinessUseCase.test.ts");
    expect(doc).toContain("image-template:image-to-image-restyle:v1");
    expect(doc).toContain("image-template:enhance-upscale:v1");
    expect(doc).toContain("image-template:mask-guided-edit:v1");
  });

  it("keeps architecture indexes aligned with the Feature 3 final baseline doc", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("image-manipulation-feature-3-final-baseline.md");
    expect(readmeAi).toContain("docs/architecture/image-manipulation-feature-3-final-baseline.md");
  });

  it("keeps AI companion baseline doc anchored to canonical seams and readiness boundary", () => {
    const doc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("docs/architecture/image-manipulation-feature-3-final-baseline.md");
    expect(doc).toContain("ComfyUiExecutionAdapterComposition.ts");
    expect(doc).toContain("GetImageManipulationExecutionReadinessUseCase.ts");
    expect(doc).toContain("Feature 4 (run orchestration)");
    expect(doc).toContain("Feature 5 (node-based execution)");
    expect(doc).toContain("Feature 6 (result persistence/lineage)");
  });
});

