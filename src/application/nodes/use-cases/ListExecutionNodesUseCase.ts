import {
  ExecutionNodeActivationStatuses,
  ExecutionNodeHealthStatuses,
  type ExecutionNodeActivationStatus,
  type ExecutionNodeBackendReadinessState,
  type ExecutionNodeHealthStatus,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import type {
  NodeApprovalStatus,
  NodeRoleCapability,
  NodeTrustState,
  NodeType,
} from "@domain/nodes/NodeTrustDomain";
import type { ExecutionNodeListQuery, IExecutionNodeRepository } from "../ports/ExecutionNodeManagementPorts";
import type { ExecutionNodeManagementAuthorizationHook } from "../ports/ExecutionNodeManagementAuthorizationPorts";
import {
  ExecutionNodeManagementUseCaseErrorCodes,
  type ExecutionNodeManagementUseCaseClock,
  type ExecutionNodeManagementUseCaseOutcome,
  normalizeRequired,
  toExecutionNodeInternalSummary,
  toExecutionNodeManagementFailure,
} from "./ExecutionNodeManagementUseCaseShared";

const EnabledExecutionNodeActivationStatuses = Object.freeze([
  ExecutionNodeActivationStatuses.active,
  ExecutionNodeActivationStatuses.degraded,
  ExecutionNodeActivationStatuses.unavailable,
] as const satisfies ReadonlyArray<ExecutionNodeActivationStatus>);

const DisabledExecutionNodeActivationStatuses = Object.freeze([
  ExecutionNodeActivationStatuses.inactive,
  ExecutionNodeActivationStatuses.pending,
  ExecutionNodeActivationStatuses.approved,
  ExecutionNodeActivationStatuses.revoked,
] as const satisfies ReadonlyArray<ExecutionNodeActivationStatus>);

const AvailableExecutionNodeActivationStatuses = new Set<ExecutionNodeActivationStatus>([
  ExecutionNodeActivationStatuses.active,
  ExecutionNodeActivationStatuses.degraded,
]);

const AvailableExecutionNodeHealthStatuses = new Set<ExecutionNodeHealthStatus>([
  ExecutionNodeHealthStatuses.ready,
  ExecutionNodeHealthStatuses.degraded,
]);

export interface ListExecutionNodesUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeIds?: ReadonlyArray<string>;
  readonly nodeTypes?: ReadonlyArray<NodeType>;
  readonly approvalStatuses?: ReadonlyArray<NodeApprovalStatus>;
  readonly trustStates?: ReadonlyArray<NodeTrustState>;
  readonly activationStatuses?: ReadonlyArray<ExecutionNodeActivationStatus>;
  readonly healthStatuses?: ReadonlyArray<ExecutionNodeHealthStatus>;
  readonly backendFamilies?: ReadonlyArray<string>;
  readonly executionTargets?: ReadonlyArray<string>;
  readonly requiredCapabilitiesAnyOf?: ReadonlyArray<NodeRoleCapability>;
  readonly supportsRemoteScheduling?: boolean;
  readonly requireCertificateRef?: boolean;
  readonly deploymentTagAnyOf?: ReadonlyArray<string>;
  readonly backendReadinessStates?: ReadonlyArray<ExecutionNodeBackendReadinessState>;
  readonly includeRevoked?: boolean;
  readonly lastSeenAfter?: string;
  readonly lastSeenBefore?: string;
  readonly enabled?: boolean;
  readonly available?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListExecutionNodesUseCaseResponse {
  readonly nodes: ReadonlyArray<ReturnType<typeof toExecutionNodeInternalSummary>>;
  readonly totalCount: number;
  readonly asOf: string;
}

interface ListExecutionNodesUseCaseDependencies {
  readonly nodeRepository: IExecutionNodeRepository;
  readonly authorizationHook?: ExecutionNodeManagementAuthorizationHook;
  readonly clock?: ExecutionNodeManagementUseCaseClock;
}

function normalizePaging(input: {
  readonly limit?: number;
  readonly offset?: number;
}): ExecutionNodeManagementUseCaseOutcome<{
  readonly limit?: number;
  readonly offset: number;
}> {
  const { limit, offset } = input;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    return toExecutionNodeManagementFailure(
      ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
      "limit must be a positive integer when provided.",
    );
  }

  if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
    return toExecutionNodeManagementFailure(
      ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
      "offset must be zero or a positive integer when provided.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      limit,
      offset: offset ?? 0,
    }),
  };
}

