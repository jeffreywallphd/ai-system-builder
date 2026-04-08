import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-run-feature-4-final-baseline.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-run-feature-4-final-baseline.ai.md",
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
const runSubmissionContributorDocPath = path.join(repoRoot, "docs", "run-submission-contributor-guide.md");
const runSubmissionContributorAiDocPath = path.join(
  repoRoot,
  "docs",
  "run-submission-contributor-guide.ai.md",
);

describe("image run feature 4 final baseline documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents completion state, boundaries, extension points, and known limits", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 4.4.4");
    expect(doc).toContain("## Feature 4 verification summary");
    expect(doc).toContain("## Canonical run domain and orchestration model");
    expect(doc).toContain("## Authoritative execution flow locked by Feature 4");
    expect(doc).toContain("## API integration and audit posture");
    expect(doc).toContain("## Architectural boundaries and assumptions");
    expect(doc).toContain("## Follow-on integration dependencies");
    expect(doc).toContain("Feature 5: Node-based execution and backend management");
    expect(doc).toContain("Feature 6: Result persistence, preview, and lineage");
    expect(doc).toContain("## Known limits and intentional non-goals");
    expect(doc).toContain("direct studio-to-ComfyUI");
    expect(doc).toContain("## Verification coverage and cross-references");
    expect(doc).toContain("RunOrchestrationLifecycleRegression.integration.test.ts");
    expect(doc).toContain("AuthoritativeRunSubmissionBackendApi.test.ts");
    expect(doc).toContain("IdentityHttpServerRunSubmissionApi.test.ts");
  });

  it("keeps architecture indexes aligned with the final baseline doc", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("image-run-feature-4-final-baseline.md");
    expect(readmeAi).toContain("docs/architecture/image-run-feature-4-final-baseline.md");
  });

  it("keeps run contributor guides cross-referenced to the final baseline", () => {
    const runOrchestrationDoc = readFileSync(runOrchestrationContributorDocPath, "utf8");
    const runOrchestrationAiDoc = readFileSync(runOrchestrationContributorAiDocPath, "utf8");
    const runSubmissionDoc = readFileSync(runSubmissionContributorDocPath, "utf8");
    const runSubmissionAiDoc = readFileSync(runSubmissionContributorAiDocPath, "utf8");

    expect(runOrchestrationDoc).toContain("docs/architecture/image-run-feature-4-final-baseline.md");
    expect(runOrchestrationAiDoc).toContain("docs/architecture/image-run-feature-4-final-baseline.md");
    expect(runSubmissionDoc).toContain("docs/architecture/image-run-feature-4-final-baseline.md");
    expect(runSubmissionAiDoc).toContain("docs/architecture/image-run-feature-4-final-baseline.md");
  });

  it("keeps AI companion baseline doc anchored to canonical seams and guardrails", () => {
    const doc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("docs/architecture/image-run-feature-4-final-baseline.md");
    expect(doc).toContain("ValidateRunSubmissionUseCase.ts");
    expect(doc).toContain("ProcessQueuedRunDispatchUseCase.ts");
    expect(doc).toContain("RequestAuthoritativeRunCancellationUseCase.ts");
    expect(doc).toContain("Direct studio-to-provider dispatch/progress/cancel paths are prohibited.");
    expect(doc).toContain("Feature 5 (node-based execution/backend management)");
    expect(doc).toContain("Feature 6 (result persistence/preview/lineage)");
  });
});
