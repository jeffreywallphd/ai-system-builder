import {
  NodeApprovalStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationStates,
  NodeTrustStates,
  type NodeApprovalStatus,
  type NodeEnrollmentRequestStatus,
  type NodeHeartbeatStatus,
  type NodeRevocationReason,
  type NodeRevocationState,
  type NodeTrustState,
} from "@domain/nodes/NodeTrustDomain";
import type {
  NodeEnrollmentRequestPersistenceRecord,
  NodeIdentityPersistenceRecord,
} from "@shared/dto/nodes/NodeTrustPersistenceDtos";

export const NodeInventoryOperationalStates = Object.freeze({
  active: "active",
  pending: "pending",
  rejected: "rejected",
  revoked: "revoked",
  offline: "offline",
});

export type NodeInventoryOperationalState =
  typeof NodeInventoryOperationalStates[keyof typeof NodeInventoryOperationalStates];

export const NodeInventoryPresenceStates = Object.freeze({
  online: "online",
  degraded: "degraded",
  offline: "offline",
  unknown: "unknown",
});

export type NodeInventoryPresenceState =
  typeof NodeInventoryPresenceStates[keyof typeof NodeInventoryPresenceStates];

export interface NodeInventorySummaryReadModel {
  readonly nodeId: string;
  readonly nodeType: NodeIdentityPersistenceRecord["nodeType"] | NodeEnrollmentRequestPersistenceRecord["nodeType"];
  readonly displayName: string;
  readonly approvalStatus: NodeApprovalStatus;
  readonly trustState: NodeTrustState;
  readonly enrollmentStatus?: NodeEnrollmentRequestStatus;
  readonly operationalState: NodeInventoryOperationalState;
  readonly presenceState: NodeInventoryPresenceState;
  readonly capabilityProfile: NodeIdentityPersistenceRecord["capabilityProfile"];
  readonly deploymentTags: ReadonlyArray<string>;
  readonly lastSeen?: NodeIdentityPersistenceRecord["lastSeen"];
  readonly certificateRef?: string;
  readonly revocationState: NodeRevocationState;
  readonly revocationReason?: NodeRevocationReason;
  readonly revocationNote?: string;
  readonly enrolledAt?: string;
  readonly requestedAt?: string;
  readonly approvedAt?: string;
  readonly revokedAt?: string;
  readonly pendingEnrollmentRequestId?: string;
}

export interface NodeInventoryPendingEnrollmentReadModel {
  readonly requestId: string;
  readonly status: NodeEnrollmentRequestStatus;
  readonly requestedAt: string;
  readonly reviewedAt?: string;
  readonly decisionNote?: string;
  readonly certificateRef?: string;
}

export interface NodeInventoryDetailReadModel extends NodeInventorySummaryReadModel {
  readonly pendingEnrollment?: NodeInventoryPendingEnrollmentReadModel;
}

function derivePresenceState(lastSeen: NodeIdentityPersistenceRecord["lastSeen"]): NodeInventoryPresenceState {
  if (!lastSeen) {
    return NodeInventoryPresenceStates.unknown;
  }

  if (lastSeen.heartbeatStatus === NodeHeartbeatStatuses.online) {
    return NodeInventoryPresenceStates.online;
  }
  if (lastSeen.heartbeatStatus === NodeHeartbeatStatuses.degraded) {
    return NodeInventoryPresenceStates.degraded;
  }
  return NodeInventoryPresenceStates.offline;
}

function deriveOperationalState(
  input: {
    readonly approvalStatus: NodeApprovalStatus;
    readonly trustState: NodeTrustState;
    readonly revocationState: NodeRevocationState;
    readonly heartbeatStatus?: NodeHeartbeatStatus;
  },
): NodeInventoryOperationalState {
  if (input.trustState === NodeTrustStates.revoked || input.revocationState === NodeRevocationStates.revoked) {
    return NodeInventoryOperationalStates.revoked;
  }
  if (input.approvalStatus === NodeApprovalStatuses.rejected || input.trustState === NodeTrustStates.quarantined) {
    return NodeInventoryOperationalStates.rejected;
  }
  if (input.heartbeatStatus === NodeHeartbeatStatuses.offline) {
    return NodeInventoryOperationalStates.offline;
  }
  if (input.approvalStatus === NodeApprovalStatuses.approved && input.trustState === NodeTrustStates.trusted) {
    return NodeInventoryOperationalStates.active;
  }
  return NodeInventoryOperationalStates.pending;
}

export function toNodeInventorySummaryReadModel(
  node: NodeIdentityPersistenceRecord,
  pendingEnrollment?: NodeEnrollmentRequestPersistenceRecord,
): NodeInventorySummaryReadModel {
  const presenceState = derivePresenceState(node.lastSeen);

  return Object.freeze({
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    displayName: node.displayName,
    approvalStatus: node.approvalStatus,
    trustState: node.trustState,
    enrollmentStatus: pendingEnrollment?.status,
    operationalState: deriveOperationalState({
      approvalStatus: node.approvalStatus,
      trustState: node.trustState,
      revocationState: node.revocation.state,
      heartbeatStatus: node.lastSeen?.heartbeatStatus,
    }),
    presenceState,
    capabilityProfile: node.capabilityProfile,
    deploymentTags: node.deploymentTags,
    lastSeen: node.lastSeen,
    certificateRef: node.certificate?.certificateRef,
    revocationState: node.revocation.state,
    revocationReason: node.revocation.reason,
    revocationNote: node.revocation.note,
    enrolledAt: node.enrolledAt,
    requestedAt: pendingEnrollment?.requestedAt,
    approvedAt: node.approvedAt,
    revokedAt: node.revokedAt,
    pendingEnrollmentRequestId: pendingEnrollment?.requestId,
  });
}

export function toPendingEnrollmentInventorySummaryReadModel(
  enrollment: NodeEnrollmentRequestPersistenceRecord,
): NodeInventorySummaryReadModel {
  return Object.freeze({
    nodeId: enrollment.nodeId,
    nodeType: enrollment.nodeType,
    displayName: enrollment.displayName,
    approvalStatus: NodeApprovalStatuses.pending,
    trustState: NodeTrustStates.pendingEnrollment,
    enrollmentStatus: enrollment.status,
    operationalState: NodeInventoryOperationalStates.pending,
    presenceState: NodeInventoryPresenceStates.unknown,
    capabilityProfile: enrollment.capabilityProfile,
    deploymentTags: enrollment.deploymentTags,
    certificateRef: enrollment.certificateRef,
    revocationState: NodeRevocationStates.active,
    requestedAt: enrollment.requestedAt,
    pendingEnrollmentRequestId: enrollment.requestId,
  });
}

export function toNodeInventoryDetailReadModel(
  summary: NodeInventorySummaryReadModel,
  pendingEnrollment?: NodeEnrollmentRequestPersistenceRecord,
): NodeInventoryDetailReadModel {
  const pending = pendingEnrollment
    ? Object.freeze({
      requestId: pendingEnrollment.requestId,
      status: pendingEnrollment.status,
      requestedAt: pendingEnrollment.requestedAt,
      reviewedAt: pendingEnrollment.reviewedAt,
      decisionNote: pendingEnrollment.decisionNote,
      certificateRef: pendingEnrollment.certificateRef,
    })
    : undefined;

  return Object.freeze({
    ...summary,
    pendingEnrollment: pending,
  });
}

