import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import {
  WorkspaceDomainError,
  WorkspaceLifecycleTransitionError,
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  transitionWorkspaceStatus,
  type Workspace,
  type WorkspaceStatus,
} from "../../../domain/workspaces/WorkspaceDomain";

export const WorkspaceLifecycleActions = Object.freeze({
  archive: "archive",
  reactivate: "reactivate",
  suspend: "suspend",
  activate: "activate",
});

export type WorkspaceLifecycleAction =
  typeof WorkspaceLifecycleActions[keyof typeof WorkspaceLifecycleActions];

export const WorkspaceLifecycleTransitionErrorCodes = Object.freeze({
  invalidRequest: "workspace-lifecycle-invalid-request",
  forbidden: "workspace-lifecycle-forbidden",
  notFound: "workspace-lifecycle-not-found",
  invalidTransition: "workspace-lifecycle-invalid-transition",
  invalidState: "workspace-lifecycle-invalid-state",
});

export type WorkspaceLifecycleTransitionErrorCode =
  typeof WorkspaceLifecycleTransitionErrorCodes[keyof typeof WorkspaceLifecycleTransitionErrorCodes];

export interface WorkspaceLifecycleTransitionErrorDetail {
  readonly code: WorkspaceLifecycleTransitionErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface TransitionWorkspaceLifecycleUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly action: WorkspaceLifecycleAction;
}

export interface TransitionWorkspaceLifecycleUseCaseResult {
  readonly workspace: Workspace;
  readonly changed: boolean;
}

export type TransitionWorkspaceLifecycleUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: TransitionWorkspaceLifecycleUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceLifecycleTransitionErrorDetail;
  };

export interface WorkspaceLifecycleTransitionClock {
  now(): Date;
}

interface TransitionWorkspaceLifecycleUseCaseDependencies {
  readonly workspaceRepository: IWorkspaceRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly clock: WorkspaceLifecycleTransitionClock;
}

export class TransitionWorkspaceLifecycleUseCase {
  public constructor(private readonly dependencies: TransitionWorkspaceLifecycleUseCaseDependencies) {}

  public async execute(
    input: TransitionWorkspaceLifecycleUseCaseInput,
  ): Promise<TransitionWorkspaceLifecycleUseCaseOutcome> {
    const workspaceId = this.normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(
        WorkspaceLifecycleTransitionErrorCodes.invalidRequest,
        "workspaceId is required.",
      );
    }

    const actorUserIdentityId = this.normalizeRequired(input.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(
        WorkspaceLifecycleTransitionErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const nextStatus = this.toTargetStatus(input.action);
    if (!nextStatus) {
      return this.failure(
        WorkspaceLifecycleTransitionErrorCodes.invalidRequest,
        `Unsupported workspace lifecycle action '${String(input.action)}'.`,
      );
    }

    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: this.dependencies.clock.now().toISOString(),
    });
    if (!snapshot) {
      return this.failure(
        WorkspaceLifecycleTransitionErrorCodes.notFound,
        `Workspace '${workspaceId}' was not found.`,
      );
    }

    if (snapshot.membership?.status !== WorkspaceMembershipStatuses.active) {
      return this.failure(
        WorkspaceLifecycleTransitionErrorCodes.forbidden,
        "Actor must have an active workspace membership.",
      );
    }

    if (!this.canTransitionLifecycle(input.action, snapshot.effectiveRoles)) {
      return this.failure(
        WorkspaceLifecycleTransitionErrorCodes.forbidden,
        `Actor is not allowed to '${input.action}' this workspace.`,
      );
    }

    let updated: Workspace;
    try {
      updated = transitionWorkspaceStatus(
        snapshot.workspace,
        nextStatus,
        actorUserIdentityId,
        this.dependencies.clock.now(),
      );
    } catch (error) {
      if (error instanceof WorkspaceLifecycleTransitionError) {
        return this.failure(
          WorkspaceLifecycleTransitionErrorCodes.invalidTransition,
          error.message,
        );
      }
      return this.failure(
        WorkspaceLifecycleTransitionErrorCodes.invalidRequest,
        error instanceof WorkspaceDomainError
          ? error.message
          : "Workspace lifecycle transition input is invalid.",
      );
    }

    if (updated === snapshot.workspace) {
      return {
        ok: true,
        value: Object.freeze({
          workspace: updated,
          changed: false,
        }),
      };
    }

    try {
      await this.dependencies.workspaceRepository.saveWorkspace(updated);
    } catch (error) {
      return this.failure(
        WorkspaceLifecycleTransitionErrorCodes.invalidState,
        `Workspace lifecycle transition failed: ${error instanceof Error ? error.message : "unknown persistence failure."}`,
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

  private toTargetStatus(action: WorkspaceLifecycleAction): WorkspaceStatus | undefined {
    if (action === WorkspaceLifecycleActions.archive) {
      return WorkspaceStatuses.archived;
    }
    if (action === WorkspaceLifecycleActions.reactivate) {
      return WorkspaceStatuses.active;
    }
    if (action === WorkspaceLifecycleActions.suspend) {
      return WorkspaceStatuses.suspended;
    }
    if (action === WorkspaceLifecycleActions.activate) {
      return WorkspaceStatuses.active;
    }
    return undefined;
  }

  private canTransitionLifecycle(
    action: WorkspaceLifecycleAction,
    effectiveRoles: ReadonlyArray<string>,
  ): boolean {
    const isOwner = effectiveRoles.includes(WorkspaceRoles.owner);
    const isAdmin = effectiveRoles.includes(WorkspaceRoles.admin);

    if (action === WorkspaceLifecycleActions.archive || action === WorkspaceLifecycleActions.reactivate) {
      return isOwner;
    }

    if (action === WorkspaceLifecycleActions.activate || action === WorkspaceLifecycleActions.suspend) {
      return isOwner || isAdmin;
    }

    return false;
  }

  private failure(
    code: WorkspaceLifecycleTransitionErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): TransitionWorkspaceLifecycleUseCaseOutcome {
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
