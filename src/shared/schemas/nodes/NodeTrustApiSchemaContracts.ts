import { z } from "zod";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustDomainError,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
} from "../../../domain/nodes/NodeTrustDomain";

export interface NodeTrustApiSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class NodeTrustApiSchemaValidationError extends Error {
  public readonly schemaName: string;

  public readonly issues: ReadonlyArray<NodeTrustApiSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<NodeTrustApiSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "NodeTrustApiSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/;

export const NodeTrustApiIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(256, "Identifier must be 256 characters or fewer.")
  .regex(IdentifierPattern, "Identifier must use alphanumeric, ':', '_' or '-' characters.");

export const NodeTrustApiTimestampSchema = z
  .string()
  .trim()
  .min(1, "Timestamp is required.")
  .datetime({ offset: true });

const NodeTypeSchema = z.enum([
  NodeTypes.compute,
  NodeTypes.hybrid,
  NodeTypes.edge,
]);

const NodeApprovalStatusSchema = z.enum([
  NodeApprovalStatuses.pending,
  NodeApprovalStatuses.approved,
  NodeApprovalStatuses.rejected,
  NodeApprovalStatuses.suspended,
]);

const NodeTrustStateSchema = z.enum([
  NodeTrustStates.pendingEnrollment,
  NodeTrustStates.pendingApproval,
  NodeTrustStates.trusted,
  NodeTrustStates.quarantined,
  NodeTrustStates.revoked,
]);

const NodeRevocationStateSchema = z.enum([
  NodeRevocationStates.active,
  NodeRevocationStates.pendingRevocation,
  NodeRevocationStates.revoked,
]);

const NodeRevocationReasonSchema = z.enum([
  NodeRevocationReasons.ownerRequest,
  NodeRevocationReasons.operatorAction,
  NodeRevocationReasons.certificateCompromise,
  NodeRevocationReasons.policyViolation,
  NodeRevocationReasons.decommissioned,
]);

const NodeHeartbeatStatusSchema = z.enum([
  NodeHeartbeatStatuses.online,
  NodeHeartbeatStatuses.degraded,
  NodeHeartbeatStatuses.offline,
]);

const NodeInventoryOperationalStateSchema = z.enum([
  "active",
  "pending",
  "rejected",
  "revoked",
  "offline",
]);

const NodeInventoryPresenceStateSchema = z.enum([
  "online",
  "degraded",
  "offline",
  "unknown",
]);

const NodeRoleCapabilitySchema = z.enum([
  NodeRoleCapabilities.ui,
  NodeRoleCapabilities.api,
  NodeRoleCapabilities.scheduler,
  NodeRoleCapabilities.executor,
  NodeRoleCapabilities.storageAccess,
  NodeRoleCapabilities.previewWorker,
]);

const NodeEnrollmentRequestStatusSchema = z.enum([
  NodeEnrollmentRequestStatuses.submitted,
  NodeEnrollmentRequestStatuses.underReview,
  NodeEnrollmentRequestStatuses.approved,
  NodeEnrollmentRequestStatuses.rejected,
  NodeEnrollmentRequestStatuses.withdrawn,
  NodeEnrollmentRequestStatuses.expired,
]);

const NodePendingEnrollmentRequestStatusSchema = z.enum([
  NodeEnrollmentRequestStatuses.submitted,
  NodeEnrollmentRequestStatuses.underReview,
]);

const NodeTransportMetadataSchema = z.record(z.string(), z.unknown());

export const NodeCapabilityProfileDtoSchema = z.object({
  enabledCapabilities: z.array(NodeRoleCapabilitySchema)
    .min(1, "Node capabilityProfile must include at least one enabled capability."),
  capabilityProfileVersion: NodeTrustApiIdentifierSchema.optional(),
  supportsRemoteScheduling: z.boolean(),
  maxConcurrentWorkloads: z.number().int().positive().optional(),
}).strict().superRefine((value, context) => {
  const unique = new Set(value.enabledCapabilities);
  if (unique.size !== value.enabledCapabilities.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["enabledCapabilities"],
      message: "Node capabilityProfile enabledCapabilities must not include duplicates.",
    });
  }

