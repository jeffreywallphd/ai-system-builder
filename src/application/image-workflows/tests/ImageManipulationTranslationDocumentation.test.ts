import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-translation-contracts.md");
const aiDocPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-translation-contracts.ai.md");

describe("image manipulation translation contract documentation", () => {
  it("keeps human and AI companion translation docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents Feature 2 to backend-adapter translation boundary posture", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("Feature 2 workflow/system models remain the product source of truth");
    expect(doc).toContain("translation produces a separate internal execution payload");
    expect(doc).toContain("ComfyUI-specific transport/request/history DTOs stay outside these application contracts.");
  });
});
