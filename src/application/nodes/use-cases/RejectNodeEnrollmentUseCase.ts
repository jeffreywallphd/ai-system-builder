import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationStates,
  NodeTrustStates,
  createNodeEnrollmentRequest,
  transitionNodeEnrollmentRequestStatus,
} from "../../../domain/nodes/NodeTrustDomain";
import type {
  NodeEnrollmentRequestPersistenceRecord,
  NodeIdentityPersistenceRecord,
  NodeTrustPersistenceMutationResult,
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
  DefaultNodeTrustUseCaseIdGenerator,
  NodeTrustUseCaseErrorCodes,
  type NodeTrustUseCaseClock,
  type NodeTrustUseCaseIdGenerator,
  type NodeTrustUseCaseOutcome,
  createNodeTrustMutationEnvelope,
  mapNodeTrustDomainError,
  normalizeOptional,
  normalizeRequired,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";

export interface RejectNodeEnrollmentUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly requestId: string;
  readonly decisionNote?: string;
  readonly reviewedAt?: string;
  readonly expectedEnrollmentRevision?: number;
  readonly expectedNodeRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RejectNodeEnrollmentUseCaseResponse {
  readonly enrollmentRequest: NodeEnrollmentRequestPersistenceRecord;
  readonly node?: NodeIdentityPersistenceRecord;
  readonly enrollmentMutation: NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>;
  readonly nodeMutation?: NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>;
}

interface RejectNodeEnrollmentUseCaseDependencies {
  readonly enrollmentRequestRepository: INodeEnrollmentRequestPersistenceRepository;
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class RejectNodeEnrollmentUseCase {
  private readonly idGenerator: NodeTrustUseCaseIdGenerator;

  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: RejectNodeEnrollmentUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultNodeTrustUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: RejectNodeEnrollmentUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<RejectNodeEnrollmentUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const requestId = normalizeRequired(request.requestId);
    if (!requestId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "requestId is required.");
    }

    const enrollment = await this.dependencies.enrollmentRequestRepository.findEnrollmentRequestById(requestId);
    if (!enrollment) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.notFound,
        `Enrollment request '${requestId}' was not found.`,
      );
    }

    const existingNode = await this.dependencies.nodeRepository.findNodeById(enrollment.nodeId);

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanRejectNode({
          actorUserIdentityId,
          enrollmentRequest: enrollment,
          existingNode,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to reject nodes.",
      );
    }

    let transitionTarget = enrollment;
    if (enrollment.status === NodeEnrollmentRequestStatuses.submitted) {
      const underReview = await this.dependencies.enrollmentRequestRepository.transitionEnrollmentRequestStatus({
        requestId: enrollment.requestId,
        toStatus: NodeEnrollmentRequestStatuses.underReview,
        mutation: createNodeTrustMutationEnvelope({
          actorUserIdentityId,
          operationPrefix: "reject-node-enrollment-under-review",
          idGenerator: this.idGenerator,
          clock: this.clock,
          expectedRevision: request.expectedEnrollmentRevision,
          reason: request.reason,
          correlationId: request.correlationId,
          metadata: request.metadata,
        }),
      });
      transitionTarget = underReview.record;
    }

    try {
      transitionNodeEnrollmentRequestStatus(
        createNodeEnrollmentRequest({
          requestId: transitionTarget.requestId,
          nodeId: transitionTarget.nodeId,
          nodeType: transitionTarget.nodeType,
          displayName: transitionTarget.displayName,
          capabilityProfile: transitionTarget.capabilityProfile,
          deploymentTags: transitionTarget.deploymentTags,
          certificateRef: transitionTarget.certificateRef,
          status: transitionTarget.status,
          requestedAt: transitionTarget.requestedAt,
          reviewedAt: transitionTarget.reviewedAt,
          reviewedByUserIdentityId: transitionTarget.reviewedByUserIdentityId,
          decisionNote: transitionTarget.decisionNote,
          updatedAt: transitionTarget.lastModifiedAt,
        }),
        NodeEnrollmentRequestStatuses.rejected,
        {
          reviewedAt: request.reviewedAt ?? this.clock.now().toISOString(),
          reviewedByUserIdentityId: actorUserIdentityId,
          decisionNote: request.decisionNote,
        },
      );
    } catch (error) {
      return mapNodeTrustDomainError(error, "Enrollment request cannot be rejected from its current state.")
        ?? toNodeTrustFailure(
          NodeTrustUseCaseErrorCodes.invalidState,
          "Enrollment request cannot be rejected from its current state.",
        );
    }

    const nowIso = this.clock.now().toISOString();
    const nodeMutation = existingNode
      ? await this.dependencies.nodeRepository.updateNodeApproval({
        nodeId: existingNode.nodeId,
        approvalStatus: NodeApprovalStatuses.rejected,
        trustState: NodeTrustStates.quarantined,
        mutation: createNodeTrustMutationEnvelope({
          actorUserIdentityId,
          operationPrefix: "reject-node",
          idGenerator: this.idGenerator,
          clock: this.clock,
          expectedRevision: request.expectedNodeRevision,
          reason: request.reason,
          correlationId: request.correlationId,
          metadata: request.metadata,
        }),
      })
      : await this.dependencies.nodeRepository.registerNode({
        record: {
          nodeId: enrollment.nodeId,
          nodeType: enrollment.nodeType,
          displayName: enrollment.displayName,
          capabilityProfile: enrollment.capabilityProfile,
          approvalStatus: NodeApprovalStatuses.rejected,
          trustState: NodeTrustStates.quarantined,
          deploymentTags: enrollment.deploymentTags,
          revocation: {
            state: NodeRevocationStates.active,
          },
          enrolledAt: enrollment.requestedAt,
          enrollmentRequestId: enrollment.requestId,
          createdAt: nowIso,
          createdBy: actorUserIdentityId,
          lastModifiedAt: nowIso,
          lastModifiedBy: actorUserIdentityId,
          revision: 0,
        },
        mutation: createNodeTrustMutationEnvelope({
          actorUserIdentityId,
          operationPrefix: "register-rejected-node",
          idGenerator: this.idGenerator,
          clock: this.clock,
          expectedRevision: request.expectedNodeRevision,
          reason: request.reason,
          correlationId: request.correlationId,
          metadata: request.metadata,
        }),
      });

    const enrollmentMutation = await this.dependencies.enrollmentRequestRepository.transitionEnrollmentRequestStatus({
      requestId,
      toStatus: NodeEnrollmentRequestStatuses.rejected,
      reviewedAt: request.reviewedAt ?? nowIso,
      reviewedByUserIdentityId: actorUserIdentityId,
      decisionNote: normalizeOptional(request.decisionNote),
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId,
        operationPrefix: "reject-node-enrollment",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedEnrollmentRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.nodeRejected,
      actorUserIdentityId,
      occurredAt: nowIso,
      nodeId: enrollment.nodeId,
      enrollmentRequestId: requestId,
      details: Object.freeze({
        trustState: nodeMutation.record.trustState,
        approvalStatus: nodeMutation.record.approvalStatus,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        enrollmentRequest: enrollmentMutation.record,
        node: nodeMutation.record,
        enrollmentMutation,
        nodeMutation,
      }),
    };
  }
}
