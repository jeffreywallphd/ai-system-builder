import type {
  NodeApprovalStatus,
  NodeEnrollmentRequestStatus,
  NodeHeartbeatStatus,
  NodeRevocationReason,
  NodeRevocationState,
  NodeRoleCapability,
  NodeTrustState,
  NodeType,
} from "../../../domain/nodes/NodeTrustDomain";
import { NodeEnrollmentRequestStatuses } from "../../../domain/nodes/NodeTrustDomain";
import type { RuntimeTrustMaterialPackageViewDto } from "../../dto/security/CertificateAuthorityDtos";

export class NodeTrustApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeTrustApiContractError";
  }
}

export const NodeTrustTransportScopes = Object.freeze({
  admin: "admin",
  internal: "internal",
});

export type NodeTrustTransportScope = typeof NodeTrustTransportScopes[keyof typeof NodeTrustTransportScopes];

export interface NodeCapabilityProfileDto {
  readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability>;
  readonly capabilityProfileVersion?: string;
  readonly supportsRemoteScheduling: boolean;
  readonly maxConcurrentWorkloads?: number;
}

export interface NodeCertificateBootstrapEnvelopeDto {
  readonly bootstrapTokenId?: string;
  readonly bootstrapNonce?: string;
  readonly attestationFormat?: string;
  readonly attestationEvidence?: string;
  readonly requestedCertificateProfile?: string;
  readonly trustMaterialRef?: string;
  readonly publicKeyAlgorithm?: string;
  readonly publicKeyFingerprintSha256?: string;
  readonly publicKeyPem?: string;
}

export interface NodeCertificateAssignmentDto {
  readonly certificateRef: string;
  readonly certificateAssignedAt?: string;
  readonly certificateExpiresAt?: string;
}

export interface NodeInternalCertificateAssignmentDto extends NodeCertificateAssignmentDto {
  readonly certificateAuthorityRef?: string;
  readonly certificateThumbprint?: string;
}

export interface NodeLastSeenDto {
  readonly lastSeenAt: string;
  readonly heartbeatStatus: NodeHeartbeatStatus;
  readonly observedBy?: string;
}

export interface NodeRevocationDto {
  readonly state: NodeRevocationState;
  readonly reason?: NodeRevocationReason;
  readonly revokedAt?: string;
  readonly note?: string;
}

export interface NodeInternalRevocationDto extends NodeRevocationDto {
  readonly revokedByUserIdentityId?: string;
}

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

