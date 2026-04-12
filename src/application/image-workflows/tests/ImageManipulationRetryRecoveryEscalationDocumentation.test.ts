import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-manipulation-retry-recovery-escalation-contracts.md");
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-retry-recovery-escalation-contracts.ai.md",
);
const readmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const readmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image manipulation retry/recovery/escalation documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents retry/recovery/escalation categories and required contract fields", () => {
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toContain("retrySafe");
    expect(doc).toContain("retryAfterMs");
    expect(doc).toContain("userActionRequired");
    expect(doc).toContain("backendRecoveryPending");
    expect(doc).toContain("terminalNotRetryable");
    expect(doc).toContain("operator");
    expect(doc).toContain("admin");
  });

  it("keeps architecture indexes discoverable for retry/recovery/escalation guidance", () => {
    const readme = readFileSync(readmePath, "utf8");
    const readmeAi = readFileSync(readmeAiPath, "utf8");

    expect(readme).toContain("image-manipulation-retry-recovery-escalation-contracts.md");
    expect(readmeAi).toContain("image-manipulation-retry-recovery-escalation-contracts.md");
  });
});
