import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-output-discovery-and-collection-contracts.md");
const aiDocPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-output-discovery-and-collection-contracts.ai.md");

describe("image manipulation output discovery and collection documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents temporary backend references, collected results, and logical asset separation", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("temporary backend references");
    expect(doc).toContain("discovered output descriptors");
    expect(doc).toContain("collected execution result");
    expect(doc).toContain("collectionFailure");
    expect(doc).toContain("Temporary references are separate from final logical asset records.");
    expect(doc).toContain("No backend filesystem path assumptions are exposed");
  });
});
