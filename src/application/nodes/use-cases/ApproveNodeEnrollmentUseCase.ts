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
import type { NodeTrustCertificateHook } from "../ports/NodeTrustCertificatePorts";
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

export interface ApproveNodeEnrollmentUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly requestId: string;
  readonly certificateRef?: string;
  readonly certificateAuthorityRef?: string;
  readonly certificateThumbprint?: string;
  readonly certificateExpiresAt?: string;
  readonly decisionNote?: string;
  readonly reviewedAt?: string;
  readonly expectedEnrollmentRevision?: number;
  readonly expectedNodeRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ApproveNodeEnrollmentUseCaseResponse {
  readonly enrollmentRequest: NodeEnrollmentRequestPersistenceRecord;
  readonly node: NodeIdentityPersistenceRecord;
  readonly enrollmentMutation: NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>;
  readonly nodeMutation: NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>;
}

interface ApproveNodeEnrollmentUseCaseDependencies {
  readonly enrollmentRequestRepository: INodeEnrollmentRequestPersistenceRepository;
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly certificateHook?: NodeTrustCertificateHook;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class ApproveNodeEnrollmentUseCase {
  private readonly idGenerator: NodeTrustUseCaseIdGenerator;

  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: ApproveNodeEnrollmentUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultNodeTrustUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: ApproveNodeEnrollmentUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<ApproveNodeEnrollmentUseCaseResponse>> {
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
        await this.dependencies.authorizationHook.assertCanApproveNode({
          actorUserIdentityId,
          enrollmentRequest: enrollment,
          existingNode,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to approve nodes.",
      );
    }

    let transitionTarget = enrollment;
    if (enrollment.status === NodeEnrollmentRequestStatuses.submitted) {
      const underReview = await this.dependencies.enrollmentRequestRepository.transitionEnrollmentRequestStatus({
        requestId: enrollment.requestId,
        toStatus: NodeEnrollmentRequestStatuses.underReview,
        mutation: createNodeTrustMutationEnvelope({
          actorUserIdentityId,
          operationPrefix: "approve-node-enrollment-under-review",
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
        NodeEnrollmentRequestStatuses.approved,
        {
          reviewedAt: request.reviewedAt ?? this.clock.now().toISOString(),
          reviewedByUserIdentityId: actorUserIdentityId,
          decisionNote: request.decisionNote,
        },
      );
    } catch (error) {
      return mapNodeTrustDomainError(error, "Enrollment request cannot be approved from its current state.")
        ?? toNodeTrustFailure(
          NodeTrustUseCaseErrorCodes.invalidState,
          "Enrollment request cannot be approved from its current state.",
        );
    }

    const certificate = await this.resolveCertificate(request, transitionTarget, actorUserIdentityId);
    if (!certificate.ok) {
      return certificate;
    }

    const nowIso = this.clock.now().toISOString();
    const trustState = certificate.value ? NodeTrustStates.trusted : NodeTrustStates.pendingApproval;

    const nodeMutation = existingNode
      ? await this.updateExistingNode(existingNode, {
        actorUserIdentityId,
        approvedAt: request.reviewedAt ?? nowIso,
        trustState,
        certificate: certificate.value,
        request,
      })
      : await this.registerNodeFromEnrollment(transitionTarget, {
        actorUserIdentityId,
        approvedAt: request.reviewedAt ?? nowIso,
        trustState,
        certificate: certificate.value,
        request,
      });

    const enrollmentMutation = await this.dependencies.enrollmentRequestRepository.transitionEnrollmentRequestStatus({
      requestId,
      toStatus: NodeEnrollmentRequestStatuses.approved,
      reviewedAt: request.reviewedAt ?? nowIso,
      reviewedByUserIdentityId: actorUserIdentityId,
      decisionNote: normalizeOptional(request.decisionNote),
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId,
        operationPrefix: "approve-node-enrollment",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedEnrollmentRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.nodeApproved,
      actorUserIdentityId,
      occurredAt: nowIso,
      nodeId: enrollment.nodeId,
      enrollmentRequestId: requestId,
      details: Object.freeze({
        trustState: nodeMutation.record.trustState,
        approvalStatus: nodeMutation.record.approvalStatus,
        reviewedAt: enrollmentMutation.record.reviewedAt,
        reviewedByUserIdentityId: enrollmentMutation.record.reviewedByUserIdentityId,
        decisionNote: enrollmentMutation.record.decisionNote,
        certificateRef: nodeMutation.record.certificate?.certificateRef,
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

  private async resolveCertificate(
    request: ApproveNodeEnrollmentUseCaseRequest,
    enrollment: NodeEnrollmentRequestPersistenceRecord,
    actorUserIdentityId: string,
  ): Promise<NodeTrustUseCaseOutcome<NodeIdentityPersistenceRecord["certificate"]>> {
    if (request.certificateRef) {
      return {
        ok: true,
        value: Object.freeze({
          certificateRef: request.certificateRef,
          certificateAssignedAt: this.clock.now().toISOString(),
          certificateAuthorityRef: normalizeOptional(request.certificateAuthorityRef),
          certificateThumbprint: normalizeOptional(request.certificateThumbprint),
          certificateExpiresAt: normalizeOptional(request.certificateExpiresAt),
        }),
      };
    }

    if (enrollment.certificateRef) {
      return {
        ok: true,
        value: Object.freeze({
          certificateRef: enrollment.certificateRef,
          certificateAssignedAt: this.clock.now().toISOString(),
          certificateAuthorityRef: normalizeOptional(request.certificateAuthorityRef),
          certificateThumbprint: normalizeOptional(request.certificateThumbprint),
          certificateExpiresAt: normalizeOptional(request.certificateExpiresAt),
        }),
      };
    }

    if (!this.dependencies.certificateHook) {
      return {
        ok: true,
        value: undefined,
      };
    }

    try {
      const certificate = await this.dependencies.certificateHook.issueNodeCertificate({
        actorUserIdentityId,
        nodeId: enrollment.nodeId,
        nodeType: enrollment.nodeType,
        displayName: enrollment.displayName,
        capabilityProfile: enrollment.capabilityProfile,
        enrollmentRequestId: enrollment.requestId,
        requestedAt: enrollment.requestedAt,
      });
      return { ok: true, value: certificate };
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidState,
        error instanceof Error ? error.message : "Node certificate issuance failed.",
      );
    }
  }

  private async updateExistingNode(
    existingNode: NodeIdentityPersistenceRecord,
    input: {
      readonly actorUserIdentityId: string;
      readonly approvedAt: string;
      readonly trustState: typeof NodeTrustStates[keyof typeof NodeTrustStates];
      readonly certificate?: NodeIdentityPersistenceRecord["certificate"];
      readonly request: ApproveNodeEnrollmentUseCaseRequest;
    },
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const approvalMutation = await this.dependencies.nodeRepository.updateNodeApproval({
      nodeId: existingNode.nodeId,
      approvalStatus: NodeApprovalStatuses.approved,
      approvedAt: input.approvedAt,
      approvedByUserIdentityId: input.actorUserIdentityId,
      trustState: input.trustState,
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId: input.actorUserIdentityId,
        operationPrefix: "approve-node",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: input.request.expectedNodeRevision,
        reason: input.request.reason,
        correlationId: input.request.correlationId,
        metadata: input.request.metadata,
      }),
    });

    if (!input.certificate) {
      return approvalMutation;
    }

    return this.dependencies.nodeRepository.updateNodeCertificateReference({
      nodeId: existingNode.nodeId,
      certificate: input.certificate,
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId: input.actorUserIdentityId,
        operationPrefix: "assign-node-certificate",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: approvalMutation.record.revision,
        reason: input.request.reason,
        correlationId: input.request.correlationId,
        metadata: input.request.metadata,
      }),
    });
  }

  private async registerNodeFromEnrollment(
    enrollment: NodeEnrollmentRequestPersistenceRecord,
    input: {
      readonly actorUserIdentityId: string;
      readonly approvedAt: string;
      readonly trustState: typeof NodeTrustStates[keyof typeof NodeTrustStates];
      readonly certificate?: NodeIdentityPersistenceRecord["certificate"];
      readonly request: ApproveNodeEnrollmentUseCaseRequest;
    },
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    const nowIso = this.clock.now().toISOString();
    return this.dependencies.nodeRepository.registerNode({
      record: {
        nodeId: enrollment.nodeId,
        nodeType: enrollment.nodeType,
        displayName: enrollment.displayName,
        capabilityProfile: enrollment.capabilityProfile,
        approvalStatus: NodeApprovalStatuses.approved,
        trustState: input.trustState,
        certificate: input.certificate,
        deploymentTags: enrollment.deploymentTags,
        revocation: {
          state: NodeRevocationStates.active,
        },
        enrolledAt: enrollment.requestedAt,
        approvedAt: input.approvedAt,
        enrollmentRequestId: enrollment.requestId,
        createdAt: nowIso,
        createdBy: input.actorUserIdentityId,
        lastModifiedAt: nowIso,
        lastModifiedBy: input.actorUserIdentityId,
        revision: 0,
      },
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId: input.actorUserIdentityId,
        operationPrefix: "register-approved-node",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: input.request.expectedNodeRevision,
        reason: input.request.reason,
        correlationId: input.request.correlationId,
        metadata: input.request.metadata,
      }),
    });
  }
}
