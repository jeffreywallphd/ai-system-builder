import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-execution-status-contracts.md");
const aiDocPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-execution-status-contracts.ai.md");

describe("image manipulation execution status documentation", () => {
  it("keeps human and AI companion status docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents normalized states, partial-progress handling, and safe failure semantics", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("queued");
    expect(doc).toContain("preparing");
    expect(doc).toContain("running");
    expect(doc).toContain("completed");
    expect(doc).toContain("failed");
    expect(doc).toContain("cancelled");
    expect(doc).toContain("partial-output");
    expect(doc).toContain("retryability");
    expect(doc).toContain("Raw ComfyUI queue/history DTOs remain infrastructure-only.");
  });
});
