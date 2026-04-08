import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "generated-result-authoritative-persistence-preview-lineage-posture.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "generated-result-authoritative-persistence-preview-lineage-posture.ai.md",
);

describe("result collection persistence handoff documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents Story 6.2.1 run-finalization handoff seams and failure posture", () => {
    const doc = readFileSync(architectureDocPath, "utf8");
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("Story 6.2.1 handoff baseline (implemented)");
    expect(doc).toContain("IRunCollectedResultPersistencePort");
    expect(doc).toContain("FinalizeRunExecutionOutcomeUseCase.ts");
    expect(doc).toContain("IngestRunExecutionUpdateUseCase.ts");
    expect(doc).toContain("resultPersistenceDiagnostics");

    expect(aiDoc).toContain("Story 6.2.1 handoff baseline (implemented)");
    expect(aiDoc).toContain("IRunCollectedResultPersistencePort");
    expect(aiDoc).toContain("FinalizeRunExecutionOutcomeUseCase.ts");
    expect(aiDoc).toContain("resultPersistenceDiagnostics");
  });
});
