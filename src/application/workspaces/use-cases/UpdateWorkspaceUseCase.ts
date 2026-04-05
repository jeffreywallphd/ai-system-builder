import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import {
  WorkspaceDomainError,
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
  updateWorkspaceDetails,
  type Workspace,
} from "../../../domain/workspaces/WorkspaceDomain";
import type { WorkspaceVisibility } from "../../../shared/workspaces/WorkspaceOwnership";

export const WorkspaceUpdateErrorCodes = Object.freeze({
  invalidRequest: "workspace-update-invalid-request",
  forbidden: "workspace-update-forbidden",
  notFound: "workspace-update-not-found",
  invalidState: "workspace-update-invalid-state",
});

export type WorkspaceUpdateErrorCode =
  typeof WorkspaceUpdateErrorCodes[keyof typeof WorkspaceUpdateErrorCodes];

export interface WorkspaceUpdateError {
  readonly code: WorkspaceUpdateErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface UpdateWorkspaceUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly visibility?: WorkspaceVisibility;
}

export interface UpdateWorkspaceUseCaseResult {
  readonly workspace: Workspace;
  readonly changed: boolean;
}

export type UpdateWorkspaceUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: UpdateWorkspaceUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceUpdateError;
  };

export interface WorkspaceUpdateClock {
  now(): Date;
}

interface UpdateWorkspaceUseCaseDependencies {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock: WorkspaceUpdateClock;
}

export class UpdateWorkspaceUseCase {
  public constructor(private readonly dependencies: UpdateWorkspaceUseCaseDependencies) {}

  public async execute(input: UpdateWorkspaceUseCaseInput): Promise<UpdateWorkspaceUseCaseOutcome> {
    const workspaceId = this.normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceUpdateErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = this.normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(WorkspaceUpdateErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    if (
      input.displayName === undefined
      && input.description === undefined
      && input.visibility === undefined
    ) {
      return this.failure(
        WorkspaceUpdateErrorCodes.invalidRequest,
        "At least one mutable workspace field is required.",
      );
    }

    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: this.dependencies.clock.now().toISOString(),
    });

    if (!snapshot) {
      return this.failure(
        WorkspaceUpdateErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceUpdateErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    const canAdministrate = snapshot.effectiveRoles.includes(WorkspaceRoles.owner)
      || snapshot.effectiveRoles.includes(WorkspaceRoles.admin);
    if (!canAdministrate) {
      return this.failure(
        WorkspaceUpdateErrorCodes.forbidden,
        "Actor must have owner or admin role to update workspace metadata.",
      );
    }

    let updated: Workspace;
    try {
      updated = updateWorkspaceDetails(snapshot.workspace, {
        displayName: input.displayName,
        description: input.description,
        visibility: input.visibility,
        actorUserId: actorUserIdentityId,
        now: this.dependencies.clock.now(),
      });
    } catch (error) {
      return this.failure(
        WorkspaceUpdateErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Workspace update input is invalid.",
      );
    }

    try {
      await this.dependencies.workspaceRepository.saveWorkspace(updated);
    } catch (error) {
      return this.failure(
        WorkspaceUpdateErrorCodes.invalidState,
        `Workspace update failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        workspace: updated,
        changed: true,
      }),
    };
  }

  private normalizeRequired(value: string): string | undefined {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }
    return normalized;
  }

  private failure(
    code: WorkspaceUpdateErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): UpdateWorkspaceUseCaseOutcome {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}
