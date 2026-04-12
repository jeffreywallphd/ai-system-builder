import type { AuthorizationPolicyDecisionEvaluator } from "@application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import { GetAuthoritativeRunUseCase } from "@application/runs/use-cases/GetAuthoritativeRunUseCase";
import { IngestRunExecutionUpdateUseCase } from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";
import { ListAuthoritativeRunQueueStatusUseCase } from "@application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase";
import { ListAuthoritativeRunsUseCase } from "@application/runs/use-cases/ListAuthoritativeRunsUseCase";
import { ListStaleSchedulingReservationsUseCase } from "@application/runs/use-cases/ListStaleSchedulingReservationsUseCase";
import { ReevaluateDeferredSchedulingRunsUseCase } from "@application/runs/use-cases/ReevaluateDeferredSchedulingRunsUseCase";
import { ReleaseStaleSchedulingReservationUseCase } from "@application/runs/use-cases/ReleaseStaleSchedulingReservationUseCase";
import { RequestAuthoritativeRunCancellationUseCase } from "@application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase";
import { RequestAuthoritativeRunRetryUseCase } from "@application/runs/use-cases/RequestAuthoritativeRunRetryUseCase";
import { SubmitImageRunUseCase } from "@application/runs/use-cases/SubmitImageRunUseCase";
import { ValidateRunSubmissionUseCase } from "@application/runs/use-cases/ValidateRunSubmissionUseCase";
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import type { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import type { EncryptionPolicyEvaluationService } from "@application/security/use-cases/EncryptionPolicyEvaluationService";
import type { ServerRunSchedulingCompositionModuleOutput } from "./ServerRunSchedulingCompositionModule";
import type { FanoutRunSubmissionAuditSink } from "@infrastructure/audit/AuditFanoutPublishers";
import { AuthoritativeRunExecutionUpdateBackendApi } from "@infrastructure/api/runs/AuthoritativeRunExecutionUpdateBackendApi";
import { AuthoritativeRunMutationBackendApi } from "@infrastructure/api/runs/AuthoritativeRunMutationBackendApi";
import { AuthoritativeRunQueryBackendApi } from "@infrastructure/api/runs/AuthoritativeRunQueryBackendApi";
import { AuthoritativeRunSubmissionBackendApi } from "@infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi";
import { AssetBackedRunSubmissionTargetResolver } from "@infrastructure/api/runs/AssetBackedRunSubmissionTargetResolver";
import type { RunOrchestrationObservability } from "@infrastructure/api/runs/RunOrchestrationObservability";
import type { WorkspaceAwareStoragePolicyEvaluationAdapter } from "@infrastructure/api/storage/WorkspaceAwareStoragePolicyEvaluationAdapter";
import type { AuthoritativeRunExecutionAdapterRegistration } from "@infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration";
import type { SqliteRunCollectedResultPersistenceAdapter } from "@infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";

export interface ServerRunOrchestrationCompositionModuleInput {
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly authorizationDecisionEvaluator: AuthorizationPolicyDecisionEvaluator;
  readonly workspaceClock: IIdentityClock;
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly runSubmissionAuditSink: FanoutRunSubmissionAuditSink;
  readonly runOrchestrationObservability: RunOrchestrationObservability;
  readonly scheduling: ServerRunSchedulingCompositionModuleOutput;
  readonly workspaceAwareStoragePolicyEvaluationAdapter: WorkspaceAwareStoragePolicyEvaluationAdapter;
  readonly assetEncryptionPolicyEvaluationService: EncryptionPolicyEvaluationService;
  readonly runCollectedResultPersistencePort: SqliteRunCollectedResultPersistenceAdapter;
  readonly deploymentPolicyBootstrap?: DeploymentPolicyBootstrapResolutionResult;
  readonly runExecutionAdapters?: AuthoritativeRunExecutionAdapterRegistration;
}

export interface ServerRunOrchestrationCompositionModuleOutput {
  readonly authoritativeRunSubmissionBackendApi: AuthoritativeRunSubmissionBackendApi;
  readonly authoritativeRunQueryBackendApi: AuthoritativeRunQueryBackendApi;
  readonly authoritativeRunMutationBackendApi: AuthoritativeRunMutationBackendApi;
  readonly authoritativeRunExecutionUpdateBackendApi: AuthoritativeRunExecutionUpdateBackendApi;
}

export function composeServerRunOrchestrationCompositionModule(
  input: ServerRunOrchestrationCompositionModuleInput,
): ServerRunOrchestrationCompositionModuleOutput {
  const validateRunSubmissionUseCase = new ValidateRunSubmissionUseCase({
    workspaceRepository: input.persistentPlatformServices.workspaceRepository,
    authorizationDecisionEvaluator: input.authorizationDecisionEvaluator,
    targetResolver: new AssetBackedRunSubmissionTargetResolver(input.persistentPlatformServices.assetRepository),
    storageInstanceRepository: input.persistentPlatformServices.storageInstanceRepository,
    storagePolicyEvaluationPort: input.workspaceAwareStoragePolicyEvaluationAdapter,
    encryptionPolicyEvaluationService: input.assetEncryptionPolicyEvaluationService,
    deploymentSchedulingPolicyEvaluationPort: input.deploymentPolicyBootstrap?.evaluationService,
    deploymentPolicyContextResolver: input.deploymentPolicyBootstrap?.contextResolver,
    auditSink: input.runSubmissionAuditSink,
    clock: input.workspaceClock,
  });

  const createAuthoritativeRunUseCase = new CreateAuthoritativeRunUseCase({
    runRepository: input.persistentPlatformServices.platformPersistenceRepository,
    queueRepository: input.persistentPlatformServices.platformPersistenceRepository,
    orchestrationIntentRepository: input.persistentPlatformServices.platformPersistenceRepository,
    auditSink: input.runSubmissionAuditSink,
    transactionManager: input.persistentPlatformServices.platformPersistenceRepository,
  });

  const submitImageRunUseCase = new SubmitImageRunUseCase({
    validateRunSubmissionUseCase,
    createAuthoritativeRunUseCase,
    imageRunReadinessResolver: input.scheduling.imageRunSubmissionReadinessValidationService,
    now: () => input.workspaceClock.now(),
  });

  const authoritativeRunSubmissionBackendApi = new AuthoritativeRunSubmissionBackendApi({
    submitImageRunUseCase,
    observability: input.runOrchestrationObservability,
  });

  const authoritativeRunQueryBackendApi = new AuthoritativeRunQueryBackendApi({
    listAuthoritativeRunsUseCase: new ListAuthoritativeRunsUseCase(
      input.persistentPlatformServices.platformPersistenceRepository,
    ),
    listAuthoritativeRunQueueStatusUseCase: new ListAuthoritativeRunQueueStatusUseCase({
      runRepository: input.persistentPlatformServices.platformPersistenceRepository,
      queueRepository: input.persistentPlatformServices.platformPersistenceRepository,
      now: () => input.workspaceClock.now(),
    }),
    listStaleSchedulingReservationsUseCase: new ListStaleSchedulingReservationsUseCase({
      queueRepository: input.persistentPlatformServices.platformPersistenceRepository,
      now: () => input.workspaceClock.now(),
    }),
    getAuthoritativeRunUseCase: new GetAuthoritativeRunUseCase(
      input.persistentPlatformServices.platformPersistenceRepository,
    ),
    getImageManipulationExecutionReadinessUseCase: input.scheduling.getImageManipulationExecutionReadinessUseCase,
    runRepository: input.persistentPlatformServices.platformPersistenceRepository,
    auditEventRepository: input.persistentPlatformServices.platformPersistenceRepository,
    authorizationDecisionEvaluator: input.authorizationDecisionEvaluator,
    observability: input.runOrchestrationObservability,
    now: () => input.workspaceClock.now(),
  });

  const authoritativeRunMutationBackendApi = new AuthoritativeRunMutationBackendApi({
    requestAuthoritativeRunCancellationUseCase: new RequestAuthoritativeRunCancellationUseCase({
      runRepository: input.persistentPlatformServices.platformPersistenceRepository,
      queueRepository: input.persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: input.persistentPlatformServices.platformPersistenceRepository,
      cancellationSignalPort: input.runExecutionAdapters?.cancellationSignalPort,
      resultCollectionPersistencePort: input.runCollectedResultPersistencePort,
      transactionManager: input.persistentPlatformServices.platformPersistenceRepository,
      authoritativeAuditRecorder: input.authoritativeAuditRecorder,
      now: () => input.workspaceClock.now(),
    }),
    requestAuthoritativeRunRetryUseCase: new RequestAuthoritativeRunRetryUseCase({
      runRepository: input.persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: input.persistentPlatformServices.platformPersistenceRepository,
      validateRunSubmissionUseCase,
      createAuthoritativeRunUseCase,
      authoritativeAuditRecorder: input.authoritativeAuditRecorder,
      now: () => input.workspaceClock.now(),
    }),
    releaseStaleSchedulingReservationUseCase: new ReleaseStaleSchedulingReservationUseCase({
      queueRepository: input.persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: input.persistentPlatformServices.platformPersistenceRepository,
      authoritativeAuditRecorder: input.authoritativeAuditRecorder,
      now: () => input.workspaceClock.now(),
    }),
    reevaluateDeferredSchedulingRunsUseCase: new ReevaluateDeferredSchedulingRunsUseCase({
      queueRepository: input.persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: input.persistentPlatformServices.platformPersistenceRepository,
      authoritativeAuditRecorder: input.authoritativeAuditRecorder,
      now: () => input.workspaceClock.now(),
    }),
    authorizationDecisionEvaluator: input.authorizationDecisionEvaluator,
    observability: input.runOrchestrationObservability,
    now: () => input.workspaceClock.now(),
  });

  const authoritativeRunExecutionUpdateBackendApi = new AuthoritativeRunExecutionUpdateBackendApi({
    ingestRunExecutionUpdateUseCase: new IngestRunExecutionUpdateUseCase({
      runRepository: input.persistentPlatformServices.platformPersistenceRepository,
      queueRepository: input.persistentPlatformServices.platformPersistenceRepository,
      orchestrationIntentRepository: input.persistentPlatformServices.platformPersistenceRepository,
      resultCollectionPersistencePort: input.runCollectedResultPersistencePort,
      authoritativeAuditRecorder: input.authoritativeAuditRecorder,
      transactionManager: input.persistentPlatformServices.platformPersistenceRepository,
      now: () => input.workspaceClock.now(),
    }),
    observability: input.runOrchestrationObservability,
  });

  return Object.freeze({
    authoritativeRunSubmissionBackendApi,
    authoritativeRunQueryBackendApi,
    authoritativeRunMutationBackendApi,
    authoritativeRunExecutionUpdateBackendApi,
  });
}
