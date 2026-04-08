import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-resilience-state-contracts.md");
const aiDocPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-resilience-state-contracts.ai.md");
const readmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const readmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image manipulation resilience-state contract documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents degraded, partial, blocked, and temporarily unavailable semantics", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("pending-recovery");
    expect(doc).toContain("temporarily-unavailable");
    expect(doc).toContain("workflow valid but no eligible node");
    expect(doc).toContain("run completed but result preview pending");
    expect(doc).toContain("asset present but retrieval temporarily unavailable");
    expect(doc).toContain("backend reachable but degraded");
  });

  it("keeps architecture indexes discoverable for resilience-state guidance", () => {
    const readme = readFileSync(readmePath, "utf8");
    const readmeAi = readFileSync(readmeAiPath, "utf8");

    expect(readme).toContain("image-manipulation-resilience-state-contracts.md");
    expect(readmeAi).toContain("image-manipulation-resilience-state-contracts.md");
  });
});