  try {
    createNodeCapabilityProfile(value);
  } catch (error) {
    if (error instanceof NodeTrustDomainError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enabledCapabilities"],
        message: error.message,
      });
    }
  }
});

export const NodeCertificateBootstrapEnvelopeDtoSchema = z.object({
  bootstrapTokenId: NodeTrustApiIdentifierSchema.optional(),
  bootstrapNonce: NodeTrustApiIdentifierSchema.optional(),
  attestationFormat: NodeTrustApiIdentifierSchema.optional(),
  attestationEvidence: z.string().trim().min(1).max(10000).optional(),
  requestedCertificateProfile: NodeTrustApiIdentifierSchema.optional(),
  trustMaterialRef: NodeTrustApiIdentifierSchema.optional(),
  publicKeyAlgorithm: NodeTrustApiIdentifierSchema.optional(),
  publicKeyFingerprintSha256: z.string().trim().regex(/^[a-f0-9]{64}$/).optional(),
  publicKeyPem: z.string().trim().min(1).max(10000).optional(),
}).strict().superRefine((value, context) => {
  if (
    !value.bootstrapTokenId
    && !value.attestationEvidence
    && !value.requestedCertificateProfile
    && !value.trustMaterialRef
    && !value.publicKeyPem
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bootstrapTokenId"],
      message: "Bootstrap envelope must include at least one bootstrap field.",
    });
  }

  if (value.publicKeyPem && !value.trustMaterialRef) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["trustMaterialRef"],
      message: "Bootstrap envelope publicKeyPem requires trustMaterialRef.",
    });
  }
});

export const NodeCertificateAssignmentDtoSchema = z.object({
  certificateRef: NodeTrustApiIdentifierSchema,
  certificateAssignedAt: NodeTrustApiTimestampSchema.optional(),
  certificateExpiresAt: NodeTrustApiTimestampSchema.optional(),
}).strict();

export const NodeInternalCertificateAssignmentDtoSchema = NodeCertificateAssignmentDtoSchema.extend({
  certificateAuthorityRef: NodeTrustApiIdentifierSchema.optional(),
  certificateThumbprint: z.string().trim().min(1).max(256).optional(),
}).strict();

export const NodeLastSeenDtoSchema = z.object({
  lastSeenAt: NodeTrustApiTimestampSchema,
  heartbeatStatus: NodeHeartbeatStatusSchema,
  observedBy: NodeTrustApiIdentifierSchema.optional(),
}).strict();

export const NodeRevocationDtoSchema = z.object({
  state: NodeRevocationStateSchema,
  reason: NodeRevocationReasonSchema.optional(),
  revokedAt: NodeTrustApiTimestampSchema.optional(),
  note: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, context) => {
  if (value.state === NodeRevocationStates.revoked) {
    if (!value.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Revoked node payloads require reason.",
      });
    }
    if (!value.revokedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revokedAt"],
        message: "Revoked node payloads require revokedAt.",
      });
    }
  }
});

export const NodeInternalRevocationDtoSchema = NodeRevocationDtoSchema.extend({
  revokedByUserIdentityId: NodeTrustApiIdentifierSchema.optional(),
}).strict();

export const NodeEnrollmentSubmissionRequestDtoSchema = z.object({
  actorUserIdentityId: NodeTrustApiIdentifierSchema,
  nodeId: NodeTrustApiIdentifierSchema,
  nodeType: NodeTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  capabilityProfile: NodeCapabilityProfileDtoSchema,
  deploymentTags: z.array(NodeTrustApiIdentifierSchema).max(64).optional(),
  certificateRef: NodeTrustApiIdentifierSchema.optional(),
  bootstrap: NodeCertificateBootstrapEnvelopeDtoSchema.optional(),
  requestedAt: NodeTrustApiTimestampSchema.optional(),
  correlationId: NodeTrustApiIdentifierSchema.optional(),
  metadata: NodeTransportMetadataSchema.optional(),
}).strict();

