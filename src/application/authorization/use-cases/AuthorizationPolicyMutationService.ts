import type { AuthorizationPolicyMutationRecordedEvent } from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationPolicyEvaluationEventTypes } from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationPolicyEventRecorder } from "../ports/IAuthorizationPolicyEventRecorder";
import type {
  AuthorizationPersistenceMutationResult,
  AuthorizationResourcePolicyMetadataPersistenceRecord,
  AuthorizationRoleAssignmentPersistenceRecord,
  AuthorizationSharingGrantPersistenceRecord,
  RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  RevokeAuthorizationSharingGrantPersistenceRecordInput,
  SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  UpsertAuthorizationSharingGrantPersistenceRecordInput,
} from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import { redactAuthorizationAuditMetadata, redactAuthorizationAuditReason } from "./AuthorizationAuditRedaction";

export interface AuthorizationPolicyMutationServiceClock {
  now(): Date;
}

export interface AuthorizationPolicyMutationServiceDependencies {
  readonly ports: AuthorizationPolicyPersistencePorts;
  readonly policyEventRecorder?: IAuthorizationPolicyEventRecorder;
  readonly clock?: AuthorizationPolicyMutationServiceClock;
}

export class AuthorizationPolicyMutationService {
  private readonly clock: AuthorizationPolicyMutationServiceClock;

