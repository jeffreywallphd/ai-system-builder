import {
  createNodeIdentity,
  recordNodeLastSeen,
  type NodeHeartbeatStatus,
} from "../../../domain/nodes/NodeTrustDomain";
import type {
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
  type NodeTrustUseCaseClock,
  type NodeTrustUseCaseIdGenerator,
  type NodeTrustUseCaseOutcome,
  createNodeTrustMutationEnvelope,
  enforceNodeAuthenticatedOperationTrust,
  mapNodeTrustDomainError,
  normalizeOptional,
  normalizeRequired,
  NodeTrustUseCaseErrorCodes,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";

export interface RecordNodeHeartbeatUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly heartbeatStatus: NodeHeartbeatStatus;
  readonly seenAt?: string;
  readonly observedBy?: string;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RecordNodeHeartbeatUseCaseResponse {
  readonly node: NodeIdentityPersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>;
}

interface RecordNodeHeartbeatUseCaseDependencies {
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class RecordNodeHeartbeatUseCase {
  private readonly idGenerator: NodeTrustUseCaseIdGenerator;

  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: RecordNodeHeartbeatUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultNodeTrustUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: RecordNodeHeartbeatUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<RecordNodeHeartbeatUseCaseResponse>> {
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
      await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
        type: NodeTrustAuditEventTypes.heartbeatRejected,
        actorUserIdentityId,
        occurredAt: this.clock.now().toISOString(),
        nodeId,
        outcome: "rejected",
        details: Object.freeze({
          reasonCode: NodeTrustUseCaseErrorCodes.notFound,
          reason: "Node identity was not found for heartbeat recording.",
        }),
      });
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.notFound, `Node '${nodeId}' was not found.`);
    }
    const trustFailure = enforceNodeAuthenticatedOperationTrust(node, "report heartbeat presence");
    if (trustFailure) {
      await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
        type: NodeTrustAuditEventTypes.heartbeatRejected,
        actorUserIdentityId,
        occurredAt: this.clock.now().toISOString(),
        nodeId,
        outcome: "rejected",
        details: Object.freeze({
          reasonCode: trustFailure.error.code,
          reason: trustFailure.error.message,
          approvalStatus: node.approvalStatus,
          trustState: node.trustState,
          revocationState: node.revocation.state,
          deploymentTags: node.deploymentTags,
        }),
      });
      return trustFailure;
    }

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanRecordHeartbeat({
          actorUserIdentityId,
          node,
        });
      }
    } catch (error) {
      await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
        type: NodeTrustAuditEventTypes.heartbeatRejected,
        actorUserIdentityId,
        occurredAt: this.clock.now().toISOString(),
        nodeId,
        outcome: "rejected",
        details: Object.freeze({
          reasonCode: NodeTrustUseCaseErrorCodes.forbidden,
          reason: error instanceof Error ? error.message : "Heartbeat authorization failed.",
          approvalStatus: node.approvalStatus,
          trustState: node.trustState,
          revocationState: node.revocation.state,
        }),
      });
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to record node heartbeat.",
      );
    }

    const seenAt = normalizeOptional(request.seenAt) ?? this.clock.now().toISOString();

    try {
      recordNodeLastSeen(
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
          seenAt,
          heartbeatStatus: request.heartbeatStatus,
          observedBy: request.observedBy,
        },
      );
    } catch (error) {
      await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
        type: NodeTrustAuditEventTypes.heartbeatRejected,
        actorUserIdentityId,
        occurredAt: seenAt,
        nodeId,
        outcome: "rejected",
        details: Object.freeze({
          reasonCode: NodeTrustUseCaseErrorCodes.invalidRequest,
          reason: error instanceof Error ? error.message : "Heartbeat payload validation failed.",
          approvalStatus: node.approvalStatus,
          trustState: node.trustState,
          revocationState: node.revocation.state,
        }),
      });
      return mapNodeTrustDomainError(error, "Node heartbeat payload is invalid.")
        ?? toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "Node heartbeat payload is invalid.");
    }

    const mutation = await this.dependencies.nodeRepository.recordNodeLastSeen({
      nodeId,
      lastSeen: {
        lastSeenAt: seenAt,
        heartbeatStatus: request.heartbeatStatus,
        observedBy: normalizeOptional(request.observedBy),
      },
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId,
        operationPrefix: "record-node-heartbeat",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.heartbeatRecorded,
      actorUserIdentityId,
      occurredAt: seenAt,
      nodeId,
      outcome: "success",
      details: Object.freeze({
        heartbeatStatus: request.heartbeatStatus,
        observedBy: normalizeOptional(request.observedBy),
        deploymentTags: mutation.record.deploymentTags,
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
