import type { NodeEnrollmentRequestPersistenceRecord } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import { NodeTrustPersistenceQueryPresets } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { NodeTrustAuthorizationHook } from "../ports/NodeTrustAuthorizationPorts";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import {
  NodeTrustUseCaseErrorCodes,
  type NodeTrustUseCaseClock,
  type NodeTrustUseCaseOutcome,
  normalizeOptional,
  normalizeRequired,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";
import {
  NodeTrustAuditEventTypes,
  publishNodeTrustAuditEventBestEffort,
  type NodeTrustAuditSink,
} from "../ports/NodeTrustAuditPorts";

export interface ReviewPendingNodeEnrollmentUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId?: string;
  readonly statuses?: ReadonlyArray<typeof NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses[number]>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ReviewPendingNodeEnrollmentUseCaseResponse {
  readonly enrollments: ReadonlyArray<NodeEnrollmentRequestPersistenceRecord>;
}

interface ReviewPendingNodeEnrollmentUseCaseDependencies {
  readonly enrollmentRequestRepository: INodeEnrollmentRequestPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class ReviewPendingNodeEnrollmentUseCase {
  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: ReviewPendingNodeEnrollmentUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: ReviewPendingNodeEnrollmentUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<ReviewPendingNodeEnrollmentUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const nodeId = normalizeOptional(request.nodeId);

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanReviewPendingEnrollment({
          actorUserIdentityId,
          nodeId,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to review pending enrollments.",
      );
    }

    const statuses = request.statuses && request.statuses.length > 0
      ? request.statuses
      : NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses;

    const enrollments = await this.dependencies.enrollmentRequestRepository.listEnrollmentRequests({
      nodeId,
      statuses,
      includeTerminal: false,
      limit: request.limit,
      offset: request.offset,
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.pendingEnrollmentReviewed,
      actorUserIdentityId,
      occurredAt: this.clock.now().toISOString(),
      outcome: "success",
      details: Object.freeze({
        nodeId,
        statuses,
        statusCount: statuses.length,
        returned: enrollments.length,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        enrollments,
      }),
    };
  }
}

