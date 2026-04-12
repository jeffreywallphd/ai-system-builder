import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-feature-5-final-baseline.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-feature-5-final-baseline.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const runOrchestrationContributorDocPath = path.join(
  repoRoot,
  "docs",
  "run-orchestration-contributor-guide.md",
);
const runOrchestrationContributorAiDocPath = path.join(
  repoRoot,
  "docs",
  "run-orchestration-contributor-guide.ai.md",
);

describe("image manipulation feature 5 final baseline documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents completion state, boundaries, extension points, and known limits", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 5.4.4");
    expect(doc).toContain("## Feature 5 verification summary");
    expect(doc).toContain("## Canonical node domain and management model");
    expect(doc).toContain("## Authoritative node-management and execution routing flow locked by Feature 5");
    expect(doc).toContain("## API integration and audit posture");
    expect(doc).toContain("## Architectural boundaries and assumptions");
    expect(doc).toContain("## Follow-on integration dependencies");
    expect(doc).toContain("Feature 6: Result persistence, preview, and lineage");
    expect(doc).toContain("### Later administration and scheduling expansions");
    expect(doc).toContain("## Known limits and intentional non-goals");
    expect(doc).toContain("direct studio-to-ComfyUI");
    expect(doc).toContain("## Verification coverage and cross-references");
    expect(doc).toContain("ExecutionNodeManagementUseCases.test.ts");
    expect(doc).toContain("ExecutionNodeManagementBackendApi.test.ts");
    expect(doc).toContain("IdentityHttpServerExecutionNodeManagement.test.ts");
  });

  it("keeps architecture indexes discoverable for the final baseline doc", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("image-manipulation-feature-5-final-baseline.md");
    expect(readmeAi).toContain("docs/architecture/image-manipulation-feature-5-final-baseline.md");
  });

  it("keeps run orchestration contributor docs cross-referenced to the final baseline", () => {
    const runOrchestrationDoc = readFileSync(runOrchestrationContributorDocPath, "utf8");
    const runOrchestrationAiDoc = readFileSync(runOrchestrationContributorAiDocPath, "utf8");

    expect(runOrchestrationDoc).toContain("docs/architecture/image-manipulation-feature-5-final-baseline.md");
    expect(runOrchestrationAiDoc).toContain("docs/architecture/image-manipulation-feature-5-final-baseline.md");
  });

  it("keeps AI companion baseline doc anchored to canonical seams and guardrails", () => {
    const doc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("docs/architecture/image-manipulation-feature-5-final-baseline.md");
    expect(doc).toContain("ExecutionNodeManagementPorts.ts");
    expect(doc).toContain("ImageRunNodeEligibilityEvaluationService.ts");
    expect(doc).toContain("GetImageManipulationExecutionReadinessUseCase.ts");
    expect(doc).toContain("Direct studio-to-ComfyUI or implicit local-sidecar execution paths are prohibited.");
    expect(doc).toContain("Feature 6 (result persistence/preview/lineage)");
  });
});