export interface NodeEnrollmentSubmissionRequestDto {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfileDto;
  readonly deploymentTags?: ReadonlyArray<string>;
  readonly certificateRef?: string;
  readonly bootstrap?: NodeCertificateBootstrapEnvelopeDto;
  readonly requestedAt?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NodePendingEnrollmentSummaryDto {
  readonly requestId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly requestedAt: string;
  readonly status: typeof NodeEnrollmentRequestStatuses.submitted | typeof NodeEnrollmentRequestStatuses.underReview;
  readonly capabilityProfile: NodeCapabilityProfileDto;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly hasBootstrapMaterial: boolean;
}

export interface ApproveNodeEnrollmentActionRequestDto {
  readonly actorUserIdentityId: string;
  readonly requestId: string;
  readonly reviewedAt?: string;
  readonly decisionNote?: string;
  readonly certificate?: NodeInternalCertificateAssignmentDto;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RejectNodeEnrollmentActionRequestDto {
  readonly actorUserIdentityId: string;
  readonly requestId: string;
  readonly reviewedAt?: string;
  readonly decisionNote?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RevokeNodeTrustActionRequestDto {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly reason: NodeRevocationReason;
  readonly revokedAt?: string;
  readonly note?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NodeHeartbeatPayloadDto {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly heartbeatStatus: NodeHeartbeatStatus;
  readonly seenAt?: string;
  readonly observedBy?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NodeOperationalUpdatePayloadDto extends NodeHeartbeatPayloadDto {
  readonly capabilityProfile?: NodeCapabilityProfileDto;
  readonly deploymentTags?: ReadonlyArray<string>;
}

export interface ResolveNodeRuntimeTrustMaterialRequestDto {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly workspaceId?: string;
  readonly certificateAuthorityId?: string;
  readonly serialNumber?: string;
  readonly includeLeafCertificate?: boolean;
  readonly includeCertificateChain?: boolean;
  readonly includeTrustBundle?: boolean;
  readonly occurredAt?: string;
}

export interface NodeEnrollmentDetailDto {
  readonly requestId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly status: NodeEnrollmentRequestStatus;
  readonly requestedAt: string;
  readonly reviewedAt?: string;
  readonly decisionNote?: string;
  readonly capabilityProfile: NodeCapabilityProfileDto;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly certificateRef?: string;
}

export interface NodeInternalEnrollmentDetailDto extends NodeEnrollmentDetailDto {
  readonly reviewedByUserIdentityId?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
  readonly revision: number;
}

export interface NodeDetailDto {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly approvalStatus: NodeApprovalStatus;
  readonly trustState: NodeTrustState;
  readonly capabilityProfile: NodeCapabilityProfileDto;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly certificate?: NodeCertificateAssignmentDto;
  readonly lastSeen?: NodeLastSeenDto;
  readonly revocation: NodeRevocationDto;
  readonly enrolledAt: string;
  readonly approvedAt?: string;
  readonly revokedAt?: string;
}

export interface NodeInternalDetailDto extends NodeDetailDto {
  readonly certificate?: NodeInternalCertificateAssignmentDto;
  readonly revocation: NodeInternalRevocationDto;
  readonly enrollmentRequestId?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
  readonly revision: number;
}

export interface NodeInventorySummaryDto {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly approvalStatus: NodeApprovalStatus;
  readonly trustState: NodeTrustState;
  readonly enrollmentStatus?: NodeEnrollmentRequestStatus;
  readonly operationalState: NodeInventoryOperationalState;
  readonly presenceState: NodeInventoryPresenceState;
  readonly capabilityProfile: NodeCapabilityProfileDto;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly lastSeen?: NodeLastSeenDto;
  readonly certificateRef?: string;
  readonly revocation: NodeRevocationDto;
  readonly enrolledAt?: string;
  readonly requestedAt?: string;
  readonly approvedAt?: string;
  readonly revokedAt?: string;
  readonly pendingEnrollmentRequestId?: string;
}

export interface NodeInternalInventorySummaryDto extends NodeInventorySummaryDto {
  readonly revocation: NodeInternalRevocationDto;
}

export interface NodeInventoryPendingEnrollmentDto {
  readonly requestId: string;
  readonly status: NodeEnrollmentRequestStatus;
  readonly requestedAt: string;
  readonly reviewedAt?: string;
  readonly decisionNote?: string;
  readonly certificateRef?: string;
}

export interface NodeInventoryDetailDto extends NodeInventorySummaryDto {
  readonly pendingEnrollment?: NodeInventoryPendingEnrollmentDto;
}

export interface NodeInternalInventoryDetailDto extends NodeInternalInventorySummaryDto {
  readonly pendingEnrollment?: NodeInventoryPendingEnrollmentDto;
}

export interface NodeEnrollmentSubmissionResponseDto {
  readonly enrollment: NodeEnrollmentDetailDto;
}

export interface PendingEnrollmentListResponseDto {
  readonly enrollments: ReadonlyArray<NodePendingEnrollmentSummaryDto>;
}

export interface NodeEnrollmentDecisionResponseDto {
  readonly enrollment: NodeEnrollmentDetailDto;
  readonly node: NodeDetailDto;
}

export interface NodeRevocationResponseDto {
  readonly node: NodeDetailDto;
}

export interface NodeHeartbeatResponseDto {
  readonly node: NodeDetailDto;
}

export interface NodeOperationalUpdateResponseDto {
  readonly node: NodeDetailDto;
  readonly update: {
    readonly heartbeatRecorded: true;
    readonly capabilityProfileSynchronized: boolean;
    readonly deploymentTagsSynchronized: boolean;
    readonly transportAuthenticatedNodeId: string;
  };
}

export interface NodeRuntimeTrustMaterialResponseDto {
  readonly runtimeTrustMaterial: RuntimeTrustMaterialPackageViewDto;
}

export interface NodeInventoryListResponseDto {
  readonly nodes: ReadonlyArray<NodeInventorySummaryDto>;
}

export interface NodeInventoryDetailResponseDto {
  readonly node: NodeInventoryDetailDto;
}

export function toNodeDetailDto(value: NodeInternalDetailDto): NodeDetailDto {
  return Object.freeze({
    nodeId: value.nodeId,
    nodeType: value.nodeType,
    displayName: value.displayName,
    approvalStatus: value.approvalStatus,
    trustState: value.trustState,
    capabilityProfile: value.capabilityProfile,
    deploymentTags: value.deploymentTags,
    certificate: value.certificate
      ? Object.freeze({
        certificateRef: value.certificate.certificateRef,
        certificateAssignedAt: value.certificate.certificateAssignedAt,
        certificateExpiresAt: value.certificate.certificateExpiresAt,
      })
      : undefined,
    lastSeen: value.lastSeen,
    revocation: Object.freeze({
      state: value.revocation.state,
      reason: value.revocation.reason,
      revokedAt: value.revocation.revokedAt,
      note: value.revocation.note,
    }),
    enrolledAt: value.enrolledAt,
    approvedAt: value.approvedAt,
    revokedAt: value.revokedAt,
  });
}

export function toNodeEnrollmentDetailDto(value: NodeInternalEnrollmentDetailDto): NodeEnrollmentDetailDto {
  return Object.freeze({
    requestId: value.requestId,
    nodeId: value.nodeId,
    nodeType: value.nodeType,
    displayName: value.displayName,
    status: value.status,
    requestedAt: value.requestedAt,
    reviewedAt: value.reviewedAt,
    decisionNote: value.decisionNote,
    capabilityProfile: value.capabilityProfile,
    deploymentTags: value.deploymentTags,
    certificateRef: value.certificateRef,
  });
}

export function toNodePendingEnrollmentSummaryDto(
  value: NodeInternalEnrollmentDetailDto,
): NodePendingEnrollmentSummaryDto {
  if (
    value.status !== NodeEnrollmentRequestStatuses.submitted
    && value.status !== NodeEnrollmentRequestStatuses.underReview
  ) {
    throw new NodeTrustApiContractError(
      `Pending enrollment summary requires submitted or under-review status, received '${value.status}'.`,
    );
  }

  return Object.freeze({
    requestId: value.requestId,
    nodeId: value.nodeId,
    nodeType: value.nodeType,
    displayName: value.displayName,
    requestedAt: value.requestedAt,
    status: value.status,
    capabilityProfile: value.capabilityProfile,
    deploymentTags: value.deploymentTags,
    hasBootstrapMaterial: Boolean(value.certificateRef),
  });
}

export function toNodeInventorySummaryDto(value: NodeInternalInventorySummaryDto): NodeInventorySummaryDto {
  return Object.freeze({
    nodeId: value.nodeId,
    nodeType: value.nodeType,
    displayName: value.displayName,
    approvalStatus: value.approvalStatus,
    trustState: value.trustState,
    enrollmentStatus: value.enrollmentStatus,
    operationalState: value.operationalState,
    presenceState: value.presenceState,
    capabilityProfile: value.capabilityProfile,
    deploymentTags: value.deploymentTags,
    lastSeen: value.lastSeen,
    certificateRef: value.certificateRef,
    revocation: Object.freeze({
      state: value.revocation.state,
      reason: value.revocation.reason,
      revokedAt: value.revocation.revokedAt,
      note: value.revocation.note,
    }),
    enrolledAt: value.enrolledAt,
    requestedAt: value.requestedAt,
    approvedAt: value.approvedAt,
    revokedAt: value.revokedAt,
    pendingEnrollmentRequestId: value.pendingEnrollmentRequestId,
  });
}

export function toNodeInventoryDetailDto(value: NodeInternalInventoryDetailDto): NodeInventoryDetailDto {
  return Object.freeze({
    ...toNodeInventorySummaryDto(value),
    pendingEnrollment: value.pendingEnrollment
      ? Object.freeze({
        requestId: value.pendingEnrollment.requestId,
        status: value.pendingEnrollment.status,
        requestedAt: value.pendingEnrollment.requestedAt,
        reviewedAt: value.pendingEnrollment.reviewedAt,
        decisionNote: value.pendingEnrollment.decisionNote,
        certificateRef: value.pendingEnrollment.certificateRef,
      })
      : undefined,
  });
}
