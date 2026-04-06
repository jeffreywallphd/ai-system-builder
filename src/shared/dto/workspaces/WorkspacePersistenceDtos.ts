import type {
  WorkspaceEncryptionKeyScope,
  WorkspaceEncryptionMode,
  WorkspaceInvitationStatus,
  WorkspaceMembershipStatus,
  WorkspaceRole,
  WorkspaceRoleAssignmentStatus,
  WorkspaceStatus,
} from "../../../domain/workspaces/WorkspaceDomain";
import type { WorkspaceVisibility } from "../../workspaces/WorkspaceOwnership";
import type {
  PersistenceAuditStamp,
  PersistenceMutationResult,
  PersistenceSensitiveFieldDescriptor,
  PersistenceTenancyMetadata,
  PersistenceVersionMetadata,
} from "../persistence/PersistenceBoundaryDtos";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

export interface WorkspacePersistenceWriteContext {
  readonly actorUserIdentityId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkspacePersistenceMutationEnvelope {
  readonly operationKey: string;
  readonly expectedRevision?: number;
  readonly context: WorkspacePersistenceWriteContext;
}

export interface WorkspaceEncryptionPolicyPersistenceRecord {
  readonly encryptionMode: WorkspaceEncryptionMode;
  readonly contentEncryptionRequired: boolean;
  readonly keyScope: WorkspaceEncryptionKeyScope;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}

export interface WorkspacePersistenceRecord extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly workspaceId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly status: WorkspaceStatus;
  readonly ownerUserIdentityId: string;
  readonly visibility: WorkspaceVisibility;
  readonly tenancy: PersistenceTenancyMetadata;
  readonly encryptionPolicy: WorkspaceEncryptionPolicyPersistenceRecord;
}

export interface WorkspaceMembershipPersistenceRecord extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly membershipId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status: WorkspaceMembershipStatus;
  readonly invitedByUserIdentityId?: string;
  readonly invitationId?: string;
  readonly joinedAt?: string;
  readonly suspendedAt?: string;
  readonly removedAt?: string;
  readonly removedByUserIdentityId?: string;
  readonly tenancy: PersistenceTenancyMetadata;
}

export interface WorkspaceRoleAssignmentPersistenceRecord
  extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly roleAssignmentId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly status: WorkspaceRoleAssignmentStatus;
  readonly assignedAt: string;
  readonly assignedByUserIdentityId: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly tenancy: PersistenceTenancyMetadata;
}

export interface WorkspaceInvitationPersistenceRecord extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly invitationId: string;
  readonly workspaceId: string;
  readonly invitedEmail: string;
  readonly invitedByUserIdentityId: string;
  readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
  readonly invitationTokenHash?: string;
  readonly invitationTokenHint?: string;
  readonly targetUserIdentityIdHint?: string;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
  readonly status: WorkspaceInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly respondedAt?: string;
  readonly acceptedByUserIdentityId?: string;
  readonly tenancy: PersistenceTenancyMetadata;
  readonly sensitiveFields: ReadonlyArray<PersistenceSensitiveFieldDescriptor>;
}

export interface WorkspacePersistenceLookupQuery {
  readonly workspaceIds?: ReadonlyArray<string>;
  readonly ownerUserIdentityId?: string;
  readonly memberUserIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceStatus>;
  readonly visibility?: WorkspaceVisibility;
  readonly limit?: number;
  readonly offset?: number;
}

export interface WorkspaceInvitationPersistenceLookupQuery {
  readonly workspaceId: string;
  readonly invitedEmail?: string;
  readonly invitedByUserIdentityId?: string;
  readonly statuses?: ReadonlyArray<WorkspaceInvitationStatus>;
  readonly activeOnly?: boolean;
  readonly expiresBefore?: string;
  readonly expiresAfter?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type WorkspacePersistenceMutationResult<TRecord> = PersistenceMutationResult<TRecord>;

export function normalizeWorkspaceMutationOperationKey(operationKey: string): string {
  return normalizePersistenceOperationKey(operationKey);
}

export function normalizeWorkspaceInvitationLookupEmail(email: string): string | undefined {
  const normalized = email.trim().toLowerCase();
  return normalized ? normalized : undefined;
}
