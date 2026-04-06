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
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "../../common/ports/PlatformTransactionPorts";
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
  isNodeTrustLifecycleRevoked,
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
  readonly transactionManager?: IPlatformTransactionManager;
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

    try {
      transitionNodeEnrollmentRequestStatus(
        createNodeEnrollmentRequest({
          requestId: enrollment.requestId,
          nodeId: enrollment.nodeId,
          nodeType: enrollment.nodeType,
          displayName: enrollment.displayName,
          capabilityProfile: enrollment.capabilityProfile,
          deploymentTags: enrollment.deploymentTags,
          certificateRef: enrollment.certificateRef,
          status: enrollment.status,
          requestedAt: enrollment.requestedAt,
          reviewedAt: enrollment.reviewedAt,
          reviewedByUserIdentityId: enrollment.reviewedByUserIdentityId,
          decisionNote: enrollment.decisionNote,
          updatedAt: enrollment.lastModifiedAt,
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
    let transitionTarget = enrollment;
    let nodeMutation: NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>;
    let enrollmentMutation: NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>;
    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
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

      nodeMutation = existingNode
        ? isNodeTrustLifecycleRevoked(existingNode)
          ? Object.freeze({
            record: existingNode,
            changed: false,
            wasReplay: false,
          })
          : await this.dependencies.nodeRepository.updateNodeApproval({
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
            nodeId: transitionTarget.nodeId,
            nodeType: transitionTarget.nodeType,
            displayName: transitionTarget.displayName,
            capabilityProfile: transitionTarget.capabilityProfile,
            approvalStatus: NodeApprovalStatuses.rejected,
            trustState: NodeTrustStates.quarantined,
            deploymentTags: transitionTarget.deploymentTags,
            revocation: {
              state: NodeRevocationStates.active,
            },
            enrolledAt: transitionTarget.requestedAt,
            enrollmentRequestId: transitionTarget.requestId,
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

      enrollmentMutation = await this.dependencies.enrollmentRequestRepository.transitionEnrollmentRequestStatus({
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
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.nodeRejected,
      actorUserIdentityId,
      occurredAt: nowIso,
      nodeId: enrollment.nodeId,
      enrollmentRequestId: requestId,
      outcome: "success",
      details: Object.freeze({
        nodeType: nodeMutation!.record.nodeType,
        trustState: nodeMutation!.record.trustState,
        approvalStatus: nodeMutation!.record.approvalStatus,
        deploymentTags: nodeMutation!.record.deploymentTags,
        reviewedAt: enrollmentMutation!.record.reviewedAt,
        reviewedByUserIdentityId: enrollmentMutation!.record.reviewedByUserIdentityId,
        decisionNote: enrollmentMutation!.record.decisionNote,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        enrollmentRequest: enrollmentMutation!.record,
        node: nodeMutation!.record,
        enrollmentMutation: enrollmentMutation!,
        nodeMutation: nodeMutation!,
      }),
    };
  }
}
