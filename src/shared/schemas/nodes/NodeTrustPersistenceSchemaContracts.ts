import { z } from "zod";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationReasons,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../domain/nodes/NodeTrustDomain";

export interface NodeTrustPersistenceSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class NodeTrustPersistenceSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<NodeTrustPersistenceSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<NodeTrustPersistenceSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "NodeTrustPersistenceSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/;

export const NodeTrustPersistenceIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(256, "Identifier must be 256 characters or fewer.")
  .regex(IdentifierPattern, "Identifier must use alphanumeric, ':', '_' or '-' characters.");

export const NodeTrustPersistenceTimestampSchema = z
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

const NodeHeartbeatStatusSchema = z.enum([
  NodeHeartbeatStatuses.online,
  NodeHeartbeatStatuses.degraded,
  NodeHeartbeatStatuses.offline,
]);

const NodeRoleCapabilitySchema = z.enum([
  NodeRoleCapabilities.workflowExecution,
  NodeRoleCapabilities.modelInference,
  NodeRoleCapabilities.modelTraining,
  NodeRoleCapabilities.mcpToolExecution,
  NodeRoleCapabilities.storageAccess,
  NodeRoleCapabilities.schedulingParticipation,
]);

const NodeEnrollmentRequestStatusSchema = z.enum([
  NodeEnrollmentRequestStatuses.submitted,
  NodeEnrollmentRequestStatuses.underReview,
  NodeEnrollmentRequestStatuses.approved,
  NodeEnrollmentRequestStatuses.rejected,
  NodeEnrollmentRequestStatuses.withdrawn,
  NodeEnrollmentRequestStatuses.expired,
]);

export const NodeCapabilityProfilePersistenceRecordSchema = z.object({
  enabledCapabilities: z.array(NodeRoleCapabilitySchema)
    .min(1, "Node capabilityProfile must include at least one enabled capability."),
  capabilityProfileVersion: NodeTrustPersistenceIdentifierSchema.optional(),
  supportsRemoteScheduling: z.boolean(),
  maxConcurrentWorkloads: z.number().int().positive().optional(),
}).superRefine((value, context) => {
  const uniqueCount = new Set(value.enabledCapabilities).size;
  if (uniqueCount !== value.enabledCapabilities.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["enabledCapabilities"],
      message: "Node capabilityProfile enabledCapabilities must not include duplicates.",
    });
  }
});

export const NodeCertificateReferencePersistenceRecordSchema = z.object({
  certificateRef: NodeTrustPersistenceIdentifierSchema,
  certificateAssignedAt: NodeTrustPersistenceTimestampSchema.optional(),
  certificateExpiresAt: NodeTrustPersistenceTimestampSchema.optional(),
  certificateAuthorityRef: NodeTrustPersistenceIdentifierSchema.optional(),
  certificateThumbprint: z.string().trim().min(1).max(256).optional(),
});

export const NodeLastSeenPersistenceRecordSchema = z.object({
  lastSeenAt: NodeTrustPersistenceTimestampSchema,
  heartbeatStatus: NodeHeartbeatStatusSchema,
  observedBy: NodeTrustPersistenceIdentifierSchema.optional(),
});

export const NodeRevocationPersistenceRecordSchema = z.object({
  state: NodeRevocationStateSchema,
  reason: z.enum([
    NodeRevocationReasons.ownerRequest,
    NodeRevocationReasons.operatorAction,
    NodeRevocationReasons.certificateCompromise,
    NodeRevocationReasons.policyViolation,
    NodeRevocationReasons.decommissioned,
  ]).optional(),
  revokedAt: NodeTrustPersistenceTimestampSchema.optional(),
  revokedByUserIdentityId: NodeTrustPersistenceIdentifierSchema.optional(),
  note: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.state === NodeRevocationStates.revoked) {
    if (!value.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Revoked node records require revocation reason.",
      });
    }
    if (!value.revokedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revokedAt"],
        message: "Revoked node records require revokedAt.",
      });
    }
  }
});

