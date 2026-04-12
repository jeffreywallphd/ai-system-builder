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
import { composeServerSecretCompositionModule } from "../composition/ServerSecretCompositionModule";

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

const configuredCriticalSecurityMaterial = Object.freeze({
  AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET: "asset-download-grant-secret-value-12345",
  AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET: "generated-result-preview-token-secret-12345",
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
      const secretComposition = await composeServerSecretCompositionModule({
        databasePath,
        env: configuredCriticalSecurityMaterial,
        workspaceRepository: persistentServices.workspaceRepository,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
      });
      const storageAssetComposition = await composeServerStorageAssetCompositionModule({
        databasePath,
        env: configuredCriticalSecurityMaterial,
        secretService: secretComposition.secretService,
        persistentPlatformServices: persistentServices,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
      });
      const generatedResultComposition = await composeServerGeneratedResultCompositionModule({
        env: configuredCriticalSecurityMaterial,
        secretService: secretComposition.secretService,
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
      secretComposition.secretService.dispose();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