export const NodePendingEnrollmentSummaryDtoSchema = z.object({
  requestId: NodeTrustApiIdentifierSchema,
  nodeId: NodeTrustApiIdentifierSchema,
  nodeType: NodeTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  requestedAt: NodeTrustApiTimestampSchema,
  status: NodePendingEnrollmentRequestStatusSchema,
  capabilityProfile: NodeCapabilityProfileDtoSchema,
  deploymentTags: z.array(NodeTrustApiIdentifierSchema).max(64),
  hasBootstrapMaterial: z.boolean(),
}).strict();

export const ApproveNodeEnrollmentActionRequestDtoSchema = z.object({
  actorUserIdentityId: NodeTrustApiIdentifierSchema,
  requestId: NodeTrustApiIdentifierSchema,
  reviewedAt: NodeTrustApiTimestampSchema.optional(),
  decisionNote: z.string().trim().max(2000).optional(),
  certificate: NodeInternalCertificateAssignmentDtoSchema.optional(),
  correlationId: NodeTrustApiIdentifierSchema.optional(),
  metadata: NodeTransportMetadataSchema.optional(),
}).strict();

export const RejectNodeEnrollmentActionRequestDtoSchema = z.object({
  actorUserIdentityId: NodeTrustApiIdentifierSchema,
  requestId: NodeTrustApiIdentifierSchema,
  reviewedAt: NodeTrustApiTimestampSchema.optional(),
  decisionNote: z.string().trim().max(2000).optional(),
  correlationId: NodeTrustApiIdentifierSchema.optional(),
  metadata: NodeTransportMetadataSchema.optional(),
}).strict();

export const RevokeNodeTrustActionRequestDtoSchema = z.object({
  actorUserIdentityId: NodeTrustApiIdentifierSchema,
  nodeId: NodeTrustApiIdentifierSchema,
  reason: NodeRevocationReasonSchema,
  revokedAt: NodeTrustApiTimestampSchema.optional(),
  note: z.string().trim().max(2000).optional(),
  correlationId: NodeTrustApiIdentifierSchema.optional(),
  metadata: NodeTransportMetadataSchema.optional(),
}).strict();

export const NodeHeartbeatPayloadDtoSchema = z.object({
  actorUserIdentityId: NodeTrustApiIdentifierSchema,
  nodeId: NodeTrustApiIdentifierSchema,
  heartbeatStatus: NodeHeartbeatStatusSchema,
  seenAt: NodeTrustApiTimestampSchema.optional(),
  observedBy: NodeTrustApiIdentifierSchema.optional(),
  metadata: NodeTransportMetadataSchema.optional(),
}).strict();

export const NodeEnrollmentDetailDtoSchema = z.object({
  requestId: NodeTrustApiIdentifierSchema,
  nodeId: NodeTrustApiIdentifierSchema,
  nodeType: NodeTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  status: NodeEnrollmentRequestStatusSchema,
  requestedAt: NodeTrustApiTimestampSchema,
  reviewedAt: NodeTrustApiTimestampSchema.optional(),
  decisionNote: z.string().trim().max(2000).optional(),
  capabilityProfile: NodeCapabilityProfileDtoSchema,
  deploymentTags: z.array(NodeTrustApiIdentifierSchema).max(64),
  certificateRef: NodeTrustApiIdentifierSchema.optional(),
}).strict();

export const NodeInternalEnrollmentDetailDtoSchema = NodeEnrollmentDetailDtoSchema.extend({
  reviewedByUserIdentityId: NodeTrustApiIdentifierSchema.optional(),
  createdAt: NodeTrustApiTimestampSchema,
  createdBy: NodeTrustApiIdentifierSchema,
  lastModifiedAt: NodeTrustApiTimestampSchema,
  lastModifiedBy: NodeTrustApiIdentifierSchema,
  revision: z.number().int().nonnegative(),
}).strict();

