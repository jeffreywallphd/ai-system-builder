import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationStates,
  NodeTrustStates,
  createNodeCapabilityProfile,
  createNodeEnrollmentRequest,
  transitionNodeEnrollmentRequestStatus,
} from "@domain/nodes/NodeTrustDomain";
import type {
  NodeEnrollmentRequestPersistenceRecord,
  NodeIdentityPersistenceRecord,
  NodeTrustPersistenceMutationResult,
} from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import type { NodeTrustAuthorizationHook } from "../ports/NodeTrustAuthorizationPorts";
import type { NodeTrustCertificateHook } from "../ports/NodeTrustCertificatePorts";
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
  readonly transactionManager?: IPlatformTransactionManager;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly certificateHook?: NodeTrustCertificateHook;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

function areCapabilityProfilesEqual(
  left: NodeIdentityPersistenceRecord["capabilityProfile"],
  right: NodeIdentityPersistenceRecord["capabilityProfile"],
): boolean {
  if (left.supportsRemoteScheduling !== right.supportsRemoteScheduling) {
    return false;
  }
  if (left.capabilityProfileVersion !== right.capabilityProfileVersion) {
    return false;
  }
  if (left.maxConcurrentWorkloads !== right.maxConcurrentWorkloads) {
    return false;
  }
  if (left.enabledCapabilities.length !== right.enabledCapabilities.length) {
    return false;
  }
  return left.enabledCapabilities.every((capability, index) => right.enabledCapabilities[index] === capability);
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

    if (existingNode && isNodeTrustLifecycleRevoked(existingNode)) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidState,
        `Node '${existingNode.nodeId}' is revoked and cannot be re-approved from enrollment.`,
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

    let transitionTarget = enrollment;
    const certificate = await this.resolveCertificate(request, transitionTarget, actorUserIdentityId);
    if (!certificate.ok) {
      return certificate;
    }

    const nowIso = this.clock.now().toISOString();
    const trustState = NodeTrustStates.pendingApproval;
    let approvedCapabilityProfile: ReturnType<typeof createNodeCapabilityProfile>;
    try {
      approvedCapabilityProfile = createNodeCapabilityProfile(transitionTarget.capabilityProfile);
    } catch (error) {
      return mapNodeTrustDomainError(error, "Enrollment capability profile is invalid.")
        ?? toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "Enrollment capability profile is invalid.");
    }

    let nodeMutation: NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>;
    let enrollmentMutation: NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>;
    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
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

      nodeMutation = existingNode
        ? await this.updateExistingNode(existingNode, {
          actorUserIdentityId,
          approvedAt: request.reviewedAt ?? nowIso,
          trustState,
          capabilityProfile: approvedCapabilityProfile,
          certificate: certificate.value,
          request,
        })
        : await this.registerNodeFromEnrollment(transitionTarget, {
          actorUserIdentityId,
          approvedAt: request.reviewedAt ?? nowIso,
          trustState,
          capabilityProfile: approvedCapabilityProfile,
          certificate: certificate.value,
          request,
        });

      enrollmentMutation = await this.dependencies.enrollmentRequestRepository.transitionEnrollmentRequestStatus({
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
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.nodeApproved,
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
        certificateRef: nodeMutation!.record.certificate?.certificateRef,
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
      readonly capabilityProfile: NodeIdentityPersistenceRecord["capabilityProfile"];
      readonly certificate?: NodeIdentityPersistenceRecord["certificate"];
      readonly request: ApproveNodeEnrollmentUseCaseRequest;
    },
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>> {
    let currentMutation = await this.dependencies.nodeRepository.updateNodeApproval({
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

    if (!areCapabilityProfilesEqual(currentMutation.record.capabilityProfile, input.capabilityProfile)) {
      currentMutation = await this.dependencies.nodeRepository.updateNodeCapabilityProfile({
        nodeId: existingNode.nodeId,
        capabilityProfile: input.capabilityProfile,
        mutation: createNodeTrustMutationEnvelope({
          actorUserIdentityId: input.actorUserIdentityId,
          operationPrefix: "approve-node-capabilities",
          idGenerator: this.idGenerator,
          clock: this.clock,
          expectedRevision: currentMutation.record.revision,
          reason: input.request.reason,
          correlationId: input.request.correlationId,
          metadata: input.request.metadata,
        }),
      });
    }

    if (!input.certificate) {
      return currentMutation;
    }

    return this.dependencies.nodeRepository.updateNodeCertificateReference({
      nodeId: existingNode.nodeId,
      certificate: input.certificate,
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId: input.actorUserIdentityId,
        operationPrefix: "assign-node-certificate",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: currentMutation.record.revision,
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
      readonly capabilityProfile: NodeIdentityPersistenceRecord["capabilityProfile"];
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
        capabilityProfile: input.capabilityProfile,
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

