import { describe, expect, it } from "bun:test";
import {
  WorkspaceInvitationStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
  createWorkspaceInvitation,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type WorkspaceMembershipStatus,
} from "@domain/workspaces/WorkspaceDomain";
import {
  WorkspaceInvitationLifecycleErrorCodes,
  type ResolveWorkspaceInvitationLifecycleUseCaseOutcome,
} from "../use-cases/ResolveWorkspaceInvitationLifecycleUseCase";
import {
  ResolveAuthenticatedWorkspaceOnboardingUseCase,
  WorkspaceAuthenticatedOnboardingErrorCodes,
  type AuthenticatedWorkspaceOnboardingClock,
  type AuthenticatedWorkspaceOnboardingMembershipPolicy,
  type AuthenticatedWorkspaceOnboardingSessionContext,
  type AuthenticatedWorkspaceOnboardingSessionVerifier,
} from "../use-cases/ResolveAuthenticatedWorkspaceOnboardingUseCase";

class FixedOnboardingClock implements AuthenticatedWorkspaceOnboardingClock {
  public constructor(private readonly nowIso: string) {}

  public now(): Date {
    return new Date(this.nowIso);
  }
}

class RecordingInvitationLifecycleUseCase {
  public lastInput:
    | {
      readonly action: "accept";
      readonly workspaceId: string;
      readonly actorUserIdentityId: string;
      readonly actorEmail: string;
      readonly invitationToken: string;
      readonly acceptedMembershipStatus?: WorkspaceMembershipStatus;
      readonly resolvedOnboardingMetadata?: Readonly<Record<string, unknown>>;
    }
    | undefined;

  public constructor(
    private readonly outcome:
      | ResolveWorkspaceInvitationLifecycleUseCaseOutcome
      | ((input: NonNullable<RecordingInvitationLifecycleUseCase["lastInput"]>) => ResolveWorkspaceInvitationLifecycleUseCaseOutcome),
  ) {}

  public async execute(
    input: {
      readonly action: "accept";
      readonly workspaceId: string;
      readonly actorUserIdentityId: string;
      readonly actorEmail: string;
      readonly invitationToken: string;
      readonly acceptedMembershipStatus?: WorkspaceMembershipStatus;
      readonly resolvedOnboardingMetadata?: Readonly<Record<string, unknown>>;
    },
  ) {
    this.lastInput = input as NonNullable<RecordingInvitationLifecycleUseCase["lastInput"]>;
    return typeof this.outcome === "function"
      ? this.outcome(this.lastInput)
      : this.outcome;
  }
}

class PendingMembershipPolicy implements AuthenticatedWorkspaceOnboardingMembershipPolicy {
  public async resolveAcceptedMembershipStatus(): Promise<WorkspaceMembershipStatus> {
    return WorkspaceMembershipStatuses.pending;
  }
}

class RejectingSessionVerifier implements AuthenticatedWorkspaceOnboardingSessionVerifier {
  public async assertAuthenticatedSession(): Promise<void> {
    throw new Error("Session trust posture is insufficient for onboarding.");
  }
}

function createSessionContext(): AuthenticatedWorkspaceOnboardingSessionContext {
  return Object.freeze({
    sessionId: "session:abc123",
    userIdentityId: "user:member",
    email: "member@example.com",
    assuranceLevel: "aal2",
    trustedDeviceId: "trusted-device:1",
    externalIdentityProvider: "oidc-acme",
    metadata: {
      channel: "desktop",
    },
  });
}

