import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import { composeServerAuditDiagnosticsPlatformCompositionModule } from "../composition/ServerAuditDiagnosticsPlatformCompositionModule";
import { composeServerExecutionNodeManagementCompositionModule } from "../composition/ServerExecutionNodeManagementCompositionModule";
import { composeServerGeneratedResultCompositionModule } from "../composition/ServerGeneratedResultCompositionModule";
import { composeServerRunOrchestrationCompositionModule } from "../composition/ServerRunOrchestrationCompositionModule";
import { composeServerRunSchedulingCompositionModule } from "../composition/ServerRunSchedulingCompositionModule";
import { composeServerStorageAssetCompositionModule } from "../composition/ServerStorageAssetCompositionModule";
import { composeServerWorkspaceAuthorizationCompositionModule } from "../composition/ServerWorkspaceAuthorizationCompositionModule";
import { composeServerSecretCompositionModule } from "../composition/ServerSecretCompositionModule";

const testClock = Object.freeze({
  now: () => new Date("2026-04-12T00:00:00.000Z"),
});

const configuredCriticalSecurityMaterial = Object.freeze({
  AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET: "asset-download-grant-secret-value-12345",
  AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET: "generated-result-preview-token-secret-12345",
});

describe("ServerRunOrchestrationCompositionModule", () => {
  it("composes run orchestration and scheduling APIs behind typed outputs", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "ai-loom-run-orchestration-composition-module-"));
    const databasePath = join(tempDirectory, "run-orchestration-composition-module.sqlite");
    const persistentServices = createAuthoritativePersistentPlatformServices({ databasePath });

    try {
      const auditDiagnostics = composeServerAuditDiagnosticsPlatformCompositionModule({
        env: {},
        persistentPlatformServices: persistentServices,
      });
      const workspaceAuthorizationComposition = composeServerWorkspaceAuthorizationCompositionModule({
        workspaceRepository: persistentServices.workspaceRepository,
        authorizationRepository: persistentServices.authorizationRepository,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
        deploymentPolicyBootstrap: undefined,
      });
      const executionNodeManagementComposition = composeServerExecutionNodeManagementCompositionModule({
        executionNodeRepository: persistentServices.executionNodeRepository,
        executionNodeManagementAuditSink: auditDiagnostics.executionNodeManagementAuditSink,
        workspaceClock: workspaceAuthorizationComposition.workspaceClock,
      });
      const schedulingComposition = composeServerRunSchedulingCompositionModule({
        persistentPlatformServices: persistentServices,
        authorizationDecisionEvaluator: workspaceAuthorizationComposition.authorizationDecisionEvaluator,
        workspaceClock: workspaceAuthorizationComposition.workspaceClock,
        executionNodeManagementAuditSink: auditDiagnostics.executionNodeManagementAuditSink,
        nodeEligibilityEvaluationService: executionNodeManagementComposition.nodeEligibilityEvaluationService,
      });
      const secretComposition = await composeServerSecretCompositionModule({
        databasePath,
        env: configuredCriticalSecurityMaterial,
        workspaceRepository: persistentServices.workspaceRepository,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
      });
      const storageAssetComposition = await composeServerStorageAssetCompositionModule({
        databasePath,
        env: configuredCriticalSecurityMaterial,
        secretService: secretComposition.secretService,
        persistentPlatformServices: persistentServices,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
      });
      const generatedResultComposition = await composeServerGeneratedResultCompositionModule({
        env: configuredCriticalSecurityMaterial,
        secretService: secretComposition.secretService,
        persistentPlatformServices: persistentServices,
        workspaceClock: testClock,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
        storageLogicalAccessResolutionService: storageAssetComposition.storageLogicalAccessResolutionService,
      });

      const composed = composeServerRunOrchestrationCompositionModule({
        persistentPlatformServices: persistentServices,
        authorizationDecisionEvaluator: workspaceAuthorizationComposition.authorizationDecisionEvaluator,
        workspaceClock: workspaceAuthorizationComposition.workspaceClock,
        authoritativeAuditRecorder: auditDiagnostics.authoritativeAuditRecorder,
        runSubmissionAuditSink: auditDiagnostics.runSubmissionAuditSink,
        runOrchestrationObservability: auditDiagnostics.runOrchestrationObservability,
        scheduling: schedulingComposition,
        workspaceAwareStoragePolicyEvaluationAdapter: storageAssetComposition.workspaceAwareStoragePolicyEvaluationAdapter,
        assetEncryptionPolicyEvaluationService: storageAssetComposition.assetEncryptionPolicyEvaluationService,
        runCollectedResultPersistencePort: generatedResultComposition.runCollectedResultPersistencePort,
      });

      expect(composed.authoritativeRunSubmissionBackendApi).toBeDefined();
      expect(composed.authoritativeRunQueryBackendApi).toBeDefined();
      expect(composed.authoritativeRunMutationBackendApi).toBeDefined();
      expect(composed.authoritativeRunExecutionUpdateBackendApi).toBeDefined();
      secretComposition.secretService.dispose();
    } finally {
      persistentServices.dispose();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
