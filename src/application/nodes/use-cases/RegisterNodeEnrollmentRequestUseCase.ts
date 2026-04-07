import {
  NodeEnrollmentRequestStatuses,
  createNodeEnrollmentRequest,
} from "@domain/nodes/NodeTrustDomain";
import type {
  NodeRoleCapability,
  NodeType,
} from "@domain/nodes/NodeTrustDomain";
import type {
  NodeEnrollmentRequestPersistenceRecord,
  NodeCapabilityProfilePersistenceRecord,
  NodeTrustPersistenceMutationResult,
} from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import type { NodeTrustAuthorizationHook } from "../ports/NodeTrustAuthorizationPorts";
import {
  NodeTrustAuditEventTypes,
  publishNodeTrustAuditEventBestEffort,
  type NodeTrustAuditSink,
} from "../ports/NodeTrustAuditPorts";
import {
  DefaultNodeTrustUseCaseIdGenerator,
  NodeTrustUseCaseErrorCodes,
  NodeTrustUseCaseIdNamespaces,
  type NodeTrustUseCaseClock,
  type NodeTrustUseCaseIdGenerator,
  type NodeTrustUseCaseOutcome,
  createNodeTrustMutationEnvelope,
  mapNodeTrustDomainError,
  normalizeOptional,
  normalizeRequired,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";

export interface RegisterNodeEnrollmentRequestUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: {
    readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability>;
    readonly capabilityProfileVersion?: string;
    readonly supportsRemoteScheduling?: boolean;
    readonly maxConcurrentWorkloads?: number;
  };
  readonly deploymentTags?: ReadonlyArray<string>;
  readonly certificateRef?: string;
  readonly requestId?: string;
  readonly requestedAt?: string;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RegisterNodeEnrollmentRequestUseCaseResponse {
  readonly enrollmentRequest: NodeEnrollmentRequestPersistenceRecord;
  readonly mutation: NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>;
}

interface RegisterNodeEnrollmentRequestUseCaseDependencies {
  readonly enrollmentRequestRepository: INodeEnrollmentRequestPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
  readonly idGenerator?: NodeTrustUseCaseIdGenerator;
  readonly clock?: NodeTrustUseCaseClock;
  readonly auditSink?: NodeTrustAuditSink;
  readonly pendingEnrollmentStaleAfterMs?: number;
}

export class RegisterNodeEnrollmentRequestUseCase {
  private readonly idGenerator: NodeTrustUseCaseIdGenerator;

  private readonly clock: NodeTrustUseCaseClock;

  private readonly pendingEnrollmentStaleAfterMs: number;

  public constructor(private readonly dependencies: RegisterNodeEnrollmentRequestUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultNodeTrustUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
    this.pendingEnrollmentStaleAfterMs = Number.isFinite(dependencies.pendingEnrollmentStaleAfterMs)
      ? Math.max(0, dependencies.pendingEnrollmentStaleAfterMs as number)
      : 1000 * 60 * 60 * 24 * 7;
  }

  public async execute(
    request: RegisterNodeEnrollmentRequestUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<RegisterNodeEnrollmentRequestUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const nodeId = normalizeRequired(request.nodeId);
    if (!nodeId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "nodeId is required.");
    }

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanRegisterEnrollmentRequest({
          actorUserIdentityId,
          nodeId,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to register node enrollment requests.",
      );
    }

    const nowIso = this.clock.now().toISOString();
    let pending = await this.dependencies.enrollmentRequestRepository.findPendingEnrollmentRequestByNodeId(nodeId);
    if (pending && this.isStalePendingEnrollmentRequest(pending.requestedAt)) {
      const staleMutation = await this.dependencies.enrollmentRequestRepository.transitionEnrollmentRequestStatus({
        requestId: pending.requestId,
        toStatus: NodeEnrollmentRequestStatuses.expired,
        mutation: createNodeTrustMutationEnvelope({
          actorUserIdentityId,
          operationPrefix: "expire-stale-enrollment-request",
          idGenerator: this.idGenerator,
          clock: this.clock,
          reason: "stale-pending-enrollment",
          correlationId: request.correlationId,
          metadata: request.metadata,
        }),
      });

      await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
        type: NodeTrustAuditEventTypes.enrollmentExpired,
        actorUserIdentityId,
        occurredAt: nowIso,
        nodeId,
        enrollmentRequestId: staleMutation.record.requestId,
        outcome: "success",
        details: Object.freeze({
          previousStatus: pending.status,
          expiredBy: "stale-registration-retry",
          staleAfterMs: this.pendingEnrollmentStaleAfterMs,
          requestedAt: pending.requestedAt,
        }),
      });

      pending = undefined;
    }

    if (pending) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.conflict,
        `Node '${nodeId}' already has a pending enrollment request.`,
        {
          requestId: pending.requestId,
          status: pending.status,
        },
      );
    }

    const requestId = normalizeOptional(request.requestId)
      ?? this.idGenerator.nextId(NodeTrustUseCaseIdNamespaces.enrollmentRequest);
    if (!normalizeRequired(requestId)) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidState,
        "Id generator returned an empty enrollment request id.",
      );
    }
    const existingByRequestId = await this.dependencies.enrollmentRequestRepository.findEnrollmentRequestById(requestId);
    if (existingByRequestId) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.conflict,
        `Enrollment request '${requestId}' already exists.`,
        {
          requestId: existingByRequestId.requestId,
          nodeId: existingByRequestId.nodeId,
          status: existingByRequestId.status,
        },
      );
    }

    const requestedAt = normalizeOptional(request.requestedAt) ?? nowIso;

    let enrollmentRequest: ReturnType<typeof createNodeEnrollmentRequest>;
    try {
      enrollmentRequest = createNodeEnrollmentRequest({
        requestId,
        nodeId,
        nodeType: request.nodeType,
        displayName: request.displayName,
        capabilityProfile: request.capabilityProfile,
        deploymentTags: request.deploymentTags,
        certificateRef: request.certificateRef,
        requestedAt,
      });
    } catch (error) {
      return mapNodeTrustDomainError(error, "Node enrollment request is invalid.")
        ?? toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "Node enrollment request is invalid.");
    }

    const record: NodeEnrollmentRequestPersistenceRecord = Object.freeze({
      requestId: enrollmentRequest.requestId,
      nodeId: enrollmentRequest.nodeId,
      nodeType: enrollmentRequest.nodeType,
      displayName: enrollmentRequest.displayName,
      capabilityProfile: this.toCapabilityPersistenceRecord(enrollmentRequest.capabilityProfile),
      deploymentTags: enrollmentRequest.deploymentTags,
      certificateRef: enrollmentRequest.certificateRef,
      requestedAt: enrollmentRequest.requestedAt,
      status: enrollmentRequest.status,
      reviewedAt: enrollmentRequest.reviewedAt,
      reviewedByUserIdentityId: enrollmentRequest.reviewedByUserIdentityId,
      decisionNote: enrollmentRequest.decisionNote,
      createdAt: requestedAt,
      createdBy: actorUserIdentityId,
      lastModifiedAt: requestedAt,
      lastModifiedBy: actorUserIdentityId,
      revision: 0,
    });

    const mutation = await this.dependencies.enrollmentRequestRepository.saveEnrollmentRequest({
      record,
      mutation: createNodeTrustMutationEnvelope({
        actorUserIdentityId,
        operationPrefix: "register-enrollment-request",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
    });

    await publishNodeTrustAuditEventBestEffort(this.dependencies.auditSink, {
      type: NodeTrustAuditEventTypes.enrollmentRequested,
      actorUserIdentityId,
      occurredAt: this.clock.now().toISOString(),
      nodeId,
      enrollmentRequestId: mutation.record.requestId,
      outcome: "success",
      details: Object.freeze({
        nodeType: mutation.record.nodeType,
        status: mutation.record.status,
        deploymentTags: mutation.record.deploymentTags,
        capabilities: mutation.record.capabilityProfile.enabledCapabilities,
      }),
    });

    return {
      ok: true,
      value: Object.freeze({
        enrollmentRequest: mutation.record,
        mutation,
      }),
    };
  }

  private toCapabilityPersistenceRecord(
    profile: ReturnType<typeof createNodeEnrollmentRequest>["capabilityProfile"],
  ): NodeCapabilityProfilePersistenceRecord {
    return Object.freeze({
      enabledCapabilities: profile.enabledCapabilities,
      capabilityProfileVersion: profile.capabilityProfileVersion,
      supportsRemoteScheduling: profile.supportsRemoteScheduling,
      maxConcurrentWorkloads: profile.maxConcurrentWorkloads,
    });
  }

  private isStalePendingEnrollmentRequest(requestedAt: string): boolean {
    if (this.pendingEnrollmentStaleAfterMs <= 0) {
      return false;
    }
    const requestedAtEpoch = Date.parse(requestedAt);
    if (!Number.isFinite(requestedAtEpoch)) {
      return false;
    }
    const staleAfterEpoch = this.clock.now().getTime() - this.pendingEnrollmentStaleAfterMs;
    return requestedAtEpoch <= staleAfterEpoch;
  }
}

