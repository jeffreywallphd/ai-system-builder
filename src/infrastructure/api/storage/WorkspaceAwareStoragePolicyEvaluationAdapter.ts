import type {
  IStoragePolicyEvaluationPort,
  StorageAccessibleInstanceResolutionRequest,
  StoragePolicyDecision,
  StoragePolicyEvaluationRequest,
} from "@application/storage/ports/StoragePolicyEvaluationPort";
import { StoragePolicyActions } from "@application/storage/ports/StoragePolicyEvaluationPort";
import { StorageAccessScopes } from "@domain/storage/StorageDomain";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";

export interface WorkspaceAwareStoragePolicyEvaluationAdapterDependencies {
  readonly workspaceAuthorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock?: {
    now(): Date;
  };
}

const ManagementActions = new Set<string>([
  StoragePolicyActions.create,
  StoragePolicyActions.updateMetadata,
  StoragePolicyActions.provision,
  StoragePolicyActions.activate,
  StoragePolicyActions.deactivate,
]);

const ReadActions = new Set<string>([
  StoragePolicyActions.view,
  StoragePolicyActions.getDetails,
  StoragePolicyActions.listAccessible,
]);

const AssetUsageActions = new Set<string>([
  StoragePolicyActions.useForAssets,
]);

export class WorkspaceAwareStoragePolicyEvaluationAdapter implements IStoragePolicyEvaluationPort {
  private readonly clock: { now(): Date };

  public constructor(
    private readonly dependencies: WorkspaceAwareStoragePolicyEvaluationAdapterDependencies,
  ) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async evaluateStorageAction(input: StoragePolicyEvaluationRequest): Promise<StoragePolicyDecision> {
    const occurredAt = this.resolveOccurredAt(input.occurredAt);
    const actorUserIdentityId = input.actorUserIdentityId.trim();
    const workspaceId = input.workspaceId.trim();
    if (!actorUserIdentityId || !workspaceId) {
      return this.denied("storage-invalid-policy-input", occurredAt, "Storage policy request is missing actor or workspace.");
    }

    const snapshot = await this.dependencies.workspaceAuthorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: occurredAt,
    });
    if (!snapshot) {
      return this.denied(
        "workspace-membership-required",
        occurredAt,
        `Storage action '${input.action}' requires active workspace membership.`,
      );
    }

    const workspaceMembershipActive = snapshot.isWorkspaceOwner || snapshot.membership?.status === WorkspaceMembershipStatuses.active;
    if (!workspaceMembershipActive) {
      return this.denied(
        "workspace-membership-inactive",
        occurredAt,
        `Storage action '${input.action}' requires active workspace membership.`,
      );
    }

    const hasAdministrativeRole = snapshot.isWorkspaceOwner
      || snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);

    if (input.storageInstance) {
      if (input.storageInstance.ownership.workspaceId !== workspaceId) {
        return this.denied(
          "storage-workspace-mismatch",
          occurredAt,
          "Storage instance does not belong to the requested workspace.",
        );
      }

      if (
        input.storageInstance.access.scope === StorageAccessScopes.workspace
        && input.storageInstance.ownership.ownerUserIdentityId !== actorUserIdentityId
        && !hasAdministrativeRole
      ) {
        return this.denied(
          "storage-scope-owner-required",
          occurredAt,
          "Storage instance access scope requires owner or workspace administrator.",
        );
      }
    }

    if (ManagementActions.has(input.action) && !hasAdministrativeRole) {
      return this.denied(
        "workspace-admin-required",
        occurredAt,
        `Storage action '${input.action}' requires workspace admin privileges.`,
      );
    }

    if (ReadActions.has(input.action) || ManagementActions.has(input.action) || AssetUsageActions.has(input.action)) {
      return this.allowed("workspace-policy-allowed", occurredAt);
    }

    return this.denied("storage-action-unsupported", occurredAt, `Storage action '${input.action}' is unsupported.`);
  }

  public async resolveAccessibleStorageInstanceIds(
    input: StorageAccessibleInstanceResolutionRequest,
  ): Promise<ReadonlyArray<string>> {
    if (input.candidateStorageInstanceIds.length === 0) {
      return Object.freeze([]);
    }

    const listDecision = await this.evaluateStorageAction({
      action: StoragePolicyActions.listAccessible,
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      occurredAt: input.occurredAt,
    });
    if (!listDecision.allowed) {
      return Object.freeze([]);
    }

    return Object.freeze([...input.candidateStorageInstanceIds]);
  }

  private resolveOccurredAt(occurredAt?: string): string {
    const normalized = occurredAt?.trim();
    if (!normalized) {
      return this.clock.now().toISOString();
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return this.clock.now().toISOString();
    }
    return parsed.toISOString();
  }

  private allowed(reasonCode: string, occurredAt: string): StoragePolicyDecision {
    return Object.freeze({
      allowed: true,
      reasonCode,
      occurredAt,
    });
  }

  private denied(reasonCode: string, occurredAt: string, message: string): StoragePolicyDecision {
    return Object.freeze({
      allowed: false,
      reasonCode,
      message,
      occurredAt,
    });
  }
}

