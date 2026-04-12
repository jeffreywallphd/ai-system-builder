import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerCertificateCompositionModule } from "../composition/ServerCertificateCompositionModule";
import { composeServerSecretCompositionModule } from "../composition/ServerSecretCompositionModule";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";

describe("ServerCertificateCompositionModule", () => {
  it("composes CA startup validation, certificate operations, and runtime trust resolver contracts", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-certificate-composition-module-"));
    const databasePath = join(tempDirectory, "certificate-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const secretComposition = await composeServerSecretCompositionModule({
        databasePath,
        env: {},
        workspaceRepository: persistentServices.workspaceRepository,
        authoritativeAuditRecorder: new AuthoritativeAuditRecordingService({
          repository: persistentServices.auditLedgerRepository,
        }),
      });
      const composed = await composeServerCertificateCompositionModule({
        env: {},
        secretService: secretComposition.secretService,
        certificateAuthorityRepository: persistentServices.certificateAuthorityRepository,
        nodeTrustRepository: persistentServices.nodeTrustRepository,
        protectedSecretStore: undefined,
      });

      expect(composed.startupStateResolver).toBeDefined();
      expect(composed.runtimeTrustMaterialResolver).toBeUndefined();
      expect(composed.certificateOperationsBackendApi).toBeDefined();
      secretComposition.secretService.dispose();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
