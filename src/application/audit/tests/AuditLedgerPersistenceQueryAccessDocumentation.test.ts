import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "audit-ledger-persistence-query-and-access-control-architecture.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "audit-ledger-persistence-query-and-access-control-architecture.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");
const contributorDocPath = path.join(repoRoot, "docs", "audit-governance-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "audit-governance-contributor-guide.ai.md");
const governanceDocPath = path.join(repoRoot, "docs", "governance-audit-review-workflows.md");
const governanceAiDocPath = path.join(repoRoot, "docs", "governance-audit-review-workflows.ai.md");

describe("audit ledger persistence/query/access architecture documentation", () => {
  it("keeps canonical architecture docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents write path, read path, permission checks, redaction behavior, retention seams, and prohibited shortcuts", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("## Canonical write path (authoritative append workflow)");
    expect(doc).toContain("## Append invariants and immutable-enough safeguards");
    expect(doc).toContain("## Canonical read path (query and detail retrieval)");
    expect(doc).toContain("## Access-control and redacted view enforcement");
    expect(doc).toContain("## Correlation and linkage handling");
    expect(doc).toContain("## Retention/lifecycle seams and current limits");
    expect(doc).toContain("## Prohibited shortcuts");
    expect(doc).toContain("AuthoritativeAuditRecordingService");
    expect(doc).toContain("IAuditLedgerRepository.appendAuditEvent(...)");
    expect(doc).toContain("AuditLedgerQueryService");
    expect(doc).toContain("WorkspaceAuditLedgerReadAuthorizer");
    expect(doc).toContain("toAuditEventDetailView(...)");
    expect(doc).toContain("includeThinSafeOnly");
    expect(doc).toContain("metadata-only");
    expect(doc).toContain("destructive retention actions");
  });

  it("keeps architecture and contributor/governance docs discoverable for extension work", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");
    const contributorDoc = readFileSync(contributorDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");
    const governanceDoc = readFileSync(governanceDocPath, "utf8");
    const governanceAiDoc = readFileSync(governanceAiDocPath, "utf8");

    expect(architectureReadme).toContain("audit-ledger-persistence-query-and-access-control-architecture.md");
    expect(architectureReadmeAi).toContain("audit-ledger-persistence-query-and-access-control-architecture.md");
    expect(contributorDoc).toContain("audit-ledger-persistence-query-and-access-control-architecture.md");
    expect(contributorAiDoc).toContain("audit-ledger-persistence-query-and-access-control-architecture.md");
    expect(governanceDoc).toContain("audit-ledger-persistence-query-and-access-control-architecture.md");
    expect(governanceAiDoc).toContain("audit-ledger-persistence-query-and-access-control-architecture.md");
  });

  it("references implemented audit persistence/query/access seams for future extension", () => {
    const requiredSeams = [
      "src/application/audit/ports/AuditLedgerPersistencePorts.ts",
      "src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts",
      "src/application/audit/use-cases/AuditLedgerQueryService.ts",
      "src/application/audit/use-cases/WorkspaceAuditLedgerReadAuthorizer.ts",
      "src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts",
      "src/infrastructure/persistence/audit/SqliteAuditLedgerPersistenceMigrations.ts",
      "src/infrastructure/api/audit/AuditLedgerBackendApi.ts",
      "src/infrastructure/transport/http-server/authoritative-route-families/AuditAuthoritativeApiRoutes.ts",
      "src/shared/contracts/audit/AuditEventContracts.ts",
      "src/shared/dto/audit/AuditEventDtos.ts",
      "src/infrastructure/config/AuditRetentionLifecycleConfig.ts",
    ];

    for (const seamPath of requiredSeams) {
      expect(existsSync(path.join(repoRoot, seamPath))).toBeTrue();
    }
  });

  it("keeps AI companion guidance aligned to canonical human architecture guidance", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/audit-ledger-persistence-query-and-access-control-architecture.md");
    expect(aiDoc).toContain("appendAuditEvent(...)");
    expect(aiDoc).toContain("AuditLedgerQueryService");
    expect(aiDoc).toContain("WorkspaceAuditLedgerReadAuthorizer");
    expect(aiDoc).toContain("metadata-only");
  });
});