  public constructor(private readonly dependencies: AuthorizationPolicyMutationServiceDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async upsertRoleAssignment(
    input: UpsertAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    const result = await this.dependencies.ports.roleAssignmentPersistenceRepository.upsertRoleAssignment(input);
    await this.recordMutationEventBestEffort({
      type: AuthorizationPolicyEvaluationEventTypes.roleAssignmentUpserted,
      occurredAt: this.clock.now().toISOString(),
      correlationId: input.mutation.context.correlationId,
      actor: {
        actorUserIdentityId: input.mutation.context.actorUserIdentityId,
      },
      workspaceId: input.record.workspaceId,
      resource: {
        resourceFamily: input.record.resourceFamily,
        resourceType: input.record.resourceType,
        resourceId: input.record.resourceId,
      },
      mutation: {
        entityKind: "role-assignment",
        mutationKind: "upsert",
        operationKey: input.mutation.operationKey,
        expectedRevision: input.mutation.expectedRevision,
        changed: result.changed,
        wasReplay: result.wasReplay,
      },
      details: toMutationDetails(
        {
          targetUserIdentityId: input.record.actorUserIdentityId,
          roleKey: input.record.roleKey,
          scope: input.record.scope,
          status: result.record.status,
        },
        input.mutation.context.reason,
        input.mutation.context.metadata,
      ),
    });
    return result;
  }

  public async revokeRoleAssignment(
    input: RevokeAuthorizationRoleAssignmentPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> {
    const result = await this.dependencies.ports.roleAssignmentPersistenceRepository.revokeRoleAssignment(input);
    await this.recordMutationEventBestEffort({
      type: AuthorizationPolicyEvaluationEventTypes.roleAssignmentRevoked,
      occurredAt: this.clock.now().toISOString(),
      correlationId: input.mutation.context.correlationId,
      actor: {
        actorUserIdentityId: input.mutation.context.actorUserIdentityId,
      },
      workspaceId: result.record.workspaceId,
      resource: {
        resourceFamily: result.record.resourceFamily,
        resourceType: result.record.resourceType,
        resourceId: result.record.resourceId,
      },
      mutation: {
        entityKind: "role-assignment",
        mutationKind: "revoke",
        operationKey: input.mutation.operationKey,
        expectedRevision: input.mutation.expectedRevision,
        changed: result.changed,
        wasReplay: result.wasReplay,
      },
      details: toMutationDetails(
        {
          roleAssignmentId: input.roleAssignmentId,
          roleKey: result.record.roleKey,
          targetUserIdentityId: result.record.actorUserIdentityId,
          revokedByUserIdentityId: input.revokedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
        },
        input.mutation.context.reason,
        input.mutation.context.metadata,
      ),
    });
    return result;
  }

  public async upsertSharingGrant(
    input: UpsertAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    const result = await this.dependencies.ports.sharingGrantPersistenceRepository.upsertSharingGrant(input);
    await this.recordMutationEventBestEffort({
      type: AuthorizationPolicyEvaluationEventTypes.sharingGrantUpserted,
      occurredAt: this.clock.now().toISOString(),
      correlationId: input.mutation.context.correlationId,
      actor: {
        actorUserIdentityId: input.mutation.context.actorUserIdentityId,
      },
      workspaceId: input.record.workspaceId,
      resource: {
        resourceFamily: input.record.resourceFamily,
        resourceType: input.record.resourceType,
        resourceId: input.record.resourceId,
      },
      mutation: {
        entityKind: "sharing-grant",
        mutationKind: "upsert",
        operationKey: input.mutation.operationKey,
        expectedRevision: input.mutation.expectedRevision,
        changed: result.changed,
        wasReplay: result.wasReplay,
      },
      details: toMutationDetails(
        {
          sharingGrantId: input.record.id,
          subjectKind: input.record.subject.kind,
          permissionKeyCount: input.record.permissionKeys.length,
        },
        input.mutation.context.reason,
        input.mutation.context.metadata,
      ),
    });
    return result;
  }

  public async revokeSharingGrant(
    input: RevokeAuthorizationSharingGrantPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>> {
    const result = await this.dependencies.ports.sharingGrantPersistenceRepository.revokeSharingGrant(input);
    await this.recordMutationEventBestEffort({
      type: AuthorizationPolicyEvaluationEventTypes.sharingGrantRevoked,
      occurredAt: this.clock.now().toISOString(),
      correlationId: input.mutation.context.correlationId,
      actor: {
        actorUserIdentityId: input.mutation.context.actorUserIdentityId,
      },
      workspaceId: result.record.workspaceId,
      resource: {
        resourceFamily: result.record.resourceFamily,
        resourceType: result.record.resourceType,
        resourceId: result.record.resourceId,
      },
      mutation: {
        entityKind: "sharing-grant",
        mutationKind: "revoke",
        operationKey: input.mutation.operationKey,
        expectedRevision: input.mutation.expectedRevision,
        changed: result.changed,
        wasReplay: result.wasReplay,
      },
      details: toMutationDetails(
        {
          sharingGrantId: input.sharingGrantId,
          subjectKind: result.record.subject.kind,
          revokedByUserIdentityId: input.revokedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
        },
        input.mutation.context.reason,
        input.mutation.context.metadata,
      ),
    });
    return result;
  }

  public async upsertResourcePolicyMetadata(
    input: UpsertAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    const result = await this.dependencies.ports.resourcePolicyMetadataPersistenceRepository.upsertResourcePolicyMetadata(input);
    await this.recordMutationEventBestEffort({
      type: AuthorizationPolicyEvaluationEventTypes.resourcePolicyUpserted,
      occurredAt: this.clock.now().toISOString(),
      correlationId: input.mutation.context.correlationId,
      actor: {
        actorUserIdentityId: input.mutation.context.actorUserIdentityId,
      },
      workspaceId: input.record.workspaceId,
      resource: {
        resourceFamily: input.record.resourceFamily,
        resourceType: input.record.resourceType,
        resourceId: input.record.resourceId,
      },
      mutation: {
        entityKind: "resource-policy",
        mutationKind: "upsert",
        operationKey: input.mutation.operationKey,
        expectedRevision: input.mutation.expectedRevision,
        changed: result.changed,
        wasReplay: result.wasReplay,
      },
      details: toMutationDetails(
        {
          visibility: input.record.visibility,
          sharingPolicyMode: input.record.sharingPolicyMode,
          allowResharing: input.record.allowResharing,
          isPublishedCapable: input.record.isPublishedCapable,
        },
        input.mutation.context.reason,
        input.mutation.context.metadata,
      ),
    });
    return result;
  }

  public async softDeleteResourcePolicyMetadata(
    input: SoftDeleteAuthorizationResourcePolicyMetadataPersistenceRecordInput,
  ): Promise<AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>> {
    const result = await this.dependencies.ports.resourcePolicyMetadataPersistenceRepository.softDeleteResourcePolicyMetadata(input);
    await this.recordMutationEventBestEffort({
      type: AuthorizationPolicyEvaluationEventTypes.resourcePolicySoftDeleted,
      occurredAt: this.clock.now().toISOString(),
      correlationId: input.mutation.context.correlationId,
      actor: {
        actorUserIdentityId: input.mutation.context.actorUserIdentityId,
      },
      workspaceId: result.record.workspaceId,
      resource: {
        resourceFamily: input.resource.resourceFamily,
        resourceType: input.resource.resourceType,
        resourceId: input.resource.resourceId,
      },
      mutation: {
        entityKind: "resource-policy",
        mutationKind: "soft-delete",
        operationKey: input.mutation.operationKey,
        expectedRevision: input.mutation.expectedRevision,
        changed: result.changed,
        wasReplay: result.wasReplay,
      },
      details: toMutationDetails(
        {
          deletedByUserIdentityId: input.deletedByUserIdentityId ?? input.mutation.context.actorUserIdentityId,
        },
        input.mutation.context.reason,
        input.mutation.context.metadata,
      ),
    });
    return result;
  }

  private async recordMutationEventBestEffort(event: AuthorizationPolicyMutationRecordedEvent): Promise<void> {
    const recorder = this.dependencies.policyEventRecorder;
    if (!recorder) {
      return;
    }

    try {
      await recorder.recordPolicyEvaluationEvent(event);
    } catch {
      // Intentionally best-effort to avoid impacting mutation behavior.
    }
  }
}

function toMutationDetails(
  baseDetails: Readonly<Record<string, unknown>>,
  reason?: string,
  metadata?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  const redactedReason = redactAuthorizationAuditReason(reason);
  const redactedMetadata = redactAuthorizationAuditMetadata(metadata);
  const details: Record<string, unknown> = {
    ...baseDetails,
  };

  if (redactedReason) {
    details.reason = redactedReason;
  }
  if (redactedMetadata) {
    details.metadata = redactedMetadata;
  }

  return Object.freeze(details);
}

