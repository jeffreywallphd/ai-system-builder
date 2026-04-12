import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import { GetExecutionNodeDetailUseCase } from "@application/nodes/use-cases/GetExecutionNodeDetailUseCase";
import { ImageRunNodeEligibilityEvaluationService } from "@application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService";
import { ListExecutionNodesUseCase } from "@application/nodes/use-cases/ListExecutionNodesUseCase";
import { SetExecutionNodeAvailabilityOverrideUseCase } from "@application/nodes/use-cases/SetExecutionNodeAvailabilityOverrideUseCase";
import type { AuthoritativeExecutionNodeManagementAuditSink } from "@infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink";
import { ExecutionNodeManagementBackendApi } from "@infrastructure/api/nodes/ExecutionNodeManagementBackendApi";
import type { SqliteExecutionNodeRepository } from "@infrastructure/persistence/nodes/SqliteExecutionNodeRepository";

export interface ServerExecutionNodeManagementCompositionModuleInput {
  readonly executionNodeRepository: SqliteExecutionNodeRepository;
  readonly executionNodeManagementAuditSink: AuthoritativeExecutionNodeManagementAuditSink;
  readonly workspaceClock: IIdentityClock;
}

export interface ServerExecutionNodeManagementCompositionModuleOutput {
  readonly nodeEligibilityEvaluationService: ImageRunNodeEligibilityEvaluationService;
  readonly executionNodeManagementBackendApi: ExecutionNodeManagementBackendApi;
}

export function composeServerExecutionNodeManagementCompositionModule(
  input: ServerExecutionNodeManagementCompositionModuleInput,
): ServerExecutionNodeManagementCompositionModuleOutput {
  const nodeEligibilityEvaluationService = new ImageRunNodeEligibilityEvaluationService({
    nodeRepository: input.executionNodeRepository,
  });

  const executionNodeManagementBackendApi = new ExecutionNodeManagementBackendApi({
    listExecutionNodesUseCase: new ListExecutionNodesUseCase({
      nodeRepository: input.executionNodeRepository,
    }),
    getExecutionNodeDetailUseCase: new GetExecutionNodeDetailUseCase({
      nodeRepository: input.executionNodeRepository,
    }),
    setExecutionNodeAvailabilityOverrideUseCase: new SetExecutionNodeAvailabilityOverrideUseCase({
      nodeRepository: input.executionNodeRepository,
      auditSink: input.executionNodeManagementAuditSink,
    }),
    eligibilityService: nodeEligibilityEvaluationService,
    clock: input.workspaceClock,
  });

  return Object.freeze({
    nodeEligibilityEvaluationService,
    executionNodeManagementBackendApi,
  });
}
