import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const docPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-dispatch-result-lifecycle-progression.md",
);
const aiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-dispatch-result-lifecycle-progression.ai.md",
);

describe("run orchestration dispatch-result progression documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents adapter-backed authoritative integration scenarios for the image slice", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("Adapter-backed integration regression coverage");
    expect(doc).toContain("Story 4.3.5");
    expect(doc).toContain("RunOrchestrationAdapterBackedExecution.integration.test.ts");
    expect(doc).toContain("duplicate-dispatch guard");
    expect(doc).toContain("authoritative run records");
  });

  it("keeps AI companion guidance aligned to the integration-regression test scope", () => {
    const aiDoc = readFileSync(aiDocPath, "utf8");

    expect(aiDoc).toContain("Story 4.3.5 integration coverage extension");
    expect(aiDoc).toContain("RunOrchestrationAdapterBackedExecution.integration.test.ts");
    expect(aiDoc).toContain("dispatchAttemptAlreadyFinalized");
    expect(aiDoc).toContain("queue rows");
  });
});
