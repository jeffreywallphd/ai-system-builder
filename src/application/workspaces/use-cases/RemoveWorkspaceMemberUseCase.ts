import {
  ChangeWorkspaceMembershipStatusUseCase,
  WorkspaceMembershipStatusChangeErrorCodes,
  type ChangeWorkspaceMembershipStatusUseCaseOutcome,
  type WorkspaceMembershipStatusChangeClock,
} from "./ChangeWorkspaceMembershipStatusUseCase";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { IWorkspaceTransactionManager } from "../ports/IWorkspaceTransactionManager";
import { WorkspaceMembershipStatuses, type WorkspaceMembership } from "@domain/workspaces/WorkspaceDomain";
import type { WorkspaceAdministrationAuditSink } from "./WorkspaceAdministrationAudit";

export const WorkspaceMembershipRemovalErrorCodes = Object.freeze({
  invalidRequest: "workspace-membership-remove-invalid-request",
  forbidden: "workspace-membership-remove-forbidden",
  notFound: "workspace-membership-remove-not-found",
  conflict: "workspace-membership-remove-conflict",
  invalidState: "workspace-membership-remove-invalid-state",
});

export type WorkspaceMembershipRemovalErrorCode =
  typeof WorkspaceMembershipRemovalErrorCodes[keyof typeof WorkspaceMembershipRemovalErrorCodes];

export interface WorkspaceMembershipRemovalError {
  readonly code: WorkspaceMembershipRemovalErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface RemoveWorkspaceMemberUseCaseInput {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetUserIdentityId: string;
}

export interface RemoveWorkspaceMemberUseCaseResult {
  readonly membership: WorkspaceMembership;
  readonly changed: boolean;
  readonly revokedRoleAssignmentIds: ReadonlyArray<string>;
}

export type RemoveWorkspaceMemberUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: RemoveWorkspaceMemberUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceMembershipRemovalError;
  };

interface RemoveWorkspaceMemberUseCaseDependencies {
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly transactionManager?: IWorkspaceTransactionManager;
  readonly clock: WorkspaceMembershipStatusChangeClock;
  readonly auditSink?: WorkspaceAdministrationAuditSink;
}

export class RemoveWorkspaceMemberUseCase {
  private readonly changeStatusUseCase: ChangeWorkspaceMembershipStatusUseCase;

  public constructor(dependencies: RemoveWorkspaceMemberUseCaseDependencies) {
    this.changeStatusUseCase = new ChangeWorkspaceMembershipStatusUseCase({
      membershipRepository: dependencies.membershipRepository,
      roleAssignmentRepository: dependencies.roleAssignmentRepository,
      authorizationReadRepository: dependencies.authorizationReadRepository,
      transactionManager: dependencies.transactionManager,
      clock: dependencies.clock,
      auditSink: dependencies.auditSink,
    });
  }

  public async execute(input: RemoveWorkspaceMemberUseCaseInput): Promise<RemoveWorkspaceMemberUseCaseOutcome> {
    const outcome = await this.changeStatusUseCase.execute({
      workspaceId: input.workspaceId,
      actorUserIdentityId: input.actorUserIdentityId,
      targetUserIdentityId: input.targetUserIdentityId,
      status: WorkspaceMembershipStatuses.removed,
      mutationKind: "remove",
    });

    if (outcome.ok) {
      return {
        ok: true,
        value: Object.freeze({
          membership: outcome.value.membership,
          changed: outcome.value.changed,
          revokedRoleAssignmentIds: outcome.value.revokedRoleAssignmentIds,
        }),
      };
    }

    return this.failureFromStatusOutcome(outcome);
  }

  private failureFromStatusOutcome(
    outcome: ChangeWorkspaceMembershipStatusUseCaseOutcome,
  ): RemoveWorkspaceMemberUseCaseOutcome {
    if (outcome.ok) {
      throw new Error("Expected failed status outcome.");
    }

    const mappedCode = this.mapErrorCode(outcome.error.code);
    return {
      ok: false,
      error: Object.freeze({
        code: mappedCode,
        message: outcome.error.message,
        details: outcome.error.details,
      }),
    };
  }

  private mapErrorCode(code: string): WorkspaceMembershipRemovalErrorCode {
    if (code === WorkspaceMembershipStatusChangeErrorCodes.invalidRequest) {
      return WorkspaceMembershipRemovalErrorCodes.invalidRequest;
    }
    if (code === WorkspaceMembershipStatusChangeErrorCodes.forbidden) {
      return WorkspaceMembershipRemovalErrorCodes.forbidden;
    }
    if (code === WorkspaceMembershipStatusChangeErrorCodes.notFound) {
      return WorkspaceMembershipRemovalErrorCodes.notFound;
    }
    if (code === WorkspaceMembershipStatusChangeErrorCodes.conflict) {
      return WorkspaceMembershipRemovalErrorCodes.conflict;
    }
    return WorkspaceMembershipRemovalErrorCodes.invalidState;
  }
}

