import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-resilience-verification-matrix.md");
const aiDocPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-resilience-verification-matrix.ai.md");
const readmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const readmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image manipulation resilience verification matrix documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents representative degraded and failure scenarios", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("invalid upload request");
    expect(doc).toContain("incompatible saved system/runtime context");
    expect(doc).toContain("no eligible backend node");
    expect(doc).toContain("transient dispatch failure");
    expect(doc).toContain("cancelled run");
    expect(doc).toContain("missing output collection after completion");
    expect(doc).toContain("preview-generation delay/failure");
    expect(doc).toContain("protected retrieval unavailability");
  });

  it("keeps architecture indexes discoverable for resilience verification guidance", () => {
    const readme = readFileSync(readmePath, "utf8");
    const readmeAi = readFileSync(readmeAiPath, "utf8");

    expect(readme).toContain("image-manipulation-resilience-verification-matrix.md");
    expect(readmeAi).toContain("image-manipulation-resilience-verification-matrix.md");
  });
});
