import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStartupTracer, type StartupSpanLogger } from "@hosts/bootstrap/startupTracer";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerAuditDiagnosticsPlatformCompositionModule } from "../composition/ServerAuditDiagnosticsPlatformCompositionModule";
import { composeServerGeneratedResultCompositionModule } from "../composition/ServerGeneratedResultCompositionModule";
import { composeServerOrchestrationRecoveryCompositionModule } from "../composition/ServerOrchestrationRecoveryCompositionModule";
import { composeServerStorageAssetCompositionModule } from "../composition/ServerStorageAssetCompositionModule";

class CapturingStartupSpanLogger implements StartupSpanLogger {
  public readonly infoEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly errorEvents: Array<Readonly<Record<string, unknown>>> = [];

  public info(payload: Readonly<Record<string, unknown>>): void {
    this.infoEvents.push(payload);
  }

  public error(payload: Readonly<Record<string, unknown>>): void {
    this.errorEvents.push(payload);
  }
}

const testClock = Object.freeze({
  now: () => new Date("2026-04-12T00:00:00.000Z"),
});

describe("ServerOrchestrationRecoveryCompositionModule", () => {
  it("composes startup recovery and reconciliation behind a bounded module", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-orchestration-recovery-composition-module-"));
    const databasePath = join(tempDirectory, "orchestration-recovery-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const auditDiagnostics = composeServerAuditDiagnosticsPlatformCompositionModule({
        env: {},
        persistentPlatformServices: persistentServices,
      });
      const storageAssetComposition = composeServerStorageAssetCompositionModule({
        databasePath,
        env: {},
        persistentPlatformServices: persistentServices,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
      });
      const generatedResultComposition = composeServerGeneratedResultCompositionModule({
        env: {},
        persistentPlatformServices: persistentServices,
        workspaceClock: testClock,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
        storageLogicalAccessResolutionService: storageAssetComposition.storageLogicalAccessResolutionService,
      });

      const startupLogger = new CapturingStartupSpanLogger();
      const startupTracer = createStartupTracer({
        logger: startupLogger,
        traceId: "orchestration-recovery-composition-module-test",
        startupReason: "orchestration-recovery-composition-module-test",
      });
      const startupRootSpan = startupTracer.startSpan("authoritative-server-bootstrap");

      const composed = await composeServerOrchestrationRecoveryCompositionModule({
        startupTracer,
        startupRootSpan,
        persistentPlatformServices: persistentServices,
        runCollectedResultPersistencePort: generatedResultComposition.runCollectedResultPersistencePort,
        workspaceClock: testClock,
        reconcileAuditLedgerStartupState: auditDiagnostics.reconcileAuditLedgerStartupState,
      });

      startupRootSpan.complete();

      expect(typeof composed.runStartupRecovery.asOf).toBe("string");
      expect(typeof composed.runStartupRecovery.summary.appliedCount).toBe("number");
      expect(typeof composed.auditStartupReconciliation.checkedAt).toBe("string");
      expect(startupLogger.errorEvents).toHaveLength(0);
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
