import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerWorkspaceAuthorizationCompositionModule } from "../composition/ServerWorkspaceAuthorizationCompositionModule";

function createDeploymentPolicyBootstrapStub() {
  const context = Object.freeze({
    profileId: "home",
  });
  return Object.freeze({
    scope: Object.freeze({
      kind: "deployment-policy-scope",
      scopeId: "platform:default",
    }),
    activeProfile: Object.freeze({
      profileId: "home",
      source: "default-fallback",
    }),
    overrideRecords: Object.freeze([]),
    evaluationContext: context,
    evaluationService: {} as never,
    snapshot: {} as never,
    validation: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
      evaluatedAt: "2026-04-12T00:00:00.000Z",
    }),
    contextResolver: Object.freeze({
      resolveContext: async () => context,
    }),
  });
}

describe("ServerWorkspaceAuthorizationCompositionModule", () => {
  it("composes workspace, authorization, and sharing backend services behind one typed output", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-workspace-auth-composition-module-"));
    const databasePath = join(tempDirectory, "workspace-auth-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const composed = composeServerWorkspaceAuthorizationCompositionModule({
        workspaceRepository: persistentServices.workspaceRepository,
        authorizationRepository: persistentServices.authorizationRepository,
        authoritativeAuditRecorder: new AuthoritativeAuditRecordingService({
          repository: persistentServices.auditLedgerRepository,
        }),
        deploymentPolicyBootstrap: createDeploymentPolicyBootstrapStub(),
      });

      expect(composed.workspaceClock.now()).toBeInstanceOf(Date);
      expect(composed.authorizationDecisionEvaluator).toBeDefined();
      expect(composed.workspaceBackendApi).toBeDefined();
      expect(composed.workspaceAdministrationBackendApi).toBeDefined();
      expect(composed.authorizationManagementBackendApi).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
