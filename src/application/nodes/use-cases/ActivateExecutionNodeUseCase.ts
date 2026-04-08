import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeHealthStatuses,
  recordExecutionNodeHealth,
  transitionExecutionNodeActivationStatus,
  type ExecutionNodeActivationStatus,
  type ExecutionNodeHealthStatus,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeTrustStates,
} from "@domain/nodes/NodeTrustDomain";
import type { ExecutionNodeMutationResult, IExecutionNodeRepository } from "../ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeManagementAuthorizationHook } from "../ports/ExecutionNodeManagementAuthorizationPorts";
import {
  DefaultExecutionNodeManagementUseCaseIdGenerator,
  ExecutionNodeManagementUseCaseErrorCodes,
  type ExecutionNodeManagementUseCaseClock,
  type ExecutionNodeManagementUseCaseIdGenerator,
  type ExecutionNodeManagementUseCaseOutcome,
  createExecutionNodeMutationContext,
  normalizeOptional,
  normalizeRequired,
  normalizeTimestamp,
  toExecutionNodeInternalSummary,
  toExecutionNodeManagementFailure,
} from "./ExecutionNodeManagementUseCaseShared";

export interface ActivateExecutionNodeUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly activatedAt?: string;
  readonly healthStatus?: ExecutionNodeHealthStatus;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface ActivateExecutionNodeUseCaseResponse {
  readonly node: ReturnType<typeof toExecutionNodeInternalSummary>;
  readonly mutation: ExecutionNodeMutationResult;
}

interface ActivateExecutionNodeUseCaseDependencies {
  readonly nodeRepository: IExecutionNodeRepository;
  readonly authorizationHook?: ExecutionNodeManagementAuthorizationHook;
  readonly idGenerator?: ExecutionNodeManagementUseCaseIdGenerator;
  readonly clock?: ExecutionNodeManagementUseCaseClock;
}

function transitionToActive(node: ExecutionNodeRecord, activatedAt: Date): ExecutionNodeRecord {
  let next = node;
  if (next.activationStatus === ExecutionNodeActivationStatuses.inactive) {
    next = transitionExecutionNodeActivationStatus(next, ExecutionNodeActivationStatuses.pending, activatedAt);
  }
  if (next.activationStatus === ExecutionNodeActivationStatuses.pending) {
    next = transitionExecutionNodeActivationStatus(next, ExecutionNodeActivationStatuses.approved, activatedAt);
  }
  if (next.activationStatus !== ExecutionNodeActivationStatuses.active) {
    next = transitionExecutionNodeActivationStatus(next, ExecutionNodeActivationStatuses.active, activatedAt);
  }

  return next;
}

export class ActivateExecutionNodeUseCase {
  private readonly idGenerator: ExecutionNodeManagementUseCaseIdGenerator;

  private readonly clock: ExecutionNodeManagementUseCaseClock;

  public constructor(private readonly dependencies: ActivateExecutionNodeUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultExecutionNodeManagementUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: ActivateExecutionNodeUseCaseRequest,
  ): Promise<ExecutionNodeManagementUseCaseOutcome<ActivateExecutionNodeUseCaseResponse>> {
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

    const node = await this.dependencies.nodeRepository.findExecutionNodeById(nodeId);
    if (!node) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.notFound,
        `Execution node '${nodeId}' was not found.`,
      );
    }

    try {
      await this.dependencies.authorizationHook?.assertCanActivateExecutionNode?.({
        actorUserIdentityId,
        node,
      });
    } catch (error) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to activate execution nodes.",
      );
    }

    if (node.approvalStatus !== NodeApprovalStatuses.approved) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidState,
        `Execution node '${node.nodeId}' must be approved before activation.`,
      );
    }

    if (node.trustState !== NodeTrustStates.trusted) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidState,
        `Execution node '${node.nodeId}' must be trusted before activation.`,
      );
    }

    if (!normalizeOptional(node.certificateRef)) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidState,
        `Execution node '${node.nodeId}' requires certificateRef before activation.`,
      );
    }

    const activatedAt = normalizeOptional(request.activatedAt) ?? this.clock.now().toISOString();
    let normalizedActivatedAt: string;
    try {
      normalizedActivatedAt = normalizeTimestamp(activatedAt, "activatedAt");
    } catch (error) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        error instanceof Error ? error.message : "activatedAt must be a valid timestamp.",
      );
    }
    const activationTime = new Date(normalizedActivatedAt);
    const requestedHealthStatus = request.healthStatus ?? ExecutionNodeHealthStatuses.ready;

    let activatedNode: ExecutionNodeRecord;
    try {
      const transitioned = transitionToActive(node, activationTime);
      activatedNode = recordExecutionNodeHealth(transitioned, {
        healthStatus: requestedHealthStatus,
        observedAt: activationTime,
      });
    } catch (error) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidState,
        error instanceof Error ? error.message : "Execution node activation payload is invalid.",
      );
    }

    const mutation = await this.dependencies.nodeRepository.saveExecutionNode({
      record: activatedNode,
      mutation: createExecutionNodeMutationContext({
        actorUserIdentityId,
        operationPrefix: "activate-execution-node",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
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
