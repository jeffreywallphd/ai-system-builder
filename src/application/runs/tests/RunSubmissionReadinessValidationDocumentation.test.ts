import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-submission-readiness-blocking-validation.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-submission-readiness-blocking-validation.ai.md",
);
const architectureReadmePath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "README.md",
);
const architectureReadmeAiPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "README.ai.md",
);

describe("run submission readiness validation documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents blocking readiness validation scope before queue admission", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 4.2.2");
    expect(doc).toContain("required asset-slot completeness");
    expect(doc).toContain("parameter validity");
    expect(doc).toContain("backend execution-readiness dependencies");
    expect(doc).toContain("prevent queue admission");
  });

  it("references canonical readiness validation seams", () => {
    const requiredSeams = [
      "src/application/image-workflows/ImageRunSubmissionReadinessValidationService.ts",
      "src/application/image-workflows/ImageRunSubmissionReadinessContracts.ts",
      "src/application/runs/use-cases/SubmitImageRunUseCase.ts",
      "src/application/image-workflows/ports/ImageRunOrchestrationPorts.ts",
      "src/hosts/server/IdentityServerHost.ts",
      "src/application/image-workflows/tests/ImageRunSubmissionReadinessValidationService.test.ts",
    ];

    for (const seamPath of requiredSeams) {
      expect(existsSync(path.join(repoRoot, seamPath))).toBeTrue();
    }
  });

  it("keeps architecture indexes aligned with readiness-validation docs", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("run-submission-readiness-blocking-validation.md");
    expect(readmeAi).toContain("docs/architecture/run-submission-readiness-blocking-validation.md");
  });
});
