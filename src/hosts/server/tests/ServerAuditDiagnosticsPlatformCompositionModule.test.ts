import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerAuditDiagnosticsPlatformCompositionModule } from "../composition/ServerAuditDiagnosticsPlatformCompositionModule";

class CapturingHostLogger {
  public readonly infoEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly warnEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly errorEvents: Array<Readonly<Record<string, unknown>>> = [];

  public info(event: Readonly<Record<string, unknown>>): void {
    this.infoEvents.push(event);
  }

  public warn(event: Readonly<Record<string, unknown>>): void {
    this.warnEvents.push(event);
  }

  public error(event: Readonly<Record<string, unknown>>): void {
    this.errorEvents.push(event);
  }
}

describe("ServerAuditDiagnosticsPlatformCompositionModule", () => {
  it("composes audit/diagnostics cross-cutting services behind a bounded contract", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-audit-diagnostics-composition-module-"));
    const databasePath = join(tempDirectory, "audit-diagnostics-composition-module.sqlite");
    const logger = new CapturingHostLogger();

    try {
      const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });
      try {
        const composed = composeServerAuditDiagnosticsPlatformCompositionModule({
          env: {},
          persistentPlatformServices: persistentServices,
          logger,
        });

        expect(composed.authoritativeAuditRecorder).toBeDefined();
        expect(composed.auditLedgerObservability).toBeDefined();
        expect(composed.runOrchestrationObservability).toBeDefined();
        expect(composed.runSubmissionAuditSink).toBeDefined();
        expect(composed.executionNodeManagementAuditSink).toBeDefined();
        expect(composed.secretOperationalLogger).toBeDefined();
        expect(composed.deploymentPolicyAdministrationOperationalLogger).toBeDefined();
        expect(composed.encryptionOperationalLogger).toBeDefined();
        expect(composed.imageAssetManagementOperationalLogger).toBeDefined();
        expect(composed.legacySecretAccessAuditHook).toBeDefined();

        const workspaceClock = Object.freeze({
          now: () => new Date("2026-04-12T00:00:00.000Z"),
        });
        const auditLedgerBackendApi = composed.createAuditLedgerBackendApi({
          workspaceClock,
        });
        expect(auditLedgerBackendApi).toBeDefined();

        const startupReconciliation = await composed.reconcileAuditLedgerStartupState({
          workspaceClock,
        });
        expect(typeof startupReconciliation.checkedAt).toBe("string");
        expect(typeof startupReconciliation.supported).toBe("boolean");
        expect(typeof startupReconciliation.repairedCount).toBe("number");
        expect(typeof startupReconciliation.manualFollowUpCount).toBe("number");
        expect(typeof startupReconciliation.issueCount).toBe("number");
      } finally {
        persistentServices.dispose();
      }
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
