import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-submission-pipeline-extension-guardrails.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "run-submission-pipeline-extension-guardrails.ai.md",
);
const contributorDocPath = path.join(
  repoRoot,
  "docs",
  "run-submission-contributor-guide.md",
);
const contributorAiDocPath = path.join(
  repoRoot,
  "docs",
  "run-submission-contributor-guide.ai.md",
);

describe("run submission pipeline documentation", () => {
  it("keeps architecture and contributor docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
    expect(existsSync(contributorDocPath)).toBeTrue();
    expect(existsSync(contributorAiDocPath)).toBeTrue();
  });

  it("documents authoritative pipeline, extension points, and prohibited shortcuts", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("## Authoritative pipeline");
    expect(doc).toContain("## Lifecycle and persistence expectations");
    expect(doc).toContain("## Extension points");
    expect(doc).toContain("## Prohibited shortcuts");
    expect(doc).toContain("Bypassing authoritative run creation is prohibited.");
    expect(doc).toContain("Embedding orchestration business rules directly inside UI or transport handlers is prohibited.");
  });

  it("documents contributor extension workflow for backends and run policies", () => {
    const doc = readFileSync(contributorDocPath, "utf8");

    expect(doc).toContain("## Required implementation path");
    expect(doc).toContain("## Adding a new execution backend");
    expect(doc).toContain("## Adding a new run type or policy gate");
    expect(doc).toContain("## Prohibited patterns");
    expect(doc).toContain("## Review checklist");
  });

  it("references canonical implemented run seams", () => {
    const requiredSeams = [
      "src/domain/runs/RunDomain.ts",
      "src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts",
      "src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts",
      "src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts",
      "src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts",
      "src/application/runs/use-cases/RunCreationPersistenceMapper.ts",
      "src/application/runs/ports/RunSubmissionValidationPorts.ts",
      "src/application/runs/ports/RunOrchestrationPersistencePorts.ts",
      "src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts",
      "src/infrastructure/api/runs/AssetBackedRunSubmissionTargetResolver.ts",
      "src/infrastructure/api/runs/PlatformRunSubmissionAuditSink.ts",
      "src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts",
      "src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts",
      "src/hosts/server/IdentityServerHost.ts",
    ];

    for (const seamPath of requiredSeams) {
      expect(existsSync(path.join(repoRoot, seamPath))).toBeTrue();
    }
  });

  it("keeps AI companion docs aligned to canonical guidance and prohibitions", () => {
    const architectureAiDoc = readFileSync(architectureAiDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureAiDoc).toContain("docs/architecture/run-submission-pipeline-extension-guardrails.md");
    expect(architectureAiDoc).toContain("Embedding orchestration business rules directly inside UI or transport handlers is prohibited.");
    expect(contributorAiDoc).toContain("docs/run-submission-contributor-guide.md");
    expect(contributorAiDoc).toContain("Bypassing authoritative run creation is prohibited.");
  });
});
