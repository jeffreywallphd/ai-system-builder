import { NodeEnrollmentRequestStatuses } from "../../../domain/nodes/NodeTrustDomain";
import type {
  NodeEnrollmentRequestPersistenceRecord,
  NodeEnrollmentRequestPersistenceLookupQuery,
  NodeIdentityPersistenceLookupQuery,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import type { NodeTrustAuthorizationHook } from "../ports/NodeTrustAuthorizationPorts";
import {
  NodeTrustAuditEventTypes,
  publishNodeTrustAuditEventBestEffort,
  type NodeTrustAuditSink,
} from "../ports/NodeTrustAuditPorts";
import {
  NodeInventoryOperationalStates,
  type NodeInventoryOperationalState,
  NodeInventoryPresenceStates,
  type NodeInventoryPresenceState,
  type NodeInventorySummaryReadModel,
  toNodeInventorySummaryReadModel,
  toPendingEnrollmentInventorySummaryReadModel,
} from "./NodeInventoryReadModels";
import {
  NodeTrustUseCaseErrorCodes,
  type NodeTrustUseCaseClock,
  type NodeTrustUseCaseOutcome,
  normalizeRequired,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";

export interface ListNodeInventoryUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeTypes?: NodeIdentityPersistenceLookupQuery["nodeTypes"];
  readonly approvalStatuses?: NodeIdentityPersistenceLookupQuery["approvalStatuses"];
  readonly capabilityAnyOf?: NodeIdentityPersistenceLookupQuery["capabilityAnyOf"];
  readonly deploymentTagAnyOf?: NodeIdentityPersistenceLookupQuery["deploymentTagAnyOf"];
  readonly presenceStates?: ReadonlyArray<NodeInventoryPresenceState>;
  readonly operationalStates?: ReadonlyArray<NodeInventoryOperationalState>;
  readonly lastSeenAfter?: string;
  readonly lastSeenBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListNodeInventoryUseCaseResponse {
  readonly nodes: ReadonlyArray<NodeInventorySummaryReadModel>;
}

interface ListNodeInventoryUseCaseDependencies {
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly enrollmentRequestRepository: INodeEnrollmentRequestPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class ListNodeInventoryUseCase {
  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: ListNodeInventoryUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: ListNodeInventoryUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<ListNodeInventoryUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const nodeQuery: NodeIdentityPersistenceLookupQuery = Object.freeze({
      nodeTypes: request.nodeTypes,
      approvalStatuses: request.approvalStatuses,
      capabilityAnyOf: request.capabilityAnyOf,
      deploymentTagAnyOf: request.deploymentTagAnyOf,
      includeRevoked: true,
      activeOnly: false,
      lastSeenAfter: request.lastSeenAfter,
      lastSeenBefore: request.lastSeenBefore,
    });

    const includePendingEnrollments = request.operationalStates === undefined
      || request.operationalStates.includes(NodeInventoryOperationalStates.pending);
    const enrollmentQuery: NodeEnrollmentRequestPersistenceLookupQuery | undefined = includePendingEnrollments
      ? Object.freeze({
        nodeTypes: request.nodeTypes,
        statuses: [
          NodeEnrollmentRequestStatuses.submitted,
          NodeEnrollmentRequestStatuses.underReview,
        ],
        includeTerminal: false,
      })
      : undefined;

    try {
      if (this.dependencies.authorizationHook?.assertCanQueryNodeInventory) {
        await this.dependencies.authorizationHook.assertCanQueryNodeInventory({
          actorUserIdentityId,
          nodeQuery,
          enrollmentQuery,
        });
      } else if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanQueryTrustedNodeInventory({
          actorUserIdentityId,
          query: nodeQuery,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to query node inventory.",
      );
    }

    const [nodes, pendingEnrollments] = await Promise.all([
      this.dependencies.nodeRepository.listNodes(nodeQuery),
      enrollmentQuery
        ? this.dependencies.enrollmentRequestRepository.listEnrollmentRequests(enrollmentQuery)
        : Promise.resolve<ReadonlyArray<NodeEnrollmentRequestPersistenceRecord>>(Object.freeze([])),
    ]);

    const pendingByNodeId = new Map(pendingEnrollments.map((entry) => [entry.nodeId, entry] as const));
    const records: NodeInventorySummaryReadModel[] = [];

    for (const node of nodes) {
      records.push(toNodeInventorySummaryReadModel(node, pendingByNodeId.get(node.nodeId)));
    }

    for (const enrollment of pendingEnrollments) {
      if (pendingByNodeId.get(enrollment.nodeId)?.requestId !== enrollment.requestId) {
        continue;
      }

      const existingNode = nodes.find((node) => node.nodeId === enrollment.nodeId);
      if (existingNode) {
        continue;
      }

      records.push(toPendingEnrollmentInventorySummaryReadModel(enrollment));
    }

    const filtered = records.filter((record) => this.matchesOperationalFilters(record, request));
    filtered.sort((left, right) => {
      const leftStamp = left.lastSeen?.lastSeenAt ?? left.approvedAt ?? left.enrolledAt ?? left.requestedAt ?? "";
      const rightStamp = right.lastSeen?.lastSeenAt ?? right.approvedAt ?? right.enrolledAt ?? right.requestedAt ?? "";
      if (leftStamp !== rightStamp) {
        return rightStamp.localeCompare(leftStamp);
      }
      return left.nodeId.localeCompare(right.nodeId);
    });

    const offset = Number.isInteger(request.offset) && (request.offset ?? -1) >= 0 ? request.offset as number : 0;
    const limit = Number.isInteger(request.limit) && (request.limit ?? 0) > 0 ? request.limit as number : undefined;
    const paged = limit === undefined
      ? filtered.slice(offset)
      : filtered.slice(offset, offset + limit);

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.inventoryQueried,
      actorUserIdentityId,
      occurredAt: this.clock.now().toISOString(),
      details: Object.freeze({
        returned: paged.length,
        totalMatched: filtered.length,
        operationalStates: request.operationalStates,
        presenceStates: request.presenceStates,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        nodes: Object.freeze(paged),
      }),
    };
  }

  private matchesOperationalFilters(
    record: NodeInventorySummaryReadModel,
    request: ListNodeInventoryUseCaseRequest,
  ): boolean {
    if (request.operationalStates && request.operationalStates.length > 0) {
      if (!request.operationalStates.includes(record.operationalState)) {
        return false;
      }
    }

    if (request.approvalStatuses && request.approvalStatuses.length > 0) {
      if (!request.approvalStatuses.includes(record.approvalStatus)) {
        return false;
      }
    }

    if (request.presenceStates && request.presenceStates.length > 0) {
      if (!request.presenceStates.includes(record.presenceState)) {
        return false;
      }
    }

    if (request.capabilityAnyOf && request.capabilityAnyOf.length > 0) {
      const hasAny = request.capabilityAnyOf
        .some((capability) => record.capabilityProfile.enabledCapabilities.includes(capability));
      if (!hasAny) {
        return false;
      }
    }

    if (request.deploymentTagAnyOf && request.deploymentTagAnyOf.length > 0) {
      const normalizedQueryTags = request.deploymentTagAnyOf
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);
      if (normalizedQueryTags.length > 0) {
        const recordTags = new Set(record.deploymentTags.map((tag) => tag.trim().toLowerCase()));
        if (!normalizedQueryTags.some((tag) => recordTags.has(tag))) {
          return false;
        }
      }
    }

    if (record.presenceState === NodeInventoryPresenceStates.unknown && request.lastSeenAfter) {
      return false;
    }

    if (request.lastSeenAfter && record.lastSeen && record.lastSeen.lastSeenAt < request.lastSeenAfter) {
      return false;
    }

    if (request.lastSeenBefore && record.lastSeen && record.lastSeen.lastSeenAt > request.lastSeenBefore) {
      return false;
    }

    return true;
  }
}
