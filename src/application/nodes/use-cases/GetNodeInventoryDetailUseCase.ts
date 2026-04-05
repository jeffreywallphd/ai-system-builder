import { NodeEnrollmentRequestStatuses } from "../../../domain/nodes/NodeTrustDomain";
import type {
  NodeEnrollmentRequestPersistenceRecord,
  NodeIdentityPersistenceLookupQuery,
  NodeIdentityPersistenceRecord,
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
  type NodeInventoryDetailReadModel,
  toNodeInventoryDetailReadModel,
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

export interface GetNodeInventoryDetailUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
}

export interface GetNodeInventoryDetailUseCaseResponse {
  readonly node: NodeInventoryDetailReadModel;
}

interface GetNodeInventoryDetailUseCaseDependencies {
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly enrollmentRequestRepository: INodeEnrollmentRequestPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class GetNodeInventoryDetailUseCase {
  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: GetNodeInventoryDetailUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: GetNodeInventoryDetailUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<GetNodeInventoryDetailUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const nodeId = normalizeRequired(request.nodeId);
    if (!nodeId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "nodeId is required.");
    }

    const nodeQuery: NodeIdentityPersistenceLookupQuery = Object.freeze({
      includeRevoked: true,
      activeOnly: false,
    });

    try {
      if (this.dependencies.authorizationHook?.assertCanQueryNodeInventory) {
        await this.dependencies.authorizationHook.assertCanQueryNodeInventory({
          actorUserIdentityId,
          nodeQuery,
          nodeId,
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
        error instanceof Error ? error.message : "Actor is not authorized to query node inventory details.",
      );
    }

    const [node, pendingEnrollment] = await Promise.all([
      this.dependencies.nodeRepository.findNodeById(nodeId),
      this.dependencies.enrollmentRequestRepository.findPendingEnrollmentRequestByNodeId(nodeId),
    ]);

    if (!node && !pendingEnrollment) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.notFound, `Node '${nodeId}' was not found.`);
    }

    const detail = this.toDetail(node, pendingEnrollment);

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.inventoryDetailQueried,
      actorUserIdentityId,
      occurredAt: this.clock.now().toISOString(),
      nodeId,
      details: Object.freeze({
        pendingEnrollmentRequestId: pendingEnrollment?.requestId,
        trustState: detail.trustState,
        operationalState: detail.operationalState,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        node: detail,
      }),
    };
  }

  private toDetail(
    node: NodeIdentityPersistenceRecord | undefined,
    pendingEnrollment: NodeEnrollmentRequestPersistenceRecord | undefined,
  ): NodeInventoryDetailReadModel {
    if (node) {
      return toNodeInventoryDetailReadModel(
        toNodeInventorySummaryReadModel(node, pendingEnrollment),
        pendingEnrollment,
      );
    }

    if (
      pendingEnrollment
      && (
        pendingEnrollment.status === NodeEnrollmentRequestStatuses.submitted
        || pendingEnrollment.status === NodeEnrollmentRequestStatuses.underReview
      )
    ) {
      return toNodeInventoryDetailReadModel(
        toPendingEnrollmentInventorySummaryReadModel(pendingEnrollment),
        pendingEnrollment,
      );
    }

    throw new Error("Node inventory detail could not be resolved.");
  }
}