export const NodeDetailDtoSchema = z.object({
  nodeId: NodeTrustApiIdentifierSchema,
  nodeType: NodeTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  approvalStatus: NodeApprovalStatusSchema,
  trustState: NodeTrustStateSchema,
  capabilityProfile: NodeCapabilityProfileDtoSchema,
  deploymentTags: z.array(NodeTrustApiIdentifierSchema).max(64),
  certificate: NodeCertificateAssignmentDtoSchema.optional(),
  lastSeen: NodeLastSeenDtoSchema.optional(),
  revocation: NodeRevocationDtoSchema,
  enrolledAt: NodeTrustApiTimestampSchema,
  approvedAt: NodeTrustApiTimestampSchema.optional(),
  revokedAt: NodeTrustApiTimestampSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.trustState === NodeTrustStates.trusted && !value.certificate?.certificateRef) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["certificate"],
      message: "Trusted node payloads require certificate.",
    });
  }

  if (value.trustState === NodeTrustStates.revoked && value.revocation.state !== NodeRevocationStates.revoked) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["revocation", "state"],
      message: "Revoked node trust state requires revocation.state='revoked'.",
    });
  }
});

export const NodeInternalDetailDtoSchema = NodeDetailDtoSchema.extend({
  certificate: NodeInternalCertificateAssignmentDtoSchema.optional(),
  revocation: NodeInternalRevocationDtoSchema,
  enrollmentRequestId: NodeTrustApiIdentifierSchema.optional(),
  createdAt: NodeTrustApiTimestampSchema,
  createdBy: NodeTrustApiIdentifierSchema,
  lastModifiedAt: NodeTrustApiTimestampSchema,
  lastModifiedBy: NodeTrustApiIdentifierSchema,
  revision: z.number().int().nonnegative(),
}).strict();

export const NodeEnrollmentSubmissionResponseDtoSchema = z.object({
  enrollment: NodeEnrollmentDetailDtoSchema,
}).strict();

export const PendingEnrollmentListResponseDtoSchema = z.object({
  enrollments: z.array(NodePendingEnrollmentSummaryDtoSchema),
}).strict();

export const NodeEnrollmentDecisionResponseDtoSchema = z.object({
  enrollment: NodeEnrollmentDetailDtoSchema,
  node: NodeDetailDtoSchema,
}).strict();

export const NodeRevocationResponseDtoSchema = z.object({
  node: NodeDetailDtoSchema,
}).strict();

export const NodeHeartbeatResponseDtoSchema = z.object({
  node: NodeDetailDtoSchema,
}).strict();

export const NodeInventoryPendingEnrollmentDtoSchema = z.object({
  requestId: NodeTrustApiIdentifierSchema,
  status: NodeEnrollmentRequestStatusSchema,
  requestedAt: NodeTrustApiTimestampSchema,
  reviewedAt: NodeTrustApiTimestampSchema.optional(),
  decisionNote: z.string().trim().max(2000).optional(),
  certificateRef: NodeTrustApiIdentifierSchema.optional(),
}).strict();

export const NodeInventorySummaryDtoSchema = z.object({
  nodeId: NodeTrustApiIdentifierSchema,
  nodeType: NodeTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  approvalStatus: NodeApprovalStatusSchema,
  trustState: NodeTrustStateSchema,
  enrollmentStatus: NodeEnrollmentRequestStatusSchema.optional(),
  operationalState: NodeInventoryOperationalStateSchema,
  presenceState: NodeInventoryPresenceStateSchema,
  capabilityProfile: NodeCapabilityProfileDtoSchema,
  deploymentTags: z.array(NodeTrustApiIdentifierSchema).max(64),
  lastSeen: NodeLastSeenDtoSchema.optional(),
  certificateRef: NodeTrustApiIdentifierSchema.optional(),
  revocation: NodeRevocationDtoSchema,
  enrolledAt: NodeTrustApiTimestampSchema.optional(),
  requestedAt: NodeTrustApiTimestampSchema.optional(),
  approvedAt: NodeTrustApiTimestampSchema.optional(),
  revokedAt: NodeTrustApiTimestampSchema.optional(),
  pendingEnrollmentRequestId: NodeTrustApiIdentifierSchema.optional(),
}).strict();

export const NodeInventoryDetailDtoSchema = NodeInventorySummaryDtoSchema.extend({
  pendingEnrollment: NodeInventoryPendingEnrollmentDtoSchema.optional(),
}).strict();

