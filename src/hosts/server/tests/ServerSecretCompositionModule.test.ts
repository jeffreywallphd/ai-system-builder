import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerSecretCompositionModule } from "../composition/ServerSecretCompositionModule";

describe("ServerSecretCompositionModule", () => {
  it("composes secret service and secret metadata backend behind a bounded contract", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-secret-composition-module-"));
    const databasePath = join(tempDirectory, "secret-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const composed = await composeServerSecretCompositionModule({
        databasePath,
        env: {},
        workspaceRepository: persistentServices.workspaceRepository,
        authoritativeAuditRecorder: new AuthoritativeAuditRecordingService({
          repository: persistentServices.auditLedgerRepository,
        }),
      });

      expect(composed.protectedSecretStore).toBeUndefined();
      expect(composed.secretService).toBeDefined();
      expect(composed.secretMetadataBackendApi).toBeDefined();

      composed.secretService.dispose();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
