import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerStorageAssetCompositionModule } from "../composition/ServerStorageAssetCompositionModule";

describe("ServerStorageAssetCompositionModule", () => {
  it("composes managed storage and protected asset backends behind a typed module contract", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-storage-asset-composition-module-"));
    const databasePath = join(tempDirectory, "storage-asset-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const composed = composeServerStorageAssetCompositionModule({
        databasePath,
        env: {},
        persistentPlatformServices: persistentServices,
        authoritativeAuditRecorder: new AuthoritativeAuditRecordingService({
          repository: persistentServices.auditLedgerRepository,
        }),
      });

      expect(composed.storageManagementBackendApi).toBeDefined();
      expect(composed.assetManagementBackendApi).toBeDefined();
      expect(composed.storageLogicalAccessResolutionService).toBeDefined();
      expect(composed.workspaceAwareStoragePolicyEvaluationAdapter).toBeDefined();
      expect(composed.assetEncryptionPolicyEvaluationService).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
