import { z } from "zod";
import {
  WorkspaceEncryptionKeyScopes,
  WorkspaceEncryptionModes,
  WorkspaceInvitationStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
} from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "../../workspaces/WorkspaceOwnership";
import {
  PersistenceAuditStampSchema,
  PersistenceIdentifierSchema,
  PersistenceSensitiveFieldDescriptorSchema,
  PersistenceTenancyMetadataSchema,
  PersistenceTimestampSchema,
  PersistenceVersionMetadataSchema,
  parsePersistenceSchema,
} from "../persistence/PersistenceSchemaPrimitives";

const WorkspaceStatusSchema = z.enum([
  WorkspaceStatuses.provisioning,
  WorkspaceStatuses.active,
  WorkspaceStatuses.suspended,
  WorkspaceStatuses.archived,
]);

const WorkspaceVisibilitySchema = z.enum([
  WorkspaceVisibilities.private,
  WorkspaceVisibilities.workspace,
  WorkspaceVisibilities.public,
]);

const WorkspaceEncryptionModeSchema = z.enum([
  WorkspaceEncryptionModes.none,
  WorkspaceEncryptionModes.platformManaged,
  WorkspaceEncryptionModes.customerManaged,
]);

const WorkspaceEncryptionKeyScopeSchema = z.enum([
  WorkspaceEncryptionKeyScopes.workspace,
  WorkspaceEncryptionKeyScopes.storageInstance,
  WorkspaceEncryptionKeyScopes.platform,
]);

const WorkspaceRoleSchema = z.enum([
  WorkspaceRoles.owner,
  WorkspaceRoles.admin,
  WorkspaceRoles.member,
  WorkspaceRoles.viewer,
]);

const WorkspaceMembershipStatusSchema = z.enum([
  WorkspaceMembershipStatuses.pending,
  WorkspaceMembershipStatuses.active,
  WorkspaceMembershipStatuses.suspended,
  WorkspaceMembershipStatuses.removed,
]);

const WorkspaceRoleAssignmentStatusSchema = z.enum([
  WorkspaceRoleAssignmentStatuses.active,
  WorkspaceRoleAssignmentStatuses.revoked,
]);

const WorkspaceInvitationStatusSchema = z.enum([
  WorkspaceInvitationStatuses.pending,
  WorkspaceInvitationStatuses.accepted,
  WorkspaceInvitationStatuses.declined,
  WorkspaceInvitationStatuses.revoked,
  WorkspaceInvitationStatuses.expired,
]);

const WorkspaceEncryptionPolicySchema = z.object({
  encryptionMode: WorkspaceEncryptionModeSchema,
  contentEncryptionRequired: z.boolean(),
  keyScope: WorkspaceEncryptionKeyScopeSchema,
  allowPreviewDecryption: z.boolean(),
  allowWorkerDecryption: z.boolean(),
});

export const WorkspacePersistenceRecordSchema = z.object({
  workspaceId: PersistenceIdentifierSchema,
  slug: z.string().trim().min(1).max(160),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  status: WorkspaceStatusSchema,
  ownerUserIdentityId: PersistenceIdentifierSchema,
  visibility: WorkspaceVisibilitySchema,
  tenancy: PersistenceTenancyMetadataSchema,
  encryptionPolicy: WorkspaceEncryptionPolicySchema,
}).merge(PersistenceAuditStampSchema).merge(PersistenceVersionMetadataSchema).superRefine((value, context) => {
  if (value.tenancy.workspaceId && value.tenancy.workspaceId !== value.workspaceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tenancy", "workspaceId"],
      message: "Workspace tenancy workspaceId must match workspace record workspaceId.",
    });
  }
});

export const WorkspaceMembershipPersistenceRecordSchema = z.object({
  membershipId: PersistenceIdentifierSchema,
  workspaceId: PersistenceIdentifierSchema,
  userIdentityId: PersistenceIdentifierSchema,
  status: WorkspaceMembershipStatusSchema,
  invitedByUserIdentityId: PersistenceIdentifierSchema.optional(),
  invitationId: PersistenceIdentifierSchema.optional(),
  joinedAt: PersistenceTimestampSchema.optional(),
  suspendedAt: PersistenceTimestampSchema.optional(),
  removedAt: PersistenceTimestampSchema.optional(),
  removedByUserIdentityId: PersistenceIdentifierSchema.optional(),
  tenancy: PersistenceTenancyMetadataSchema,
}).merge(PersistenceAuditStampSchema).merge(PersistenceVersionMetadataSchema).superRefine((value, context) => {
  if (value.status === WorkspaceMembershipStatuses.active && !value.joinedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["joinedAt"],
      message: "Active workspace membership records require joinedAt.",
    });
  }

  if (value.status === WorkspaceMembershipStatuses.removed) {
    if (!value.removedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["removedAt"],
        message: "Removed workspace membership records require removedAt.",
      });
    }
    if (!value.removedByUserIdentityId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["removedByUserIdentityId"],
        message: "Removed workspace membership records require removedByUserIdentityId.",
      });
    }
  }
});

