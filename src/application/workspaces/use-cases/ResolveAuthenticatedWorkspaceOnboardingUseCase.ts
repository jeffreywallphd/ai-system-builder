import {
  WorkspaceMembershipStatuses,
  type WorkspaceInvitation,
  type WorkspaceMembership,
  type WorkspaceMembershipStatus,
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";
import {
  WorkspaceInvitationLifecycleActions,
  WorkspaceInvitationLifecycleErrorCodes,
  type ResolveWorkspaceInvitationLifecycleUseCaseOutcome,
} from "./ResolveWorkspaceInvitationLifecycleUseCase";
import type { ResolveWorkspaceInvitationLifecycleUseCase } from "./ResolveWorkspaceInvitationLifecycleUseCase";

export const WorkspaceAuthenticatedOnboardingErrorCodes = Object.freeze({
  invalidRequest: "workspace-authenticated-onboarding-invalid-request",
  forbidden: "workspace-authenticated-onboarding-forbidden",
  notFound: "workspace-authenticated-onboarding-not-found",
  conflict: "workspace-authenticated-onboarding-conflict",
  invalidInvite: "workspace-authenticated-onboarding-invalid-invite",
  invalidState: "workspace-authenticated-onboarding-invalid-state",
});

export type WorkspaceAuthenticatedOnboardingErrorCode =
  typeof WorkspaceAuthenticatedOnboardingErrorCodes[keyof typeof WorkspaceAuthenticatedOnboardingErrorCodes];

export interface WorkspaceAuthenticatedOnboardingError {
  readonly code: WorkspaceAuthenticatedOnboardingErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AuthenticatedWorkspaceOnboardingSessionContext {
  readonly sessionId: string;
  readonly userIdentityId: string;
  readonly email: string;
  readonly assuranceLevel?: string;
  readonly trustedDeviceId?: string;
  readonly externalIdentityProvider?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ResolveAuthenticatedWorkspaceOnboardingUseCaseInput {
  readonly workspaceId: string;
  readonly invitationToken: string;
  readonly session: AuthenticatedWorkspaceOnboardingSessionContext;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
}

export interface ResolveAuthenticatedWorkspaceOnboardingUseCaseResult {
  readonly invitation: WorkspaceInvitation;
  readonly membership?: WorkspaceMembership;
  readonly createdRoleAssignments: ReadonlyArray<WorkspaceRoleAssignment>;
  readonly resolvedMembershipStatus: WorkspaceMembershipStatus;
}

export type ResolveAuthenticatedWorkspaceOnboardingUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: ResolveAuthenticatedWorkspaceOnboardingUseCaseResult;
  }
  | {
    readonly ok: false;
    readonly error: WorkspaceAuthenticatedOnboardingError;
  };

type WorkspaceInvitationLifecycleFailureOutcome = Extract<
  ResolveWorkspaceInvitationLifecycleUseCaseOutcome,
  { readonly ok: false }
>;

export interface AuthenticatedWorkspaceOnboardingClock {
  now(): Date;
}

export interface AuthenticatedWorkspaceOnboardingSessionVerifier {
  assertAuthenticatedSession(input: {
    readonly workspaceId: string;
    readonly session: AuthenticatedWorkspaceOnboardingSessionContext;
    readonly now: Date;
  }): Promise<void>;
}

export interface AuthenticatedWorkspaceOnboardingMembershipPolicy {
  resolveAcceptedMembershipStatus(input: {
    readonly workspaceId: string;
    readonly session: AuthenticatedWorkspaceOnboardingSessionContext;
    readonly now: Date;
  }): Promise<WorkspaceMembershipStatus>;
}

class DefaultAuthenticatedWorkspaceOnboardingMembershipPolicy
  implements AuthenticatedWorkspaceOnboardingMembershipPolicy {
  public async resolveAcceptedMembershipStatus(): Promise<WorkspaceMembershipStatus> {
    return WorkspaceMembershipStatuses.active;
  }
}

interface ResolveAuthenticatedWorkspaceOnboardingUseCaseDependencies {
  readonly invitationLifecycleUseCase: Pick<ResolveWorkspaceInvitationLifecycleUseCase, "execute">;
  readonly clock: AuthenticatedWorkspaceOnboardingClock;
  readonly sessionVerifier?: AuthenticatedWorkspaceOnboardingSessionVerifier;
  readonly membershipPolicy?: AuthenticatedWorkspaceOnboardingMembershipPolicy;
}

export class ResolveAuthenticatedWorkspaceOnboardingUseCase {
  private readonly membershipPolicy: AuthenticatedWorkspaceOnboardingMembershipPolicy;

  public constructor(private readonly dependencies: ResolveAuthenticatedWorkspaceOnboardingUseCaseDependencies) {
    this.membershipPolicy = dependencies.membershipPolicy ?? new DefaultAuthenticatedWorkspaceOnboardingMembershipPolicy();
  }

  public async execute(
    input: ResolveAuthenticatedWorkspaceOnboardingUseCaseInput,
  ): Promise<ResolveAuthenticatedWorkspaceOnboardingUseCaseOutcome> {
    const workspaceId = normalizeRequired(input.workspaceId);
    if (!workspaceId) {
      return this.failure(WorkspaceAuthenticatedOnboardingErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const invitationToken = normalizeRequired(input.invitationToken);
    if (!invitationToken) {
      return this.failure(WorkspaceAuthenticatedOnboardingErrorCodes.invalidRequest, "invitationToken is required.");
    }

    const sessionId = normalizeRequired(input.session.sessionId);
    if (!sessionId) {
      return this.failure(WorkspaceAuthenticatedOnboardingErrorCodes.invalidRequest, "session.sessionId is required.");
    }

    const userIdentityId = normalizeRequired(input.session.userIdentityId);
    if (!userIdentityId) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.invalidRequest,
        "session.userIdentityId is required.",
      );
    }

    const actorEmail = normalizeEmail(input.session.email);
    if (!actorEmail) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.invalidRequest,
        "session.email must be a valid email address.",
      );
    }

    const now = this.dependencies.clock.now();
    if (this.dependencies.sessionVerifier) {
      try {
        await this.dependencies.sessionVerifier.assertAuthenticatedSession({
          workspaceId,
          session: input.session,
          now,
        });
      } catch (error) {
        return this.failure(
          WorkspaceAuthenticatedOnboardingErrorCodes.forbidden,
          error instanceof Error ? error.message : "Session context failed onboarding policy validation.",
        );
      }
    }

    let acceptedMembershipStatus: WorkspaceMembershipStatus;
    try {
      acceptedMembershipStatus = await this.membershipPolicy.resolveAcceptedMembershipStatus({
        workspaceId,
        session: input.session,
        now,
      });
    } catch (error) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.invalidState,
        error instanceof Error ? error.message : "Membership policy could not resolve onboarding posture.",
      );
    }

    if (
      acceptedMembershipStatus !== WorkspaceMembershipStatuses.active
      && acceptedMembershipStatus !== WorkspaceMembershipStatuses.pending
    ) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.invalidState,
        "Membership policy resolved an unsupported onboarding membership status.",
        {
          acceptedMembershipStatus,
        },
      );
    }

    const resolutionMetadata = buildResolvedOnboardingMetadata({
      nowIso: now.toISOString(),
      session: input.session,
      acceptedMembershipStatus,
      onboardingMetadata: input.onboardingMetadata,
    });

    const resolved = await this.dependencies.invitationLifecycleUseCase.execute({
      action: WorkspaceInvitationLifecycleActions.accept,
      workspaceId,
      actorUserIdentityId: userIdentityId,
      actorEmail,
      invitationToken,
      acceptedMembershipStatus,
      resolvedOnboardingMetadata: resolutionMetadata,
    });
    if (!resolved.ok) {
      return this.mapLifecycleFailure(resolved);
    }

    return {
      ok: true,
      value: Object.freeze({
        invitation: resolved.value.invitation,
        membership: resolved.value.membership,
        createdRoleAssignments: resolved.value.createdRoleAssignments,
        resolvedMembershipStatus: acceptedMembershipStatus,
      }),
    };
  }

  private mapLifecycleFailure(
    outcome: WorkspaceInvitationLifecycleFailureOutcome,
  ): ResolveAuthenticatedWorkspaceOnboardingUseCaseOutcome {
    if (outcome.error.code === WorkspaceInvitationLifecycleErrorCodes.invalidToken) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.invalidInvite,
        "Invitation is invalid, expired, or already used.",
      );
    }
    if (outcome.error.code === WorkspaceInvitationLifecycleErrorCodes.forbidden) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.forbidden,
        outcome.error.message,
        outcome.error.details,
      );
    }
    if (outcome.error.code === WorkspaceInvitationLifecycleErrorCodes.notFound) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.notFound,
        outcome.error.message,
        outcome.error.details,
      );
    }
    if (outcome.error.code === WorkspaceInvitationLifecycleErrorCodes.conflict) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.conflict,
        outcome.error.message,
        outcome.error.details,
      );
    }
    if (outcome.error.code === WorkspaceInvitationLifecycleErrorCodes.invalidRequest) {
      return this.failure(
        WorkspaceAuthenticatedOnboardingErrorCodes.invalidRequest,
        outcome.error.message,
        outcome.error.details,
      );
    }

    return this.failure(
      WorkspaceAuthenticatedOnboardingErrorCodes.invalidState,
      outcome.error.message,
      outcome.error.details,
    );
  }

  private failure(
    code: WorkspaceAuthenticatedOnboardingErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ResolveAuthenticatedWorkspaceOnboardingUseCaseOutcome {
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

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeEmail(value: string): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeMetadata(
  value?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  if (!value || Object.keys(value).length === 0) {
    return undefined;
  }
  return Object.freeze({ ...value });
}

function buildResolvedOnboardingMetadata(input: {
  readonly nowIso: string;
  readonly session: AuthenticatedWorkspaceOnboardingSessionContext;
  readonly acceptedMembershipStatus: WorkspaceMembershipStatus;
  readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  const sessionMetadata = normalizeMetadata(input.session.metadata);
  const onboardingMetadata = normalizeMetadata(input.onboardingMetadata);

  return Object.freeze({
    onboardingResolution: Object.freeze({
      flow: "authenticated-join",
      completedAt: input.nowIso,
      sessionId: input.session.sessionId,
      userIdentityId: input.session.userIdentityId,
      email: input.session.email.trim().toLowerCase(),
      acceptedMembershipStatus: input.acceptedMembershipStatus,
      assuranceLevel: normalizeOptional(input.session.assuranceLevel),
      trustedDeviceId: normalizeOptional(input.session.trustedDeviceId),
      externalIdentityProvider: normalizeOptional(input.session.externalIdentityProvider),
      sessionMetadata,
      inputMetadata: onboardingMetadata,
    }),
  });
}
