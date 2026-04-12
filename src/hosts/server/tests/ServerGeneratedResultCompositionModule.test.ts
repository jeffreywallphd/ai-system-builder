import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerWorkspaceAuthorizationCompositionModule } from "../composition/ServerWorkspaceAuthorizationCompositionModule";
import { composeServerStorageAssetCompositionModule } from "../composition/ServerStorageAssetCompositionModule";
import { composeServerGeneratedResultCompositionModule } from "../composition/ServerGeneratedResultCompositionModule";
import { composeServerSecretCompositionModule } from "../composition/ServerSecretCompositionModule";

const configuredCriticalSecurityMaterial = Object.freeze({
  AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET: "asset-download-grant-secret-value-12345",
  AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET: "generated-result-preview-token-secret-12345",
});

describe("ServerGeneratedResultCompositionModule", () => {
  it("composes generated result preview/media and persistence adapters behind one typed output", async () => {
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
      const secretComposition = await composeServerSecretCompositionModule({
        databasePath,
        env: configuredCriticalSecurityMaterial,
        workspaceRepository: persistentServices.workspaceRepository,
        authoritativeAuditRecorder,
      });
      const storageAssetComposition = await composeServerStorageAssetCompositionModule({
        databasePath,
        env: configuredCriticalSecurityMaterial,
        secretService: secretComposition.secretService,
        persistentPlatformServices: persistentServices,
        authoritativeAuditRecorder,
      });

      const composed = await composeServerGeneratedResultCompositionModule({
        env: configuredCriticalSecurityMaterial,
        secretService: secretComposition.secretService,
        persistentPlatformServices: persistentServices,
        workspaceClock: workspaceAuthorizationComposition.workspaceClock,
        authoritativeAuditRecorder,
        storageLogicalAccessResolutionService: storageAssetComposition.storageLogicalAccessResolutionService,
      });

      expect(composed.generatedResultManagementBackendApi).toBeDefined();
      expect(composed.runCollectedResultPersistencePort).toBeDefined();
      secretComposition.secretService.dispose();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
