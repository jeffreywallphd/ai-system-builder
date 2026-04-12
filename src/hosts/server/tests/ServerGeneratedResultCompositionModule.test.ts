import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerWorkspaceAuthorizationCompositionModule } from "../composition/ServerWorkspaceAuthorizationCompositionModule";
import { composeServerStorageAssetCompositionModule } from "../composition/ServerStorageAssetCompositionModule";
import { composeServerGeneratedResultCompositionModule } from "../composition/ServerGeneratedResultCompositionModule";

describe("ServerGeneratedResultCompositionModule", () => {
  it("composes generated result preview/media and persistence adapters behind one typed output", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-generated-result-composition-module-"));
    const databasePath = join(tempDirectory, "generated-result-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const authoritativeAuditRecorder = new AuthoritativeAuditRecordingService({
        repository: persistentServices.auditLedgerRepository,
      });
      const workspaceAuthorizationComposition = composeServerWorkspaceAuthorizationCompositionModule({
        workspaceRepository: persistentServices.workspaceRepository,
        authorizationRepository: persistentServices.authorizationRepository,
        authoritativeAuditRecorder,
      });
      const storageAssetComposition = composeServerStorageAssetCompositionModule({
        databasePath,
        env: {},
        persistentPlatformServices: persistentServices,
        authoritativeAuditRecorder,
      });

      const composed = composeServerGeneratedResultCompositionModule({
        env: {},
        persistentPlatformServices: persistentServices,
        workspaceClock: workspaceAuthorizationComposition.workspaceClock,
        authoritativeAuditRecorder,
        storageLogicalAccessResolutionService: storageAssetComposition.storageLogicalAccessResolutionService,
      });

      expect(composed.generatedResultManagementBackendApi).toBeDefined();
      expect(composed.runCollectedResultPersistencePort).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
