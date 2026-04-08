import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "image-manipulation-loading-status-conventions.md");
const aiDocPath = path.join(repoRoot, "docs", "image-manipulation-loading-status-conventions.ai.md");

describe("image manipulation operational messaging documentation", () => {
  it("keeps human and AI convention docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents backend outage, degraded node, and preview-delay messaging posture", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("no eligible node");
    expect(doc).toContain("temporary backend outage");
    expect(doc).toContain("degraded-but-runnable backend");
    expect(doc).toContain("Preview-delay scenarios");
    expect(doc).toContain("not UI-local inference");
  });
});

