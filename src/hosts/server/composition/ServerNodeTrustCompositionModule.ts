import type { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import { ApproveNodeEnrollmentUseCase } from "@application/nodes/use-cases/ApproveNodeEnrollmentUseCase";
import { GetExecutionNodeDetailUseCase } from "@application/nodes/use-cases/GetExecutionNodeDetailUseCase";
import { GetNodeEnrollmentDetailUseCase } from "@application/nodes/use-cases/GetNodeEnrollmentDetailUseCase";
import { GetNodeInventoryDetailUseCase } from "@application/nodes/use-cases/GetNodeInventoryDetailUseCase";
import { ImageRunNodeEligibilityEvaluationService } from "@application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService";
import { ListExecutionNodesUseCase } from "@application/nodes/use-cases/ListExecutionNodesUseCase";
import { ListNodeInventoryUseCase } from "@application/nodes/use-cases/ListNodeInventoryUseCase";
import { ListTrustedNodeInventoryUseCase } from "@application/nodes/use-cases/ListTrustedNodeInventoryUseCase";
import { RecordNodeHeartbeatUseCase } from "@application/nodes/use-cases/RecordNodeHeartbeatUseCase";
import { RecordNodeOperationalUpdateUseCase } from "@application/nodes/use-cases/RecordNodeOperationalUpdateUseCase";
import { RegisterNodeEnrollmentRequestUseCase } from "@application/nodes/use-cases/RegisterNodeEnrollmentRequestUseCase";
import { RejectNodeEnrollmentUseCase } from "@application/nodes/use-cases/RejectNodeEnrollmentUseCase";
import { ResolveApprovedNodeRuntimeTrustMaterialUseCase } from "@application/nodes/use-cases/ResolveApprovedNodeRuntimeTrustMaterialUseCase";
import { ResolveNodeMutualTlsTransportIdentityUseCase } from "@application/nodes/use-cases/ResolveNodeMutualTlsTransportIdentityUseCase";
import { RevokeNodeTrustUseCase } from "@application/nodes/use-cases/RevokeNodeTrustUseCase";
import { ReviewPendingNodeEnrollmentUseCase } from "@application/nodes/use-cases/ReviewPendingNodeEnrollmentUseCase";
import { SetExecutionNodeAvailabilityOverrideUseCase } from "@application/nodes/use-cases/SetExecutionNodeAvailabilityOverrideUseCase";
import { FanoutNodeTrustAuditSink } from "@infrastructure/audit/AuditFanoutPublishers";
import { AuthoritativeExecutionNodeManagementAuditSink } from "@infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink";
import { AuthoritativeNodeTrustAuditSink } from "@infrastructure/audit/AuthoritativeNodeTrustAuditSink";
import { ExecutionNodeManagementBackendApi } from "@infrastructure/api/nodes/ExecutionNodeManagementBackendApi";
import { NodeTrustBackendApi } from "@infrastructure/api/nodes/NodeTrustBackendApi";
import type { SqliteNodeTrustAuditRecorder } from "@infrastructure/persistence/nodes/SqliteNodeTrustAuditRecorder";
import type { SqliteNodeTrustPersistenceAdapter } from "@infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter";
import type { SqliteExecutionNodeRepository } from "@infrastructure/persistence/nodes/SqliteExecutionNodeRepository";
import type { ResolveRuntimeTrustMaterialPackageUseCase } from "@application/security/use-cases/ResolveRuntimeTrustMaterialPackageUseCase";

export interface ServerNodeTrustCompositionModuleInput {
  readonly nodeTrustRepository: SqliteNodeTrustPersistenceAdapter;
  readonly executionNodeRepository: SqliteExecutionNodeRepository;
  readonly nodeTrustAuditRecorder: SqliteNodeTrustAuditRecorder;
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly runtimeTrustMaterialResolver: ResolveRuntimeTrustMaterialPackageUseCase | undefined;
  readonly workspaceClock: {
    now(): Date;
  };
}

export interface ServerNodeTrustCompositionModuleOutput {
  readonly nodeTrustBackendApi: NodeTrustBackendApi;
  readonly executionNodeManagementBackendApi: ExecutionNodeManagementBackendApi;
}

export function composeServerNodeTrustCompositionModule(
  input: ServerNodeTrustCompositionModuleInput,
): ServerNodeTrustCompositionModuleOutput {
  const nodeTrustAuditSink = new FanoutNodeTrustAuditSink([
    input.nodeTrustAuditRecorder,
    new AuthoritativeNodeTrustAuditSink(input.authoritativeAuditRecorder),
  ]);
  const executionNodeManagementAuditSink = new AuthoritativeExecutionNodeManagementAuditSink(
    input.authoritativeAuditRecorder,
  );

  const nodeTrustBackendApi = new NodeTrustBackendApi({
    registerNodeEnrollmentRequestUseCase: new RegisterNodeEnrollmentRequestUseCase({
      enrollmentRequestRepository: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    reviewPendingNodeEnrollmentUseCase: new ReviewPendingNodeEnrollmentUseCase({
      enrollmentRequestRepository: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    getNodeEnrollmentDetailUseCase: new GetNodeEnrollmentDetailUseCase({
      enrollmentRequestRepository: input.nodeTrustRepository,
    }),
    getNodeInventoryDetailUseCase: new GetNodeInventoryDetailUseCase({
      nodeRepository: input.nodeTrustRepository,
      enrollmentRequestRepository: input.nodeTrustRepository,
    }),
    approveNodeEnrollmentUseCase: new ApproveNodeEnrollmentUseCase({
      enrollmentRequestRepository: input.nodeTrustRepository,
      nodeRepository: input.nodeTrustRepository,
      transactionManager: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    rejectNodeEnrollmentUseCase: new RejectNodeEnrollmentUseCase({
      enrollmentRequestRepository: input.nodeTrustRepository,
      nodeRepository: input.nodeTrustRepository,
      transactionManager: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    revokeNodeTrustUseCase: new RevokeNodeTrustUseCase({
      nodeRepository: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    recordNodeHeartbeatUseCase: new RecordNodeHeartbeatUseCase({
      nodeRepository: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    recordNodeOperationalUpdateUseCase: new RecordNodeOperationalUpdateUseCase({
      nodeRepository: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    resolveApprovedNodeRuntimeTrustMaterialUseCase: new ResolveApprovedNodeRuntimeTrustMaterialUseCase({
      nodeRepository: input.nodeTrustRepository,
      runtimeTrustMaterialResolver: input.runtimeTrustMaterialResolver,
    }),
    resolveNodeMutualTlsTransportIdentityUseCase: new ResolveNodeMutualTlsTransportIdentityUseCase({
      nodeRepository: input.nodeTrustRepository,
    }),
    listTrustedNodeInventoryUseCase: new ListTrustedNodeInventoryUseCase({
      nodeRepository: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
    listNodeInventoryUseCase: new ListNodeInventoryUseCase({
      nodeRepository: input.nodeTrustRepository,
      enrollmentRequestRepository: input.nodeTrustRepository,
      auditSink: nodeTrustAuditSink,
    }),
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
      auditSink: executionNodeManagementAuditSink,
    }),
    eligibilityService: new ImageRunNodeEligibilityEvaluationService({
      nodeRepository: input.executionNodeRepository,
    }),
    clock: input.workspaceClock,
  });

  return Object.freeze({
    nodeTrustBackendApi,
    executionNodeManagementBackendApi,
  });
}
