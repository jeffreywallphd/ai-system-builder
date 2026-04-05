import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeTrustStates,
  assignNodeCertificate,
  createNodeIdentity,
  transitionNodeTrustState,
} from "../../../domain/nodes/NodeTrustDomain";
import type {
  NodeCertificateReferencePersistenceRecord,
  NodeIdentityPersistenceRecord,
  NodeTrustPersistenceMutationResult,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
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

export interface ActivateApprovedNodeUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly certificateRef?: string;
  readonly certificateAuthorityRef?: string;
  readonly certificateThumbprint?: string;
  readonly certificateExpiresAt?: string;
  readonly activatedAt?: string;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ActivateApprovedNodeUseCaseResponse {
  readonly node: NodeIdentityPersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>;
}

interface ActivateApprovedNodeUseCaseDependencies {
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

function areCertificatesEqual(
  left: NodeCertificateReferencePersistenceRecord | undefined,
  right: NodeCertificateReferencePersistenceRecord | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return left.certificateRef === right.certificateRef
    && left.certificateAssignedAt === right.certificateAssignedAt
    && left.certificateAuthorityRef === right.certificateAuthorityRef
    && left.certificateThumbprint === right.certificateThumbprint
    && left.certificateExpiresAt === right.certificateExpiresAt;
}

export class ActivateApprovedNodeUseCase {
  private readonly idGenerator: NodeTrustUseCaseIdGenerator;

  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: ActivateApprovedNodeUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultNodeTrustUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: ActivateApprovedNodeUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<ActivateApprovedNodeUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const nodeId = normalizeRequired(request.nodeId);
    if (!nodeId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "nodeId is required.");
    }

    const node = await this.dependencies.nodeRepository.findNodeById(nodeId);
    if (!node) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.notFound, `Node '${nodeId}' was not found.`);
    }

    try {
      if (this.dependencies.authorizationHook?.assertCanActivateNode) {
        await this.dependencies.authorizationHook.assertCanActivateNode({
          actorUserIdentityId,
          node,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to activate approved nodes.",
      );
    }

    if (node.approvalStatus !== NodeApprovalStatuses.approved) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidState,
        `Node '${node.nodeId}' cannot be activated before approval.`,
      );
    }

    if (node.trustState === NodeTrustStates.revoked || node.revocation.state === NodeRevocationStates.revoked) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidState,
        `Node '${node.nodeId}' is revoked and cannot be activated.`,
      );
    }

    const activatedAt = normalizeOptional(request.activatedAt) ?? this.clock.now().toISOString();
    const requestedCertificateRef = normalizeOptional(request.certificateRef);
    const certificate = this.resolveTargetCertificate(node, requestedCertificateRef, activatedAt, request);

    if (!certificate?.certificateRef) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidState,
        `Node '${node.nodeId}' requires a certificate reference before activation.`,
      );
    }

    if (
      node.trustState === NodeTrustStates.trusted
      && requestedCertificateRef
      && node.certificate?.certificateRef !== requestedCertificateRef
    ) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.conflict,
        `Node '${node.nodeId}' is already activated with certificate '${node.certificate?.certificateRef}'.`,
      );
    }

    try {
      const validated = createNodeIdentity({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        displayName: node.displayName,
        capabilityProfile: node.capabilityProfile,
        approvalStatus: node.approvalStatus,
        trustState: node.trustState,
        certificateRef: certificate.certificateRef,
        deploymentTags: node.deploymentTags,
        lastSeen: node.lastSeen,
        revocation: node.revocation,
        enrolledAt: node.enrolledAt,
        approvedAt: node.approvedAt,
        createdAt: node.createdAt,
        updatedAt: node.lastModifiedAt,
      });
      const withCertificate = assignNodeCertificate(validated, certificate.certificateRef, new Date(activatedAt));
      transitionNodeTrustState(withCertificate, NodeTrustStates.trusted, new Date(activatedAt));
    } catch (error) {
      return mapNodeTrustDomainError(error, "Approved node activation payload is invalid.")
        ?? toNodeTrustFailure(
          NodeTrustUseCaseErrorCodes.invalidRequest,
          "Approved node activation payload is invalid.",
        );
    }

    if (node.trustState === NodeTrustStates.trusted && areCertificatesEqual(node.certificate, certificate)) {
      return {
        ok: true,
        value: Object.freeze({
          node,
          mutation: Object.freeze({
            record: node,
            changed: false,
            wasReplay: false,
          }),
        }),
      };
    }

    let currentNode = node;
    let nextExpectedRevision = request.expectedRevision;

    if (!areCertificatesEqual(node.certificate, certificate)) {
      const certificateMutation = await this.dependencies.nodeRepository.updateNodeCertificateReference({
        nodeId: node.nodeId,
        certificate,
        mutation: createNodeTrustMutationEnvelope({
          actorUserIdentityId,
          operationPrefix: "activate-approved-node-certificate",
          idGenerator: this.idGenerator,
          clock: this.clock,
          expectedRevision: request.expectedRevision,
          reason: request.reason,
          correlationId: request.correlationId,
          metadata: request.metadata,
        }),
      });
      currentNode = certificateMutation.record;
      nextExpectedRevision = certificateMutation.record.revision;
    }

    const mutation = await this.dependencies.nodeRepository.updateNodeApproval({
      nodeId: currentNode.nodeId,
      approvalStatus: NodeApprovalStatuses.approved,
      approvedAt: currentNode.approvedAt ?? activatedAt,
      approvedByUserIdentityId: actorUserIdentityId,
      trustState: NodeTrustStates.trusted,
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId,
        operationPrefix: "activate-approved-node",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: nextExpectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.nodeActivated,
      actorUserIdentityId,
      occurredAt: activatedAt,
      nodeId: currentNode.nodeId,
      details: Object.freeze({
        approvalStatus: mutation.record.approvalStatus,
        trustState: mutation.record.trustState,
        capabilityCount: mutation.record.capabilityProfile.enabledCapabilities.length,
        certificateRef: mutation.record.certificate?.certificateRef,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        node: mutation.record,
        mutation,
      }),
    };
  }

  private resolveTargetCertificate(
    node: NodeIdentityPersistenceRecord,
    requestedCertificateRef: string | undefined,
    activatedAt: string,
    request: ActivateApprovedNodeUseCaseRequest,
  ): NodeCertificateReferencePersistenceRecord | undefined {
    if (!requestedCertificateRef && !node.certificate) {
      return undefined;
    }

    if (!requestedCertificateRef) {
      return Object.freeze({
        ...(node.certificate as NodeCertificateReferencePersistenceRecord),
        certificateAuthorityRef: normalizeOptional(request.certificateAuthorityRef) ?? node.certificate?.certificateAuthorityRef,
        certificateThumbprint: normalizeOptional(request.certificateThumbprint) ?? node.certificate?.certificateThumbprint,
        certificateExpiresAt: normalizeOptional(request.certificateExpiresAt) ?? node.certificate?.certificateExpiresAt,
      });
    }

    return Object.freeze({
      certificateRef: requestedCertificateRef,
      certificateAssignedAt: activatedAt,
      certificateAuthorityRef: normalizeOptional(request.certificateAuthorityRef),
      certificateThumbprint: normalizeOptional(request.certificateThumbprint),
      certificateExpiresAt: normalizeOptional(request.certificateExpiresAt),
    });
  }
}
