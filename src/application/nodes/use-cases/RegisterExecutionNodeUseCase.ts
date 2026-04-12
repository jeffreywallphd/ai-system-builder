import {
  createExecutionNodeRecord,
  type ExecutionNodeActivationStatus,
  type ExecutionNodeBackendFamilyCapability,
  type ExecutionNodeHealthStatus,
} from "@domain/nodes/ExecutionNodeDomain";
import type {
  NodeApprovalStatus,
  NodeRoleCapability,
  NodeTrustState,
  NodeType,
} from "@domain/nodes/NodeTrustDomain";
import type { ExecutionNodeMutationResult, IExecutionNodeRepository } from "../ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeManagementAuthorizationHook } from "../ports/ExecutionNodeManagementAuthorizationPorts";
import {
  ExecutionNodeManagementAuditEventTypes,
  type ExecutionNodeManagementAuditSink,
  publishExecutionNodeManagementAuditEventBestEffort,
} from "../ports/ExecutionNodeManagementAuditPorts";
import {
  DefaultExecutionNodeManagementUseCaseIdGenerator,
  ExecutionNodeManagementUseCaseErrorCodes,
  type ExecutionNodeManagementUseCaseClock,
  type ExecutionNodeManagementUseCaseIdGenerator,
  type ExecutionNodeManagementUseCaseOutcome,
  createExecutionNodeMutationContext,
  mapExecutionNodeDomainError,
  normalizeOptional,
  normalizeRequired,
  toExecutionNodeInternalSummary,
  toExecutionNodeManagementFailure,
} from "./ExecutionNodeManagementUseCaseShared";

export interface RegisterExecutionNodeUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly displayName: string;
  readonly nodeType: NodeType;
  readonly capabilityProfile: {
    readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability>;
    readonly capabilityProfileVersion?: string;
    readonly supportsRemoteScheduling?: boolean;
    readonly maxConcurrentWorkloads?: number;
  };
  readonly backendFamilyCapabilities: ReadonlyArray<ExecutionNodeBackendFamilyCapability>;
  readonly endpointRef: string;
  readonly configurationRef?: string;
  readonly approvalStatus?: NodeApprovalStatus;
  readonly trustState?: NodeTrustState;
  readonly activationStatus?: ExecutionNodeActivationStatus;
  readonly healthStatus?: ExecutionNodeHealthStatus;
  readonly deploymentTags?: ReadonlyArray<string>;
  readonly certificateRef?: string;
  readonly lastSeenAt?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly createdAt?: string;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface RegisterExecutionNodeUseCaseResponse {
  readonly node: ReturnType<typeof toExecutionNodeInternalSummary>;
  readonly mutation: ExecutionNodeMutationResult;
}

interface RegisterExecutionNodeUseCaseDependencies {
  readonly nodeRepository: IExecutionNodeRepository;
  readonly authorizationHook?: ExecutionNodeManagementAuthorizationHook;
  readonly auditSink?: ExecutionNodeManagementAuditSink;
  readonly idGenerator?: ExecutionNodeManagementUseCaseIdGenerator;
  readonly clock?: ExecutionNodeManagementUseCaseClock;
}

export class RegisterExecutionNodeUseCase {
  private readonly idGenerator: ExecutionNodeManagementUseCaseIdGenerator;

  private readonly clock: ExecutionNodeManagementUseCaseClock;

  public constructor(private readonly dependencies: RegisterExecutionNodeUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultExecutionNodeManagementUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: RegisterExecutionNodeUseCaseRequest,
  ): Promise<ExecutionNodeManagementUseCaseOutcome<RegisterExecutionNodeUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const nodeId = normalizeRequired(request.nodeId);
    if (!nodeId) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "nodeId is required.",
      );
    }

    const existing = await this.dependencies.nodeRepository.findExecutionNodeById(nodeId);
    if (existing) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.conflict,
        `Execution node '${nodeId}' is already registered.`,
      );
    }

    const createdAt = normalizeOptional(request.createdAt) ?? this.clock.now().toISOString();

    let record: ReturnType<typeof createExecutionNodeRecord>;
    try {
      record = createExecutionNodeRecord({
        nodeId,
        displayName: request.displayName,
        nodeType: request.nodeType,
        capabilityProfile: request.capabilityProfile,
        backendFamilyCapabilities: request.backendFamilyCapabilities,
        approvalStatus: request.approvalStatus,
        trustState: request.trustState,
        activationStatus: request.activationStatus,
        healthStatus: request.healthStatus,
        deploymentTags: request.deploymentTags,
        endpoint: {
          endpointRef: request.endpointRef,
          configurationRef: request.configurationRef,
        },
        certificateRef: request.certificateRef,
        lastSeenAt: request.lastSeenAt,
        metadata: request.metadata,
        createdAt,
        updatedAt: createdAt,
      });
    } catch (error) {
      return mapExecutionNodeDomainError(error, "Execution node registration payload is invalid.")
        ?? toExecutionNodeManagementFailure(
          ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
          "Execution node registration payload is invalid.",
        );
    }

    try {
      await this.dependencies.authorizationHook?.assertCanRegisterExecutionNode?.({
        actorUserIdentityId,
        node: record,
      });
    } catch (error) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to register execution nodes.",
      );
    }

    const mutation = await this.dependencies.nodeRepository.registerExecutionNode({
      record,
      mutation: createExecutionNodeMutationContext({
        actorUserIdentityId,
        operationPrefix: "register-execution-node",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
      }),
    });

    await publishExecutionNodeManagementAuditEventBestEffort(this.dependencies.auditSink, {
      type: ExecutionNodeManagementAuditEventTypes.executionNodeRegistered,
      actorUserIdentityId,
      occurredAt: mutation.record.updatedAt,
      nodeId: mutation.record.nodeId,
      outcome: mutation.wasReplay ? "already-applied" : "success",
      details: Object.freeze({
        backendFamilies: Object.freeze(mutation.record.backendFamilyCapabilities.map((entry) => entry.backendFamily)),
        activationStatus: mutation.record.activationStatus,
        healthStatus: mutation.record.healthStatus,
        nodeType: mutation.record.nodeType,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        node: toExecutionNodeInternalSummary(mutation.record),
        mutation,
      }),
    };
  }
}
