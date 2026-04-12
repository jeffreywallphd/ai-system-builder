import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerWorkspaceAuthorizationCompositionModule } from "../composition/ServerWorkspaceAuthorizationCompositionModule";
import { composeServerStorageAssetCompositionModule } from "../composition/ServerStorageAssetCompositionModule";
import { composeServerImageMediaCompositionModule } from "../composition/ServerImageMediaCompositionModule";

const configuredCriticalSecurityMaterial = Object.freeze({
  AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET: "asset-download-grant-secret-value-12345",
  AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET: "image-storage-token-secret-value-12345",
  AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET: "image-upload-session-token-secret-value-12345",
});

describe("ServerImageMediaCompositionModule", () => {
  it("composes image/media preview backend services without route-layer coupling", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-image-media-composition-module-"));
    const databasePath = join(tempDirectory, "image-media-composition-module.sqlite");
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
        env: configuredCriticalSecurityMaterial,
        persistentPlatformServices: persistentServices,
        authoritativeAuditRecorder,
      });

      const composed = composeServerImageMediaCompositionModule({
        databasePath,
        env: configuredCriticalSecurityMaterial,
        persistentPlatformServices: persistentServices,
        authorizationDecisionEvaluator: workspaceAuthorizationComposition.authorizationDecisionEvaluator,
        authoritativeAuditRecorder,
        storageLogicalAccessResolutionService: storageAssetComposition.storageLogicalAccessResolutionService,
        workspaceAwareStoragePolicyEvaluationAdapter: storageAssetComposition.workspaceAwareStoragePolicyEvaluationAdapter,
      });

      expect(composed.imageAssetManagementBackendApi).toBeDefined();
      composed.dispose();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
