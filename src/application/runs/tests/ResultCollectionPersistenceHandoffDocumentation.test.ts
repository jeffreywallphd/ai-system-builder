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

  it("documents Story 6.2.2 concrete persistence structures and migration seams", () => {
    const doc = readFileSync(architectureDocPath, "utf8");
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("Story 6.2.2 concrete persistence baseline (implemented)");
    expect(doc).toContain("generated_result_records");
    expect(doc).toContain("generated_result_lineage_inputs");
    expect(doc).toContain("SqliteGeneratedResultPersistenceAdapter.ts");
    expect(doc).toContain("SqliteRunCollectedResultPersistenceAdapter.ts");

    expect(aiDoc).toContain("Story 6.2.2 concrete persistence baseline (implemented)");
    expect(aiDoc).toContain("generated_result_records");
    expect(aiDoc).toContain("generated_result_lineage_inputs");
    expect(aiDoc).toContain("SqliteGeneratedResultPersistenceAdapter.ts");
    expect(aiDoc).toContain("SqliteRunCollectedResultPersistenceAdapter.ts");
  });

  it("documents Story 6.2.5 result availability states and recovery assumptions", () => {
    const doc = readFileSync(architectureDocPath, "utf8");
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(doc).toContain("Story 6.2.5 result availability and collection-failure state handling (implemented)");
    expect(doc).toContain("pending-result");
    expect(doc).toContain("partially-collected");
    expect(doc).toContain("preview-pending");
    expect(doc).toContain("failed-collection");
    expect(doc).toContain("retry/recovery");

    expect(aiDoc).toContain("Story 6.2.5 result availability and collection-failure state handling (implemented)");
    expect(aiDoc).toContain("pending-result");
    expect(aiDoc).toContain("partially-collected");
    expect(aiDoc).toContain("preview-pending");
    expect(aiDoc).toContain("failed-collection");
    expect(aiDoc).toContain("retry/recovery");
  });
});