export const NodeInventoryListResponseDtoSchema = z.object({
  nodes: z.array(NodeInventorySummaryDtoSchema),
}).strict();

export const NodeInventoryDetailResponseDtoSchema = z.object({
  node: NodeInventoryDetailDtoSchema,
}).strict();

export type NodeCapabilityProfileDtoPayload = z.infer<typeof NodeCapabilityProfileDtoSchema>;
export type NodeEnrollmentSubmissionRequestDtoPayload = z.infer<typeof NodeEnrollmentSubmissionRequestDtoSchema>;
export type NodePendingEnrollmentSummaryDtoPayload = z.infer<typeof NodePendingEnrollmentSummaryDtoSchema>;
export type ApproveNodeEnrollmentActionRequestDtoPayload = z.infer<typeof ApproveNodeEnrollmentActionRequestDtoSchema>;
export type RejectNodeEnrollmentActionRequestDtoPayload = z.infer<typeof RejectNodeEnrollmentActionRequestDtoSchema>;
export type RevokeNodeTrustActionRequestDtoPayload = z.infer<typeof RevokeNodeTrustActionRequestDtoSchema>;
export type NodeHeartbeatPayloadDtoPayload = z.infer<typeof NodeHeartbeatPayloadDtoSchema>;
export type NodeEnrollmentDetailDtoPayload = z.infer<typeof NodeEnrollmentDetailDtoSchema>;
export type NodeInternalEnrollmentDetailDtoPayload = z.infer<typeof NodeInternalEnrollmentDetailDtoSchema>;
export type NodeDetailDtoPayload = z.infer<typeof NodeDetailDtoSchema>;
export type NodeInternalDetailDtoPayload = z.infer<typeof NodeInternalDetailDtoSchema>;
export type NodeEnrollmentSubmissionResponseDtoPayload = z.infer<typeof NodeEnrollmentSubmissionResponseDtoSchema>;
export type PendingEnrollmentListResponseDtoPayload = z.infer<typeof PendingEnrollmentListResponseDtoSchema>;
export type NodeEnrollmentDecisionResponseDtoPayload = z.infer<typeof NodeEnrollmentDecisionResponseDtoSchema>;
export type NodeRevocationResponseDtoPayload = z.infer<typeof NodeRevocationResponseDtoSchema>;
export type NodeHeartbeatResponseDtoPayload = z.infer<typeof NodeHeartbeatResponseDtoSchema>;
export type NodeInventoryPendingEnrollmentDtoPayload = z.infer<typeof NodeInventoryPendingEnrollmentDtoSchema>;
export type NodeInventorySummaryDtoPayload = z.infer<typeof NodeInventorySummaryDtoSchema>;
export type NodeInventoryDetailDtoPayload = z.infer<typeof NodeInventoryDetailDtoSchema>;
export type NodeInventoryListResponseDtoPayload = z.infer<typeof NodeInventoryListResponseDtoSchema>;
export type NodeInventoryDetailResponseDtoPayload = z.infer<typeof NodeInventoryDetailResponseDtoSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(schemaName: string, error: z.ZodError): NodeTrustApiSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new NodeTrustApiSchemaValidationError(schemaName, issues);
}

function parseNodeTrustApiSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }

  return parsed.data;
}

export function parseNodeCapabilityProfileDto(payload: unknown): NodeCapabilityProfileDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeCapabilityProfileDto",
    NodeCapabilityProfileDtoSchema,
    payload,
  );
}

export function parseNodeEnrollmentSubmissionRequestDto(
  payload: unknown,
): NodeEnrollmentSubmissionRequestDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeEnrollmentSubmissionRequestDto",
    NodeEnrollmentSubmissionRequestDtoSchema,
    payload,
  );
}

export function parseNodePendingEnrollmentSummaryDto(payload: unknown): NodePendingEnrollmentSummaryDtoPayload {
  return parseNodeTrustApiSchema(
    "NodePendingEnrollmentSummaryDto",
    NodePendingEnrollmentSummaryDtoSchema,
    payload,
  );
}

