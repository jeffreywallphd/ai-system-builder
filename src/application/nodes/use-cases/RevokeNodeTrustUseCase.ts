import {
  createNodeIdentity,
  revokeNodeIdentity,
  type NodeRevocationReason,
} from "../../../domain/nodes/NodeTrustDomain";
import type {
  NodeIdentityPersistenceRecord,
  NodeTrustPersistenceMutationResult,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import { NodeRevocationStates, NodeTrustStates } from "../../../domain/nodes/NodeTrustDomain";
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

export interface RevokeNodeTrustUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly reason: NodeRevocationReason;
  readonly note?: string;
  readonly revokedAt?: string;
  readonly expectedRevision?: number;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RevokeNodeTrustUseCaseResponse {
  readonly node: NodeIdentityPersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>;
}

interface RevokeNodeTrustUseCaseDependencies {
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly certificateHook?: NodeTrustCertificateHook;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class RevokeNodeTrustUseCase {
  private readonly idGenerator: NodeTrustUseCaseIdGenerator;

  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: RevokeNodeTrustUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultNodeTrustUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: RevokeNodeTrustUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<RevokeNodeTrustUseCaseResponse>> {
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

    const revokedAt = normalizeOptional(request.revokedAt) ?? this.clock.now().toISOString();

    const revocation = Object.freeze({
      state: NodeRevocationStates.revoked,
      reason: request.reason,
      revokedAt,
      revokedByUserIdentityId: actorUserIdentityId,
      note: normalizeOptional(request.note),
    });

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanRevokeNode({
          actorUserIdentityId,
          node,
          revocation,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to revoke nodes.",
      );
    }

    try {
      revokeNodeIdentity(
        createNodeIdentity({
          nodeId: node.nodeId,
          nodeType: node.nodeType,
          displayName: node.displayName,
          capabilityProfile: node.capabilityProfile,
          approvalStatus: node.approvalStatus,
          trustState: node.trustState,
          certificateRef: node.certificate?.certificateRef,
          deploymentTags: node.deploymentTags,
          lastSeen: node.lastSeen,
          revocation: node.revocation,
          enrolledAt: node.enrolledAt,
          approvedAt: node.approvedAt,
          createdAt: node.createdAt,
          updatedAt: node.lastModifiedAt,
        }),
        {
          reason: request.reason,
          revokedAt,
          revokedByUserIdentityId: actorUserIdentityId,
          note: request.note,
        },
      );
    } catch (error) {
      return mapNodeTrustDomainError(error, "Node revocation request is invalid.")
        ?? toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidState, "Node revocation request is invalid.");
    }

    if (this.dependencies.certificateHook?.revokeNodeCertificate && node.certificate?.certificateRef) {
      try {
        await this.dependencies.certificateHook.revokeNodeCertificate({
          actorUserIdentityId,
          nodeId: node.nodeId,
          certificateRef: node.certificate.certificateRef,
          revokedAt,
          reason: request.reason,
        });
      } catch (error) {
        return toNodeTrustFailure(
          NodeTrustUseCaseErrorCodes.invalidState,
          error instanceof Error ? error.message : "Node certificate revocation failed.",
        );
      }
    }

    const mutation = await this.dependencies.nodeRepository.revokeNode({
      nodeId,
      trustState: NodeTrustStates.revoked,
      revocation,
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId,
        operationPrefix: "revoke-node",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.nodeRevoked,
      actorUserIdentityId,
      occurredAt: revokedAt,
      nodeId,
      details: Object.freeze({
        reason: request.reason,
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
}