describe("ResolveAuthenticatedWorkspaceOnboardingUseCase", () => {
  it("resolves authenticated join using policy-driven pending membership posture", async () => {
    const lifecycle = new RecordingInvitationLifecycleUseCase({
      ok: true,
      value: Object.freeze({
        invitation: createWorkspaceInvitation({
          id: "invite:1",
          workspaceId: "workspace:alpha",
          invitedEmail: "member@example.com",
          invitedByUserId: "user:owner",
          invitedRoles: [WorkspaceRoles.member],
          status: WorkspaceInvitationStatuses.accepted,
          createdAt: "2026-04-05T11:00:00.000Z",
          expiresAt: "2026-04-06T11:00:00.000Z",
          respondedAt: "2026-04-05T12:00:00.000Z",
          acceptedByUserIdentityId: "user:member",
          lastModifiedBy: "user:member",
          lastModifiedAt: "2026-04-05T12:00:00.000Z",
        }),
        membership: createWorkspaceMembership({
          id: "membership:1",
          workspaceId: "workspace:alpha",
          userIdentityId: "user:member",
          status: WorkspaceMembershipStatuses.pending,
          invitationId: "invite:1",
          invitedByUserId: "user:owner",
          createdBy: "user:member",
          now: new Date("2026-04-05T12:00:00.000Z"),
        }),
        createdRoleAssignments: Object.freeze([
          createWorkspaceRoleAssignment({
            id: "role:1",
            workspaceId: "workspace:alpha",
            userIdentityId: "user:member",
            role: WorkspaceRoles.member,
            assignedBy: "user:member",
            assignedAt: "2026-04-05T12:00:00.000Z",
          }),
        ]),
        changed: true,
      }),
    });

    const useCase = new ResolveAuthenticatedWorkspaceOnboardingUseCase({
      invitationLifecycleUseCase: lifecycle,
      membershipPolicy: new PendingMembershipPolicy(),
      clock: new FixedOnboardingClock("2026-04-05T12:05:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace:alpha",
      invitationToken: "tok_join_123",
      session: createSessionContext(),
      onboardingMetadata: {
        source: "authenticated-join-route",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.resolvedMembershipStatus).toBe(WorkspaceMembershipStatuses.pending);
    expect(lifecycle.lastInput?.acceptedMembershipStatus).toBe(WorkspaceMembershipStatuses.pending);
    expect(lifecycle.lastInput?.actorEmail).toBe("member@example.com");
    const resolvedMetadata = lifecycle.lastInput?.resolvedOnboardingMetadata as
      | { readonly onboardingResolution?: Record<string, unknown> }
      | undefined;
    expect(resolvedMetadata?.onboardingResolution?.flow).toBe("authenticated-join");
    expect(resolvedMetadata?.onboardingResolution?.sessionId).toBe("session:abc123");
    expect(resolvedMetadata?.onboardingResolution?.acceptedMembershipStatus).toBe(WorkspaceMembershipStatuses.pending);
  });

  it("rejects onboarding when session verification fails", async () => {
    const lifecycle = new RecordingInvitationLifecycleUseCase({
      ok: true,
      value: Object.freeze({
        invitation: createWorkspaceInvitation({
          id: "invite:1",
          workspaceId: "workspace:alpha",
          invitedEmail: "member@example.com",
          invitedByUserId: "user:owner",
          invitedRoles: [WorkspaceRoles.member],
          status: WorkspaceInvitationStatuses.accepted,
          createdAt: "2026-04-05T11:00:00.000Z",
          expiresAt: "2026-04-06T11:00:00.000Z",
          respondedAt: "2026-04-05T12:00:00.000Z",
          acceptedByUserIdentityId: "user:member",
          lastModifiedBy: "user:member",
          lastModifiedAt: "2026-04-05T12:00:00.000Z",
        }),
        membership: undefined,
        createdRoleAssignments: Object.freeze([]),
        changed: true,
      }),
    });

    const useCase = new ResolveAuthenticatedWorkspaceOnboardingUseCase({
      invitationLifecycleUseCase: lifecycle,
      sessionVerifier: new RejectingSessionVerifier(),
      clock: new FixedOnboardingClock("2026-04-05T12:05:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace:alpha",
      invitationToken: "tok_join_123",
      session: createSessionContext(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(WorkspaceAuthenticatedOnboardingErrorCodes.forbidden);
    }
    expect(lifecycle.lastInput).toBeUndefined();
  });

  it("maps invalid invitation token failures to invalidInvite outcome", async () => {
    const lifecycle = new RecordingInvitationLifecycleUseCase({
      ok: false,
      error: Object.freeze({
        code: WorkspaceInvitationLifecycleErrorCodes.invalidToken,
        message: "Invitation token is invalid, expired, or already used.",
      }),
    });

    const useCase = new ResolveAuthenticatedWorkspaceOnboardingUseCase({
      invitationLifecycleUseCase: lifecycle,
      clock: new FixedOnboardingClock("2026-04-05T12:05:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace:alpha",
      invitationToken: "tok_invalid_123",
      session: createSessionContext(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(WorkspaceAuthenticatedOnboardingErrorCodes.invalidInvite);
    }
  });
});

