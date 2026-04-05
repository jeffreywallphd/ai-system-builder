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
