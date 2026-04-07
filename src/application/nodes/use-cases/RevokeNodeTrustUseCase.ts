import {
  createNodeIdentity,
  revokeNodeIdentity,
  type NodeRevocationReason,
} from "@domain/nodes/NodeTrustDomain";
import type {
  NodeIdentityPersistenceRecord,
  NodeTrustPersistenceMutationResult,
} from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import { NodeRevocationStates, NodeTrustStates } from "@domain/nodes/NodeTrustDomain";
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
  readonly reason?: NodeRevocationReason;
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

    const alreadyRevoked = node.trustState === NodeTrustStates.revoked || node.revocation.state === NodeRevocationStates.revoked;
    const reason = request.reason ?? node.revocation.reason;
    if (!alreadyRevoked && !reason) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidRequest,
        "reason is required when revoking an active node.",
      );
    }
    const requiredReason = reason as NodeRevocationReason;

    const revokedAt = normalizeOptional(request.revokedAt)
      ?? node.revocation.revokedAt
      ?? node.revokedAt
      ?? this.clock.now().toISOString();
    const note = normalizeOptional(request.note) ?? node.revocation.note;

    const revocation = Object.freeze({
      state: NodeRevocationStates.revoked,
      reason,
      revokedAt,
      revokedByUserIdentityId: node.revocation.revokedByUserIdentityId ?? actorUserIdentityId,
      note,
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

    if (alreadyRevoked) {
      const mutation = Object.freeze({
        record: node,
        changed: false,
        wasReplay: false,
      });

      await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
        type: NodeTrustAuditEventTypes.nodeRevoked,
        actorUserIdentityId,
        occurredAt: this.clock.now().toISOString(),
        nodeId,
        outcome: "already-applied",
        details: Object.freeze({
          nodeType: node.nodeType,
          deploymentTags: node.deploymentTags,
          reason: node.revocation.reason,
          revokedByUserIdentityId: node.revocation.revokedByUserIdentityId,
          note: node.revocation.note,
          revokedAt: node.revocation.revokedAt ?? node.revokedAt,
          alreadyRevoked: true,
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          node,
          mutation,
        }),
      };
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
          reason: requiredReason,
          revokedAt,
          revokedByUserIdentityId: actorUserIdentityId,
          note,
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
          reason: requiredReason,
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
        reason: requiredReason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.nodeRevoked,
      actorUserIdentityId,
      occurredAt: revokedAt,
      nodeId,
      outcome: "success",
      details: Object.freeze({
        nodeType: mutation.record.nodeType,
        deploymentTags: mutation.record.deploymentTags,
        reason: requiredReason,
        revokedByUserIdentityId: actorUserIdentityId,
        note,
        revokedAt,
        alreadyRevoked: false,
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

