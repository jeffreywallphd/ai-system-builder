import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerNodeTrustCompositionModule } from "../composition/ServerNodeTrustCompositionModule";

function createClock() {
  return Object.freeze({
    now: () => new Date("2026-04-12T00:00:00.000Z"),
  });
}

describe("ServerNodeTrustCompositionModule", () => {
  it("composes node-trust and execution-node management backends behind typed outputs", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-node-trust-composition-module-"));
    const databasePath = join(tempDirectory, "node-trust-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const composed = composeServerNodeTrustCompositionModule({
        nodeTrustRepository: persistentServices.nodeTrustRepository,
        executionNodeRepository: persistentServices.executionNodeRepository,
        nodeTrustAuditRecorder: persistentServices.nodeTrustAuditRecorder,
        authoritativeAuditRecorder: new AuthoritativeAuditRecordingService({
          repository: persistentServices.auditLedgerRepository,
        }),
        runtimeTrustMaterialResolver: undefined,
        workspaceClock: createClock(),
      });

      expect(composed.nodeTrustBackendApi).toBeDefined();
      expect(composed.executionNodeManagementBackendApi).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
