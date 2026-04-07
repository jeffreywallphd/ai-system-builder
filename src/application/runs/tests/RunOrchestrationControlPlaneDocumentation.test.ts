import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-queue-assignment-dispatch-control-plane.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-orchestration-queue-assignment-dispatch-control-plane.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "run-orchestration-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("run orchestration control-plane documentation", () => {
  it("keeps architecture and contributor docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
    expect(existsSync(contributorDocPath)).toBeTrue();
    expect(existsSync(contributorAiDocPath)).toBeTrue();
  });

  it("documents lifecycle model, scheduler boundary, invariants, and prohibited shortcuts", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("## End-to-end authoritative lifecycle");
    expect(doc).toContain("## Queue and assignment model");
    expect(doc).toContain("## Claim and dispatch model");
    expect(doc).toContain("## Progress ingestion and finalization model");
    expect(doc).toContain("## Scheduling-policy boundary and extension points");
    expect(doc).toContain("## Invariants future work must preserve");
    expect(doc).toContain("## Prohibited shortcuts");
    expect(doc).toContain("Scheduling policy selects *which claimed run/node pair to attempt next*.");
    expect(doc).toContain("Writing assignment, claim, dispatch-attempt, or lifecycle state directly from transport handlers is prohibited.");
  });

  it("documents contributor extension workflow for scheduler policy and backend integrations", () => {
    const doc = readFileSync(contributorDocPath, "utf8");

    expect(doc).toContain("## Required implementation path");
    expect(doc).toContain("## Extending scheduler policy");
    expect(doc).toContain("## Extending backend dispatch integrations");
    expect(doc).toContain("## Extending progress ingestion and finalization");
    expect(doc).toContain("## Invariants and non-negotiable boundaries");
    expect(doc).toContain("## Prohibited patterns");
    expect(doc).toContain("## Review checklist");
  });

  it("references canonical implemented queue-assignment-dispatch seams", () => {
    const requiredSeams = [
      "src/domain/runs/RunDomain.ts",
      "src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts",
      "src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts",
      "src/application/runs/ports/RunOrchestrationPersistencePorts.ts",
      "src/application/runs/ports/RunAssignmentEligibilityPorts.ts",
      "src/application/runs/ports/RunExecutionDispatchPorts.ts",
      "src/application/runs/use-cases/SelectAssignmentReadyRunsUseCase.ts",
      "src/application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase.ts",
      "src/application/runs/use-cases/DispatchAssignedRunExecutionUseCase.ts",
      "src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts",
      "src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts",
      "src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts",
      "src/infrastructure/execution/runs/RunExecutionDispatchRouter.ts",
      "src/infrastructure/api/runs/AuthoritativeRunExecutionUpdateBackendApi.ts",
      "src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts",
    ];

    for (const seamPath of requiredSeams) {
      expect(existsSync(path.join(repoRoot, seamPath))).toBeTrue();
    }
  });

  it("keeps architecture index discoverability updated for new control-plane docs", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("run-orchestration-queue-assignment-dispatch-control-plane.md");
    expect(readme).toContain("../run-orchestration-contributor-guide.md");
    expect(readmeAi).toContain("run-orchestration-queue-assignment-dispatch-control-plane.md");
    expect(readmeAi).toContain("docs/run-orchestration-contributor-guide.md");
  });

  it("keeps AI companion docs aligned to canonical guidance and boundaries", () => {
    const architectureAiDoc = readFileSync(architectureAiDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureAiDoc).toContain("docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md");
    expect(architectureAiDoc).toContain("Scheduling policy decides which lease-claimed run/node pair should be attempted.");
    expect(contributorAiDoc).toContain("docs/run-orchestration-contributor-guide.md");
    expect(contributorAiDoc).toContain("Bypassing authoritative node claim use case before dispatch is prohibited.");
  });
});
