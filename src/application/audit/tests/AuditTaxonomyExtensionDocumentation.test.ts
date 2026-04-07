import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "audit-taxonomy-capture-boundaries-and-extension-rules.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "audit-taxonomy-capture-boundaries-and-extension-rules.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "audit-governance-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "audit-governance-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const governanceWorkflowDocPath = path.join(repoRoot, "docs", "governance-audit-review-workflows.md");
const governanceWorkflowAiDocPath = path.join(repoRoot, "docs", "governance-audit-review-workflows.ai.md");

describe("audit taxonomy extension documentation", () => {
  it("keeps architecture and contributor docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
    expect(existsSync(contributorDocPath)).toBeTrue();
    expect(existsSync(contributorAiDocPath)).toBeTrue();
  });

  it("documents taxonomy mapping, capture boundaries, mapping examples, and prohibited data patterns", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("## Canonical taxonomy and action namespaces");
    expect(doc).toContain("## What must emit audit events");
    expect(doc).toContain("## Capture boundaries");
    expect(doc).toContain("## Use-case to audit-event mapping examples");
    expect(doc).toContain("## Data that must never be recorded");
    expect(doc).toContain("## Prohibited patterns");
    expect(doc).toContain("Writing audit records directly from UI code is prohibited.");
    expect(doc).toContain("Storing raw secrets or raw prompts in the ledger is prohibited.");
    expect(doc).toContain("resolveAuditCategoryForAction(...)");
    expect(doc).toContain("AuthoritativeAuditRecordingService");
  });

  it("documents contributor extension workflow and explicit no-go patterns", () => {
    const doc = readFileSync(contributorDocPath, "utf8");

    expect(doc).toContain("## Required implementation path");
    expect(doc).toContain("## Adding a new audit event type");
    expect(doc).toContain("## Capture boundary rules");
    expect(doc).toContain("## Data/content that must never be recorded");
    expect(doc).toContain("## Prohibited patterns");
    expect(doc).toContain("Writing canonical audit events directly from transport route handlers is prohibited.");
    expect(doc).toContain("Bypassing `AuthoritativeAuditRecordingService` for new canonical events is prohibited.");
  });

  it("keeps architecture and governance review docs discoverable for contributors", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const governanceDoc = readFileSync(governanceWorkflowDocPath, "utf8");
    const governanceAiDoc = readFileSync(governanceWorkflowAiDocPath, "utf8");

    expect(architectureReadme).toContain("audit-taxonomy-capture-boundaries-and-extension-rules.md");
    expect(architectureReadme).toContain("../audit-governance-contributor-guide.md");
    expect(architectureReadmeAi).toContain("docs/architecture/audit-taxonomy-capture-boundaries-and-extension-rules.md");
    expect(architectureReadmeAi).toContain("docs/audit-governance-contributor-guide.md");
    expect(governanceDoc).toContain("docs/audit-governance-contributor-guide.md");
    expect(governanceAiDoc).toContain("docs/audit-governance-contributor-guide.md");
  });

  it("references canonical implemented audit seams used by taxonomy and authoritative capture", () => {
    const requiredSeams = [
      "src/domain/audit/AuditDomain.ts",
      "src/application/audit/AuditApplicationContracts.ts",
      "src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts",
      "src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts",
      "src/application/audit/shared/AuditReferenceNormalization.ts",
      "src/shared/contracts/audit/AuditEventContracts.ts",
      "src/shared/dto/audit/AuditEventDtos.ts",
      "src/shared/schemas/audit/AuditEventSchemaContracts.ts",
      "src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts",
      "src/infrastructure/audit/AuthoritativeSchedulingGovernanceEventSink.ts",
      "src/infrastructure/audit/AuthoritativeStorageManagementAuditSink.ts",
      "src/infrastructure/audit/AuthoritativeSecretAccessAuditHook.ts",
      "src/ui/services/GovernanceAuditReviewService.ts",
    ];

    for (const seamPath of requiredSeams) {
      expect(existsSync(path.join(repoRoot, seamPath))).toBeTrue();
    }
  });

  it("keeps AI companion docs aligned to canonical extension guidance", () => {
    const architectureAiDoc = readFileSync(architectureAiDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");

    expect(architectureAiDoc).toContain(
      "docs/architecture/audit-taxonomy-capture-boundaries-and-extension-rules.md",
    );
    expect(architectureAiDoc).toContain("Never place raw secret/prompt/path/credential material");
    expect(contributorAiDoc).toContain("docs/audit-governance-contributor-guide.md");
    expect(contributorAiDoc).toContain("Emit new canonical audit events through authoritative recording ports/service.");
  });
});

