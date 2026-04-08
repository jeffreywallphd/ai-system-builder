import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-run-feature-4-epic-4.1-authoritative-orchestration-posture.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image run feature 4 epic 4.1 posture documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents authoritative submission, orchestration, and boundary guardrails", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 4.1.5");
    expect(doc).toContain("instead of direct studio-to-backend execution calls");
    expect(doc).toContain("Authoritative orchestration flow for image manipulation");
    expect(doc).toContain("Status normalization posture");
    expect(doc).toContain("Layer ownership boundaries");
    expect(doc).toContain("Direct studio-to-ComfyUI");
    expect(doc).toContain("Output discovery is handed off");
  });

  it("keeps architecture indexes aligned with the posture doc", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md");
    expect(readmeAi).toContain("docs/architecture/image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md");
  });

  it("keeps AI companion posture doc anchored to canonical run seams", () => {
    const doc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("docs/architecture/image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md");
    expect(doc).toContain("ValidateRunSubmissionUseCase.ts");
    expect(doc).toContain("CreateAuthoritativeRunUseCase.ts");
    expect(doc).toContain("ComfyUiRunExecutionDispatchAdapter.ts");
    expect(doc).toContain("Direct UI/studio dispatch to Comfy transport clients is prohibited");
  });
});
