import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { AuthoritativeExecutionNodeManagementAuditSink } from "@infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerWorkspaceAuthorizationCompositionModule } from "../composition/ServerWorkspaceAuthorizationCompositionModule";
import { composeServerExecutionNodeManagementCompositionModule } from "../composition/ServerExecutionNodeManagementCompositionModule";
import { composeServerRunSchedulingCompositionModule } from "../composition/ServerRunSchedulingCompositionModule";

function createClock() {
  return Object.freeze({
    now: () => new Date("2026-04-12T00:00:00.000Z"),
  });
}

describe("ServerRunSchedulingCompositionModule", () => {
  it("composes scheduling policy/services behind typed outputs", () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-run-scheduling-composition-module-"));
    const databasePath = join(tempDirectory, "run-scheduling-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const authoritativeAuditRecorder = new AuthoritativeAuditRecordingService({
        repository: persistentServices.auditLedgerRepository,
      });
      const workspaceAuthorizationComposition = composeServerWorkspaceAuthorizationCompositionModule({
        workspaceRepository: persistentServices.workspaceRepository,
        authorizationRepository: persistentServices.authorizationRepository,
        authoritativeAuditRecorder,
        deploymentPolicyBootstrap: undefined,
      });
      const executionNodeManagementComposition = composeServerExecutionNodeManagementCompositionModule({
        executionNodeRepository: persistentServices.executionNodeRepository,
        executionNodeManagementAuditSink: new AuthoritativeExecutionNodeManagementAuditSink(authoritativeAuditRecorder),
        workspaceClock: createClock(),
      });

      const composed = composeServerRunSchedulingCompositionModule({
        persistentPlatformServices: persistentServices,
        authorizationDecisionEvaluator: workspaceAuthorizationComposition.authorizationDecisionEvaluator,
        workspaceClock: workspaceAuthorizationComposition.workspaceClock,
        executionNodeManagementAuditSink: new AuthoritativeExecutionNodeManagementAuditSink(authoritativeAuditRecorder),
        nodeEligibilityEvaluationService: executionNodeManagementComposition.nodeEligibilityEvaluationService,
      });

      expect(composed.imageRunExecutionNodeSelectionService).toBeDefined();
      expect(composed.getImageManipulationExecutionReadinessUseCase).toBeDefined();
      expect(composed.imageRunSubmissionReadinessValidationService).toBeDefined();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