function isNodeAvailable(record: ExecutionNodeRecord): boolean {
  return AvailableExecutionNodeActivationStatuses.has(record.activationStatus)
    && AvailableExecutionNodeHealthStatuses.has(record.healthStatus);
}

function hasBackendReadiness(
  record: ExecutionNodeRecord,
  requiredStates: ReadonlySet<ExecutionNodeBackendReadinessState>,
): boolean {
  if (requiredStates.size === 0) {
    return true;
  }

  return record.backendFamilyCapabilities.some((capability) => {
    const readinessState = capability.executionReadiness?.state ?? "unknown";
    return requiredStates.has(readinessState);
  });
}

function mergeActivationStatusFilter(
  requested?: ReadonlyArray<ExecutionNodeActivationStatus>,
  enabled?: boolean,
): ReadonlyArray<ExecutionNodeActivationStatus> | undefined {
  if (enabled === undefined) {
    return requested;
  }

  const enabledSet = new Set<ExecutionNodeActivationStatus>(
    enabled ? EnabledExecutionNodeActivationStatuses : DisabledExecutionNodeActivationStatuses,
  );
  if (!requested || requested.length === 0) {
    return Object.freeze([...enabledSet.values()]);
  }

  const merged = requested.filter((status) => enabledSet.has(status));
  return merged.length > 0 ? Object.freeze(merged) : Object.freeze([]);
}

export class ListExecutionNodesUseCase {
  private readonly clock: ExecutionNodeManagementUseCaseClock;

  public constructor(private readonly dependencies: ListExecutionNodesUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: ListExecutionNodesUseCaseRequest,
  ): Promise<ExecutionNodeManagementUseCaseOutcome<ListExecutionNodesUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const paging = normalizePaging({
      limit: request.limit,
      offset: request.offset,
    });
    if (!paging.ok) {
      return paging;
    }

    const activationStatuses = mergeActivationStatusFilter(request.activationStatuses, request.enabled);
    if (activationStatuses && activationStatuses.length === 0) {
      return {
        ok: true,
        value: Object.freeze({
          nodes: Object.freeze([]),
          totalCount: 0,
          asOf: this.clock.now().toISOString(),
        }),
      };
    }

    const query: ExecutionNodeListQuery = Object.freeze({
      nodeIds: request.nodeIds,
      backendFamilies: request.backendFamilies,
      executionTargets: request.executionTargets,
      activationStatuses,
      healthStatuses: request.healthStatuses,
      approvalStatuses: request.approvalStatuses,
      trustStates: request.trustStates,
      requiredCapabilitiesAnyOf: request.requiredCapabilitiesAnyOf,
      supportsRemoteScheduling: request.supportsRemoteScheduling,
      requireCertificateRef: request.requireCertificateRef,
      deploymentTagAnyOf: request.deploymentTagAnyOf,
      includeRevoked: request.includeRevoked,
      lastSeenAfter: request.lastSeenAfter,
      lastSeenBefore: request.lastSeenBefore,
    });

    try {
      await this.dependencies.authorizationHook?.assertCanQueryExecutionNodes?.({
        actorUserIdentityId,
        query,
      });
    } catch (error) {
      return toExecutionNodeManagementFailure(
        ExecutionNodeManagementUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to list execution nodes.",
      );
    }

    const backendReadinessStates = new Set<ExecutionNodeBackendReadinessState>(
      request.backendReadinessStates ?? [],
    );
    const records = await this.dependencies.nodeRepository.listExecutionNodes(query);
    const filtered = records.filter((record) => {
      if (request.nodeTypes && request.nodeTypes.length > 0 && !request.nodeTypes.includes(record.nodeType)) {
        return false;
      }

      if (typeof request.available === "boolean") {
        const available = isNodeAvailable(record);
        if (available !== request.available) {
          return false;
        }
      }

      if (!hasBackendReadiness(record, backendReadinessStates)) {
        return false;
      }

      return true;
    });

    filtered.sort((left, right) => {
      if (left.updatedAt !== right.updatedAt) {
        return right.updatedAt.localeCompare(left.updatedAt);
      }
      return left.nodeId.localeCompare(right.nodeId);
    });

    const totalCount = filtered.length;
    const paged = paging.value.limit === undefined
      ? filtered.slice(paging.value.offset)
      : filtered.slice(paging.value.offset, paging.value.offset + paging.value.limit);

    return {
      ok: true,
      value: Object.freeze({
        nodes: Object.freeze(paged.map((record) => toExecutionNodeInternalSummary(record))),
        totalCount,
        asOf: this.clock.now().toISOString(),
      }),
    };
  }
}