export function parseApproveNodeEnrollmentActionRequestDto(
  payload: unknown,
): ApproveNodeEnrollmentActionRequestDtoPayload {
  return parseNodeTrustApiSchema(
    "ApproveNodeEnrollmentActionRequestDto",
    ApproveNodeEnrollmentActionRequestDtoSchema,
    payload,
  );
}

export function parseRejectNodeEnrollmentActionRequestDto(
  payload: unknown,
): RejectNodeEnrollmentActionRequestDtoPayload {
  return parseNodeTrustApiSchema(
    "RejectNodeEnrollmentActionRequestDto",
    RejectNodeEnrollmentActionRequestDtoSchema,
    payload,
  );
}

export function parseRevokeNodeTrustActionRequestDto(payload: unknown): RevokeNodeTrustActionRequestDtoPayload {
  return parseNodeTrustApiSchema(
    "RevokeNodeTrustActionRequestDto",
    RevokeNodeTrustActionRequestDtoSchema,
    payload,
  );
}

export function parseNodeHeartbeatPayloadDto(payload: unknown): NodeHeartbeatPayloadDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeHeartbeatPayloadDto",
    NodeHeartbeatPayloadDtoSchema,
    payload,
  );
}

export function parseNodeEnrollmentDetailDto(payload: unknown): NodeEnrollmentDetailDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeEnrollmentDetailDto",
    NodeEnrollmentDetailDtoSchema,
    payload,
  );
}

export function parseNodeInternalEnrollmentDetailDto(payload: unknown): NodeInternalEnrollmentDetailDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeInternalEnrollmentDetailDto",
    NodeInternalEnrollmentDetailDtoSchema,
    payload,
  );
}

export function parseNodeDetailDto(payload: unknown): NodeDetailDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeDetailDto",
    NodeDetailDtoSchema,
    payload,
  );
}

export function parseNodeInternalDetailDto(payload: unknown): NodeInternalDetailDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeInternalDetailDto",
    NodeInternalDetailDtoSchema,
    payload,
  );
}

export function parseNodeEnrollmentSubmissionResponseDto(
  payload: unknown,
): NodeEnrollmentSubmissionResponseDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeEnrollmentSubmissionResponseDto",
    NodeEnrollmentSubmissionResponseDtoSchema,
    payload,
  );
}

export function parsePendingEnrollmentListResponseDto(payload: unknown): PendingEnrollmentListResponseDtoPayload {
  return parseNodeTrustApiSchema(
    "PendingEnrollmentListResponseDto",
    PendingEnrollmentListResponseDtoSchema,
    payload,
  );
}

export function parseNodeEnrollmentDecisionResponseDto(payload: unknown): NodeEnrollmentDecisionResponseDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeEnrollmentDecisionResponseDto",
    NodeEnrollmentDecisionResponseDtoSchema,
    payload,
  );
}

export function parseNodeRevocationResponseDto(payload: unknown): NodeRevocationResponseDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeRevocationResponseDto",
    NodeRevocationResponseDtoSchema,
    payload,
  );
}

export function parseNodeHeartbeatResponseDto(payload: unknown): NodeHeartbeatResponseDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeHeartbeatResponseDto",
    NodeHeartbeatResponseDtoSchema,
    payload,
  );
}

export function parseNodeInventorySummaryDto(payload: unknown): NodeInventorySummaryDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeInventorySummaryDto",
    NodeInventorySummaryDtoSchema,
    payload,
  );
}

export function parseNodeInventoryDetailDto(payload: unknown): NodeInventoryDetailDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeInventoryDetailDto",
    NodeInventoryDetailDtoSchema,
    payload,
  );
}

export function parseNodeInventoryListResponseDto(payload: unknown): NodeInventoryListResponseDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeInventoryListResponseDto",
    NodeInventoryListResponseDtoSchema,
    payload,
  );
}

export function parseNodeInventoryDetailResponseDto(payload: unknown): NodeInventoryDetailResponseDtoPayload {
  return parseNodeTrustApiSchema(
    "NodeInventoryDetailResponseDto",
    NodeInventoryDetailResponseDtoSchema,
    payload,
  );
}
