import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerNodeTrustCompositionModule } from "../composition/ServerNodeTrustCompositionModule";

describe("ServerNodeTrustCompositionModule", () => {
  it("composes node-trust backend services behind typed outputs", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-node-trust-composition-module-"));
    const databasePath = join(tempDirectory, "node-trust-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const composed = composeServerNodeTrustCompositionModule({
        nodeTrustRepository: persistentServices.nodeTrustRepository,
        nodeTrustAuditRecorder: persistentServices.nodeTrustAuditRecorder,
        authoritativeAuditRecorder: new AuthoritativeAuditRecordingService({
          repository: persistentServices.auditLedgerRepository,
        }),
        runtimeTrustMaterialResolver: undefined,
      });

      expect(composed.nodeTrustBackendApi).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
