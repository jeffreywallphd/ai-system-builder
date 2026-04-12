import type { AuthorizationPolicyDecisionEvaluator } from "@application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import { GetImageManipulationExecutionReadinessUseCase } from "@application/image-workflows/GetImageManipulationExecutionReadinessUseCase";
import { ImageRunSubmissionReadinessValidationService } from "@application/image-workflows/ImageRunSubmissionReadinessValidationService";
import { ImageRunExecutionNodeSelectionService } from "@application/nodes/use-cases/ImageRunExecutionNodeSelectionService";
import type { ImageRunNodeEligibilityEvaluationService } from "@application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService";
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import type { AuthoritativeExecutionNodeManagementAuditSink } from "@infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink";
import type { AuthoritativeRunExecutionAdapterRegistration } from "@infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";

export interface ServerRunSchedulingCompositionModuleInput {
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly authorizationDecisionEvaluator: AuthorizationPolicyDecisionEvaluator;
  readonly workspaceClock: IIdentityClock;
  readonly executionNodeManagementAuditSink: AuthoritativeExecutionNodeManagementAuditSink;
  readonly nodeEligibilityEvaluationService: ImageRunNodeEligibilityEvaluationService;
  readonly runExecutionAdapters?: AuthoritativeRunExecutionAdapterRegistration;
}

export interface ServerRunSchedulingCompositionModuleOutput {
  readonly imageRunExecutionNodeSelectionService: ImageRunExecutionNodeSelectionService;
  readonly getImageManipulationExecutionReadinessUseCase: GetImageManipulationExecutionReadinessUseCase;
  readonly imageRunSubmissionReadinessValidationService: ImageRunSubmissionReadinessValidationService;
}

export function composeServerRunSchedulingCompositionModule(
  input: ServerRunSchedulingCompositionModuleInput,
): ServerRunSchedulingCompositionModuleOutput {
  const imageRunExecutionNodeSelectionService = new ImageRunExecutionNodeSelectionService({
    eligibilityService: input.nodeEligibilityEvaluationService,
    auditSink: input.executionNodeManagementAuditSink,
  });
  const getImageManipulationExecutionReadinessUseCase = new GetImageManipulationExecutionReadinessUseCase({
    capabilityPort: input.runExecutionAdapters?.capabilityProbePort,
    nodeSelectionService: imageRunExecutionNodeSelectionService,
    now: () => input.workspaceClock.now(),
  });
  const imageRunSubmissionReadinessValidationService = new ImageRunSubmissionReadinessValidationService({
    workflowRepository: input.persistentPlatformServices.imageWorkflowSystemRepository,
    systemRepository: input.persistentPlatformServices.imageWorkflowSystemRepository,
    assetRepository: input.persistentPlatformServices.assetRepository,
    authorizationDecisionEvaluator: input.authorizationDecisionEvaluator,
    executionReadinessUseCase: getImageManipulationExecutionReadinessUseCase,
    now: () => input.workspaceClock.now(),
  });

  return Object.freeze({
    imageRunExecutionNodeSelectionService,
    getImageManipulationExecutionReadinessUseCase,
    imageRunSubmissionReadinessValidationService,
  });
}