export const NodeIdentityPersistenceRecordSchema = z.object({
  nodeId: NodeTrustPersistenceIdentifierSchema,
  nodeType: NodeTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  capabilityProfile: NodeCapabilityProfilePersistenceRecordSchema,
  approvalStatus: NodeApprovalStatusSchema,
  trustState: NodeTrustStateSchema,
  certificate: NodeCertificateReferencePersistenceRecordSchema.optional(),
  deploymentTags: z.array(NodeTrustPersistenceIdentifierSchema)
    .max(64, "Node deploymentTags support up to 64 tags."),
  lastSeen: NodeLastSeenPersistenceRecordSchema.optional(),
  revocation: NodeRevocationPersistenceRecordSchema,
  enrolledAt: NodeTrustPersistenceTimestampSchema,
  approvedAt: NodeTrustPersistenceTimestampSchema.optional(),
  revokedAt: NodeTrustPersistenceTimestampSchema.optional(),
  enrollmentRequestId: NodeTrustPersistenceIdentifierSchema.optional(),
  createdAt: NodeTrustPersistenceTimestampSchema,
  createdBy: NodeTrustPersistenceIdentifierSchema,
  lastModifiedAt: NodeTrustPersistenceTimestampSchema,
  lastModifiedBy: NodeTrustPersistenceIdentifierSchema,
  revision: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (value.trustState === NodeTrustStates.trusted) {
    if (value.approvalStatus !== NodeApprovalStatuses.approved) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approvalStatus"],
        message: "Trusted node records require approvalStatus='approved'.",
      });
    }
    if (!value.certificate?.certificateRef) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["certificate"],
        message: "Trusted node records require a certificate reference.",
      });
    }
  }

  if (value.trustState === NodeTrustStates.revoked) {
    if (value.revocation.state !== NodeRevocationStates.revoked) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revocation", "state"],
        message: "Revoked trust state requires revocation.state='revoked'.",
      });
    }
    if (!value.revokedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revokedAt"],
        message: "Revoked node records require revokedAt.",
      });
    }
  } else if (value.revocation.state === NodeRevocationStates.revoked) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["trustState"],
      message: "revocation.state='revoked' requires trustState='revoked'.",
    });
  }
});

export const NodeEnrollmentRequestPersistenceRecordSchema = z.object({
  requestId: NodeTrustPersistenceIdentifierSchema,
  nodeId: NodeTrustPersistenceIdentifierSchema,
  nodeType: NodeTypeSchema,
  displayName: z.string().trim().min(1).max(120),
  capabilityProfile: NodeCapabilityProfilePersistenceRecordSchema,
  deploymentTags: z.array(NodeTrustPersistenceIdentifierSchema).max(64),
  certificateRef: NodeTrustPersistenceIdentifierSchema.optional(),
  requestedAt: NodeTrustPersistenceTimestampSchema,
  status: NodeEnrollmentRequestStatusSchema,
  reviewedAt: NodeTrustPersistenceTimestampSchema.optional(),
  reviewedByUserIdentityId: NodeTrustPersistenceIdentifierSchema.optional(),
  decisionNote: z.string().trim().max(2000).optional(),
  createdAt: NodeTrustPersistenceTimestampSchema,
  createdBy: NodeTrustPersistenceIdentifierSchema,
  lastModifiedAt: NodeTrustPersistenceTimestampSchema,
  lastModifiedBy: NodeTrustPersistenceIdentifierSchema,
  revision: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (
    (value.status === NodeEnrollmentRequestStatuses.approved
      || value.status === NodeEnrollmentRequestStatuses.rejected)
    && !value.reviewedAt
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reviewedAt"],
      message: "Approved or rejected enrollment requests require reviewedAt.",
    });
  }
});

export type NodeIdentityPersistenceRecordPayload = z.infer<typeof NodeIdentityPersistenceRecordSchema>;
export type NodeEnrollmentRequestPersistenceRecordPayload = z.infer<typeof NodeEnrollmentRequestPersistenceRecordSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }
  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(
  schemaName: string,
  error: z.ZodError,
): NodeTrustPersistenceSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new NodeTrustPersistenceSchemaValidationError(schemaName, issues);
}

function parseNodeTrustPersistenceSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseNodeIdentityPersistenceRecord(payload: unknown): NodeIdentityPersistenceRecordPayload {
  return parseNodeTrustPersistenceSchema(
    "NodeIdentityPersistenceRecord",
    NodeIdentityPersistenceRecordSchema,
    payload,
  );
}

export function parseNodeEnrollmentRequestPersistenceRecord(
  payload: unknown,
): NodeEnrollmentRequestPersistenceRecordPayload {
  return parseNodeTrustPersistenceSchema(
    "NodeEnrollmentRequestPersistenceRecord",
    NodeEnrollmentRequestPersistenceRecordSchema,
    payload,
  );
}
