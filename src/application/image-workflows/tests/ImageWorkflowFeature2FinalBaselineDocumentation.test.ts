import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-workflow-feature-2-final-baseline.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-workflow-feature-2-final-baseline.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image workflow feature 2 final baseline documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents completion state, authoritative flow, and explicit follow-on dependencies", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Feature 2 Final Baseline: Image Workflow and System Definition Authority");
    expect(doc).toContain("Story 2.4.5");
    expect(doc).toContain("## Feature 2 verification summary");
    expect(doc).toContain("## Authoritative flow locked by Feature 2");
    expect(doc).toContain("## No placeholder authoring path guarantee");
    expect(doc).toContain("## Extension points and explicit follow-on dependencies");
    expect(doc).toContain("Feature 3 (ComfyUI execution adapter/translation)");
    expect(doc).toContain("Feature 4 (run orchestration)");
    expect(doc).toContain("## Verification coverage and cross-references");
    expect(doc).toContain("ImageWorkflowSystemDefinitionAuthoringE2E.integration.test.ts");
    expect(doc).toContain("ImageManipulationStudioVerticalSlice.integration.test.ts");
  });

  it("keeps architecture indexes aligned with the Feature 2 final baseline doc", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("image-workflow-feature-2-final-baseline.md");
    expect(readmeAi).toContain("image-workflow-feature-2-final-baseline.md");
  });

  it("keeps AI companion baseline doc anchored to canonical seams and downstream dependencies", () => {
    const doc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("docs/architecture/image-workflow-feature-2-final-baseline.md");
    expect(doc).toContain("StudioShellBackendApi.ts");
    expect(doc).toContain("CreateImageSystemDefinitionUseCase.ts");
    expect(doc).toContain("InitialSupportedImageWorkflowTemplateRegistry.ts");
    expect(doc).toContain("Feature 3 (execution adapter/translation)");
    expect(doc).toContain("Feature 4 (run orchestration)");
    expect(doc).toContain("Feature 6 (result lineage/persistence)");
  });
});
