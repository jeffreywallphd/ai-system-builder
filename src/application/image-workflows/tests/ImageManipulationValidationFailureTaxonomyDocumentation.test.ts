import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-validation-failure-taxonomy-foundation.md");
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-validation-failure-taxonomy-foundation.ai.md",
);

describe("image manipulation validation/failure taxonomy documentation", () => {
  it("keeps human and AI companion taxonomy docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents validation vs operational posture, retryability, and layer scope", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("asset-ingestion");
    expect(doc).toContain("workflow-configuration");
    expect(doc).toContain("run-readiness");
    expect(doc).toContain("execution-dispatch");
    expect(doc).toContain("node-availability");
    expect(doc).toContain("result-collection");
    expect(doc).toContain("preview-generation");
    expect(doc).toContain("protected-retrieval");
    expect(doc).toContain("validation");
    expect(doc).toContain("operational");
    expect(doc).toContain("retryable");
    expect(doc).toContain("terminal");
    expect(doc).toContain("userFixable");
    expect(doc).toContain("resolutionActor");
  });
});
