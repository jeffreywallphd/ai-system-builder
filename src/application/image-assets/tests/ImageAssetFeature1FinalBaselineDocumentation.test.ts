import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-asset-feature-1-final-baseline.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-asset-feature-1-final-baseline.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image asset feature 1 final baseline documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents end-to-end readiness, known limits, extension points, and follow-on debt", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Feature 1 Final Baseline: Image Asset Ingestion and Storage Foundation");
    expect(doc).toContain("## Main user-visible ingestion flow");
    expect(doc).toContain("## End-to-end verification coverage");
    expect(doc).toContain("## No mock-only or placeholder-only path posture");
    expect(doc).toContain("## Known limits and extension points");
    expect(doc).toContain("## Prerequisites for Feature 2 and later slice work");
    expect(doc).toContain("## Explicit follow-on technical debt");
    expect(doc).toContain("IdentityHttpServerImageAssetManagement.test.ts");
    expect(doc).toContain("ReferenceImageFaceIdDatasetFlow.test.ts");
  });

  it("keeps architecture indexes aligned with the final baseline doc", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("image-asset-feature-1-final-baseline.md");
    expect(readmeAi).toContain("docs/architecture/image-asset-feature-1-final-baseline.md");
  });

  it("keeps AI companion baseline doc anchored to canonical seams", () => {
    const doc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("docs/architecture/image-asset-feature-1-final-baseline.md");
    expect(doc).toContain("StudioShellBackendApi.ts");
    expect(doc).toContain("IdentityHttpServerImageAssetManagement.test.ts");
    expect(doc).toContain("Feature 2 prerequisites");
  });
});
