import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-execution-application-ports.md");
const aiDocPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-execution-application-ports.ai.md");

describe("image manipulation execution application-port documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents backend-agnostic boundaries and required execution responsibilities", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("ComfyUI (or any future runtime) as a replaceable infrastructure adapter.");
    expect(doc).toContain("Dispatch execution jobs");
    expect(doc).toContain("Query execution state");
    expect(doc).toContain("Query or stream progress");
    expect(doc).toContain("Request cancellation");
    expect(doc).toContain("Discover outputs");
    expect(doc).toContain("Check backend health and capabilities");
  });
});
