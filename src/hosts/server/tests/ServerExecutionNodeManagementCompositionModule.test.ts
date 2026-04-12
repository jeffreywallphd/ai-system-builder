import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { AuthoritativeExecutionNodeManagementAuditSink } from "@infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerExecutionNodeManagementCompositionModule } from "../composition/ServerExecutionNodeManagementCompositionModule";

function createClock() {
  return Object.freeze({
    now: () => new Date("2026-04-12T00:00:00.000Z"),
  });
}

describe("ServerExecutionNodeManagementCompositionModule", () => {
  it("composes execution-node management services and backend APIs behind typed outputs", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-execution-node-management-composition-module-"));
    const databasePath = join(tempDirectory, "execution-node-management-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const authoritativeAuditRecorder = new AuthoritativeAuditRecordingService({
        repository: persistentServices.auditLedgerRepository,
      });
      const composed = composeServerExecutionNodeManagementCompositionModule({
        executionNodeRepository: persistentServices.executionNodeRepository,
        executionNodeManagementAuditSink: new AuthoritativeExecutionNodeManagementAuditSink(authoritativeAuditRecorder),
        workspaceClock: createClock(),
      });

      expect(composed.nodeEligibilityEvaluationService).toBeDefined();
      expect(composed.executionNodeManagementBackendApi).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
