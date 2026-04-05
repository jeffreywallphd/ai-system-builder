import {
  createNodeCapabilityProfile,
  createNodeIdentity,
  recordNodeLastSeen,
  type NodeCapabilityProfile,
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

export interface RecordNodeOperationalUpdateUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly heartbeatStatus: NodeHeartbeatStatus;
  readonly seenAt?: string;
  readonly observedBy?: string;
  readonly capabilityProfile?: NodeCapabilityProfile;
  readonly deploymentTags?: ReadonlyArray<string>;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RecordNodeOperationalUpdateUseCaseResponse {
  readonly node: NodeIdentityPersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>;
  readonly update: {
    readonly heartbeatRecorded: true;
    readonly capabilityProfileSynchronized: boolean;
    readonly deploymentTagsSynchronized: boolean;
  };
}

interface RecordNodeOperationalUpdateUseCaseDependencies {
  readonly nodeRepository: Pick<INodeTrustIdentityPersistenceRepository, "findNodeById" | "registerNode">;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
}

export class RecordNodeOperationalUpdateUseCase {
  private readonly idGenerator: NodeTrustUseCaseIdGenerator;

  private readonly clock: NodeTrustUseCaseClock;

  public constructor(private readonly dependencies: RecordNodeOperationalUpdateUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultNodeTrustUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: RecordNodeOperationalUpdateUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<RecordNodeOperationalUpdateUseCaseResponse>> {
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
          reason: "Node identity was not found for operational update.",
        }),
      });
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.notFound, `Node '${nodeId}' was not found.`);
    }

    const trustFailure = enforceNodeAuthenticatedOperationTrust(
      node,
      "publish operational heartbeat and capability updates",
    );
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
          reason: error instanceof Error ? error.message : "Node operational update authorization failed.",
          approvalStatus: node.approvalStatus,
          trustState: node.trustState,
          revocationState: node.revocation.state,
        }),
      });
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to record node operational updates.",
      );
    }

    const seenAt = normalizeOptional(request.seenAt) ?? this.clock.now().toISOString();
    let normalizedDeploymentTags: ReadonlyArray<string> = node.deploymentTags;
    let normalizedCapabilityProfile: NodeCapabilityProfile = node.capabilityProfile;

    try {
      normalizedDeploymentTags = request.deploymentTags
        ? normalizeDeploymentTags(request.deploymentTags)
        : node.deploymentTags;
      normalizedCapabilityProfile = request.capabilityProfile
        ? createNodeCapabilityProfile(request.capabilityProfile)
        : node.capabilityProfile;

      recordNodeLastSeen(
        createNodeIdentity({
          nodeId: node.nodeId,
          nodeType: node.nodeType,
          displayName: node.displayName,
          capabilityProfile: normalizedCapabilityProfile,
          approvalStatus: node.approvalStatus,
          trustState: node.trustState,
          certificateRef: node.certificate?.certificateRef,
          deploymentTags: normalizedDeploymentTags,
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
          reason: error instanceof Error ? error.message : "Node operational payload validation failed.",
          approvalStatus: node.approvalStatus,
          trustState: node.trustState,
          revocationState: node.revocation.state,
        }),
      });
      return mapNodeTrustDomainError(error, "Node operational payload is invalid.")
        ?? toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "Node operational payload is invalid.");
    }

    const mutation = await this.dependencies.nodeRepository.registerNode({
      record: {
        ...node,
        capabilityProfile: normalizedCapabilityProfile,
        deploymentTags: normalizedDeploymentTags,
        lastSeen: {
          lastSeenAt: seenAt,
          heartbeatStatus: request.heartbeatStatus,
          observedBy: normalizeOptional(request.observedBy),
        },
      },
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId,
        operationPrefix: "record-node-operational-update",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
    });

    const capabilityProfileSynchronized = !areCapabilityProfilesEqual(
      node.capabilityProfile,
      mutation.record.capabilityProfile,
    );
    const deploymentTagsSynchronized = !areStringSetsEqual(node.deploymentTags, mutation.record.deploymentTags);

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
        capabilityProfileVersion: mutation.record.capabilityProfile.capabilityProfileVersion,
        capabilityProfileSynchronized,
        deploymentTagsSynchronized,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        node: mutation.record,
        mutation,
        update: Object.freeze({
          heartbeatRecorded: true,
          capabilityProfileSynchronized,
          deploymentTagsSynchronized,
        }),
      }),
    };
  }
}

function areCapabilityProfilesEqual(left: NodeCapabilityProfile, right: NodeCapabilityProfile): boolean {
  return left.capabilityProfileVersion === right.capabilityProfileVersion
    && left.supportsRemoteScheduling === right.supportsRemoteScheduling
    && left.maxConcurrentWorkloads === right.maxConcurrentWorkloads
    && areStringSetsEqual(left.enabledCapabilities, right.enabledCapabilities);
}

function normalizeDeploymentTags(value: ReadonlyArray<string>): ReadonlyArray<string> {
  const normalized = new Set<string>();
  for (const tag of value) {
    const candidate = tag.trim().toLowerCase();
    if (candidate.length > 0) {
      normalized.add(candidate);
    }
  }

  return Object.freeze([...normalized.values()]);
}

function areStringSetsEqual(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  for (const value of left) {
    if (!rightSet.has(value)) {
      return false;
    }
  }

  return true;
}
