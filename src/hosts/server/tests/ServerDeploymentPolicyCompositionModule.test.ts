import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerDeploymentPolicyCompositionModule } from "../composition/ServerDeploymentPolicyCompositionModule";

describe("ServerDeploymentPolicyCompositionModule", () => {
  it("composes deployment policy administration backends behind a typed output contract", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-deployment-policy-composition-module-"));
    const databasePath = join(tempDirectory, "deployment-policy-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const composed = composeServerDeploymentPolicyCompositionModule({
        persistentPlatformServices: persistentServices,
        authoritativeAuditRecorder: new AuthoritativeAuditRecordingService({
          repository: persistentServices.auditLedgerRepository,
        }),
      });

      expect(composed.deploymentPolicyReadBackendApi).toBeDefined();
      expect(composed.deploymentPolicyWriteBackendApi).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