export const WorkspaceRoleAssignmentPersistenceRecordSchema = z.object({
  roleAssignmentId: PersistenceIdentifierSchema,
  workspaceId: PersistenceIdentifierSchema,
  userIdentityId: PersistenceIdentifierSchema,
  role: WorkspaceRoleSchema,
  status: WorkspaceRoleAssignmentStatusSchema,
  assignedAt: PersistenceTimestampSchema,
  assignedByUserIdentityId: PersistenceIdentifierSchema,
  revokedAt: PersistenceTimestampSchema.optional(),
  revokedByUserIdentityId: PersistenceIdentifierSchema.optional(),
  tenancy: PersistenceTenancyMetadataSchema,
}).merge(PersistenceAuditStampSchema).merge(PersistenceVersionMetadataSchema).superRefine((value, context) => {
  if (value.status === WorkspaceRoleAssignmentStatuses.revoked) {
    if (!value.revokedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revokedAt"],
        message: "Revoked workspace role assignment records require revokedAt.",
      });
    }
    if (!value.revokedByUserIdentityId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revokedByUserIdentityId"],
        message: "Revoked workspace role assignment records require revokedByUserIdentityId.",
      });
    }
  }
});

export const WorkspaceInvitationPersistenceRecordSchema = z.object({
  invitationId: PersistenceIdentifierSchema,
  workspaceId: PersistenceIdentifierSchema,
  invitedEmail: z.string().trim().email(),
  invitedByUserIdentityId: PersistenceIdentifierSchema,
  invitedRoles: z.array(WorkspaceRoleSchema).min(1),
  invitationTokenHash: z.string().trim().min(1).max(256).optional(),
  invitationTokenHint: z.string().trim().min(1).max(64).optional(),
  targetUserIdentityIdHint: PersistenceIdentifierSchema.optional(),
  onboardingMetadata: z.record(z.unknown()).optional(),
  status: WorkspaceInvitationStatusSchema,
  expiresAt: PersistenceTimestampSchema,
  respondedAt: PersistenceTimestampSchema.optional(),
  acceptedByUserIdentityId: PersistenceIdentifierSchema.optional(),
  tenancy: PersistenceTenancyMetadataSchema,
  sensitiveFields: z.array(PersistenceSensitiveFieldDescriptorSchema),
}).merge(PersistenceAuditStampSchema).merge(PersistenceVersionMetadataSchema).superRefine((value, context) => {
  if (value.status === WorkspaceInvitationStatuses.accepted && !value.acceptedByUserIdentityId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["acceptedByUserIdentityId"],
      message: "Accepted workspace invitation records require acceptedByUserIdentityId.",
    });
  }
  if (value.invitationTokenHint && !value.invitationTokenHash) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["invitationTokenHash"],
      message: "Workspace invitation token hints require invitationTokenHash.",
    });
  }
});

export type WorkspacePersistenceRecordPayload = z.infer<typeof WorkspacePersistenceRecordSchema>;
export type WorkspaceMembershipPersistenceRecordPayload = z.infer<typeof WorkspaceMembershipPersistenceRecordSchema>;
export type WorkspaceRoleAssignmentPersistenceRecordPayload = z.infer<typeof WorkspaceRoleAssignmentPersistenceRecordSchema>;
export type WorkspaceInvitationPersistenceRecordPayload = z.infer<typeof WorkspaceInvitationPersistenceRecordSchema>;

export function parseWorkspacePersistenceRecord(payload: unknown): WorkspacePersistenceRecordPayload {
  return parsePersistenceSchema(
    "WorkspacePersistenceRecord",
    WorkspacePersistenceRecordSchema,
    payload,
  );
}

export function parseWorkspaceMembershipPersistenceRecord(
  payload: unknown,
): WorkspaceMembershipPersistenceRecordPayload {
  return parsePersistenceSchema(
    "WorkspaceMembershipPersistenceRecord",
    WorkspaceMembershipPersistenceRecordSchema,
    payload,
  );
}

export function parseWorkspaceRoleAssignmentPersistenceRecord(
  payload: unknown,
): WorkspaceRoleAssignmentPersistenceRecordPayload {
  return parsePersistenceSchema(
    "WorkspaceRoleAssignmentPersistenceRecord",
    WorkspaceRoleAssignmentPersistenceRecordSchema,
    payload,
  );
}

export function parseWorkspaceInvitationPersistenceRecord(
  payload: unknown,
): WorkspaceInvitationPersistenceRecordPayload {
  return parsePersistenceSchema(
    "WorkspaceInvitationPersistenceRecord",
    WorkspaceInvitationPersistenceRecordSchema,
    payload,
  );
}

