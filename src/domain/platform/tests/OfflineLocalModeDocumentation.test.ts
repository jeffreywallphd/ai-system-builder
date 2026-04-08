import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "offline-local-mode-authority-boundaries.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "offline-local-mode-authority-boundaries.ai.md",
);
const syncContractsDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "offline-sync-shared-contracts.md",
);
const auditOperationalHooksDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "offline-local-mode-audit-operational-hooks.md",
);
const auditOperationalHooksAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "offline-local-mode-audit-operational-hooks.ai.md",
);
const contributorDocPath = path.join(repoRoot, "docs", "offline-local-mode-contributor-guide.md");
const contributorAiDocPath = path.join(repoRoot, "docs", "offline-local-mode-contributor-guide.ai.md");
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("offline local-mode documentation guidance", () => {
  it("keeps architecture and contributor offline docs checked in with AI companion docs", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
    expect(existsSync(auditOperationalHooksDocPath)).toBeTrue();
    expect(existsSync(auditOperationalHooksAiDocPath)).toBeTrue();
    expect(existsSync(contributorDocPath)).toBeTrue();
    expect(existsSync(contributorAiDocPath)).toBeTrue();
  });

  it("documents offline philosophy, authority boundaries, and prohibited shortcuts", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("## Offline/local-mode philosophy");
    expect(doc).toContain("## Allowed offline capabilities (resource eligibility baseline)");
    expect(doc).toContain("## Local draft semantics and pending-operation handling");
    expect(doc).toContain("## Sync and reconciliation boundaries");
    expect(doc).toContain("## Conflict categories and decision rules");
    expect(doc).toContain("## Server-authoritative-only examples");
    expect(doc).toContain("## Prohibited shortcuts");
    expect(doc).toContain("## Desktop cache and controlled resynchronization workflow map (Epic 19.2)");
    expect(doc).toContain("### Flow 1: cache population and offline transition");
    expect(doc).toContain("### Flow 2: reconnect replay, conflict handling, and explicit outcomes");
    expect(doc).toContain("### Flow 3: post-sync cache refresh and invalidation cleanup");
    expect(doc).toContain("### Story 19.3.8 end-to-end regression and production-readiness hardening baseline");
    expect(doc).toContain("## Intentionally deferred behavior (explicitly not implemented)");
    expect(doc).toContain("## Deployment-profile and future remote/offline evolution seams (Story 19.3.7)");
    expect(doc).toContain("IDesktopOfflineLocalModePolicyResolverPort");
    expect(doc).toContain("IOfflineResynchronizationPolicyPort");
    expect(doc).toContain("No mock deployment-profile toggles are shipped");
    expect(doc).toContain("client code must not treat offline local state as silently authoritative global truth");
    expect(doc).toContain("src/domain/platform/OfflineLocalModeBoundaries.ts");
    expect(doc).toContain("src/application/common/OfflineLocalModeResynchronization.ts");
    expect(doc).toContain("src/application/common/OfflineControlledResynchronizationCoordinator.ts");
    expect(doc).toContain("src/hosts/desktop/DesktopConnectivityStateService.ts");
    expect(doc).toContain("src/shared/contracts/runtime/OfflineSynchronizationContracts.ts");
  });

  it("documents contributor extension sequence and required offline module touchpoints", () => {
    const contributorDoc = readFileSync(contributorDocPath, "utf8");

    expect(contributorDoc).toContain("## Required extension sequence");
    expect(contributorDoc).toContain("## Desktop cache and reconnect workflow entry points");
    expect(contributorDoc).toContain("## Workflow-specific extension checklists");
    expect(contributorDoc).toContain("## Adding a new offline resource class");
    expect(contributorDoc).toContain("## Extending reconnect conflict handling");
    expect(contributorDoc).toContain("## Deployment-profile seam extension guidance (Story 19.3.7)");
    expect(contributorDoc).toContain("## Story 19.3.8 production-hardening regression baseline");
    expect(contributorDoc).toContain("IDesktopOfflineLocalModePolicyResolverPort");
    expect(contributorDoc).toContain("IOfflineResynchronizationPolicyPort");
    expect(contributorDoc).toContain("no mock deployment-profile toggles");
    expect(contributorDoc).toContain("## What must remain server-authoritative");
    expect(contributorDoc).toContain("## Prohibited patterns");
    expect(contributorDoc).toContain("## Intentionally deferred behavior guardrails");
    expect(contributorDoc).toContain("src/domain/platform/OfflineLocalModeBoundaries.ts");
    expect(contributorDoc).toContain("src/shared/contracts/runtime/OfflineSynchronizationContracts.ts");
    expect(contributorDoc).toContain("src/hosts/desktop/DesktopOfflineLocalModeProfile.ts");
    expect(contributorDoc).toContain("OfflineControlledResynchronizationCoordinator.synchronizeWorkspace(...)");
    expect(contributorDoc).toContain("src/hosts/desktop/tests/DesktopOfflineLifecycleRegression.integration.test.ts");
  });

  it("keeps architecture index docs discoverable for offline architecture and contributor guidance", () => {
    const architectureReadme = readFileSync(architectureReadmePath, "utf8");
    const architectureReadmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(architectureReadme).toContain("offline-local-mode-authority-boundaries.md");
    expect(architectureReadme).toContain("offline-sync-shared-contracts.md");
    expect(architectureReadme).toContain("offline-local-mode-audit-operational-hooks.md");
    expect(architectureReadme).toContain("offline-local-mode-contributor-guide.md");

    expect(architectureReadmeAi).toContain("docs/architecture/offline-local-mode-authority-boundaries.md");
    expect(architectureReadmeAi).toContain("docs/architecture/offline-sync-shared-contracts.md");
    expect(architectureReadmeAi).toContain("docs/architecture/offline-local-mode-audit-operational-hooks.md");
    expect(architectureReadmeAi).toContain("docs/offline-local-mode-contributor-guide.md");
  });

  it("keeps AI companion docs aligned to canonical offline docs", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");
    const hooksDoc = readFileSync(auditOperationalHooksDocPath, "utf8");
    const hooksAiDoc = readFileSync(auditOperationalHooksAiDocPath, "utf8");
    const contributorAiDoc = readFileSync(contributorAiDocPath, "utf8");
    const syncDoc = readFileSync(syncContractsDocPath, "utf8");

    expect(aiDoc).toContain("docs/offline-local-mode-contributor-guide.md");
    expect(aiDoc).toContain("offline local state as silently authoritative global truth");
    expect(aiDoc).toContain("Desktop cache + resync workflow baseline (Story 19.2.8)");
    expect(aiDoc).toContain("Story 19.3.8 production-hardening regression baseline");
    expect(aiDoc).toContain("Deployment-profile and future remote/offline evolution seams (Story 19.3.7)");
    expect(aiDoc).toContain("IOfflineResynchronizationPolicyPort");

    expect(contributorAiDoc).toContain("docs/offline-local-mode-contributor-guide.md");
    expect(contributorAiDoc).toContain("control-plane-client");
    expect(contributorAiDoc).toContain("## Desktop cache + reconnect extension map");
    expect(contributorAiDoc).toContain("Deployment-profile seam guidance (Story 19.3.7)");
    expect(contributorAiDoc).toContain("Story 19.3.8 hardening note");
    expect(contributorAiDoc).toContain("IDesktopOfflineLocalModePolicyResolverPort");

    expect(hooksDoc).toContain("offline-entered");
    expect(hooksDoc).toContain("replay-succeeded");
    expect(hooksDoc).toContain("protected-local-execution-registered");
    expect(hooksDoc).toContain("DesktopConnectivityStateService.ts");
    expect(hooksAiDoc).toContain("docs/architecture/offline-local-mode-audit-operational-hooks.md");
    expect(hooksAiDoc).toContain("OfflineOperationalEventPorts.ts");

    expect(syncDoc).toContain("OfflinePendingOperationEnvelopeDto");
    expect(syncDoc).toContain("OfflineConflictIndicatorDto");
  });
});
