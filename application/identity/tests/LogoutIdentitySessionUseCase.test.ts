import { describe, expect, it } from "bun:test";
import { IdentityLifecycleEventTypes, type IdentityLifecycleEvent } from "../../contracts/IdentityLifecycleEventContracts";
import { IdentityErrorCodes, identityFailure, identitySuccess } from "../../contracts/IdentityApplicationContracts";
import { LogoutIdentitySessionUseCase } from "../../../src/application/identity/use-cases/LogoutIdentitySessionUseCase";

describe("LogoutIdentitySessionUseCase", () => {
  it("revokes the current session token with logout reason", async () => {
    const events: IdentityLifecycleEvent[] = [];
    const useCase = new LogoutIdentitySessionUseCase({
      authenticatedSessionService: {
        invalidateAuthenticatedSession: async () => identitySuccess(Object.freeze({
          session: Object.freeze({
            id: "identity-session:1",
            userIdentityId: "user-identity:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            status: "revoked",
            issuedAt: "2026-04-04T18:00:00.000Z",
            expiresAt: "2026-04-05T18:00:00.000Z",
            revocation: Object.freeze({
              reason: "logout",
              revokedAt: "2026-04-04T18:10:00.000Z",
            }),
          }),
        })),
      },
      eventPublisher: {
        publish: async (event) => {
          events.push(event);
        },
      },
    });

    const result = await useCase.execute({
      sessionToken: "session-token-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected logout use case success.");
    }
    expect(result.value.sessionId).toBe("identity-session:1");
    expect(result.value.userIdentityId).toBe("user-identity:1");
    expect(result.value.revocationReason).toBe("logout");
    expect(result.value.revokedAt).toBe("2026-04-04T18:10:00.000Z");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      eventType: IdentityLifecycleEventTypes.sessionLoggedOut,
      payload: expect.objectContaining({
        sessionId: "identity-session:1",
        userIdentityId: "user-identity:1",
        revocationReason: "logout",
      }),
    }));
  });

  it("fails when session token is missing", async () => {
    const useCase = new LogoutIdentitySessionUseCase({
      authenticatedSessionService: {
        invalidateAuthenticatedSession: async () => {
          throw new Error("Should not be called");
        },
      },
    });

    const result = await useCase.execute({
      sessionToken: "  ",
    });

    expect(result.ok).toBeFalse();
    expect(result.error.code).toBe(IdentityErrorCodes.invalidRequest);
  });

  it("propagates invalid session state from session invalidation", async () => {
    const useCase = new LogoutIdentitySessionUseCase({
      authenticatedSessionService: {
        invalidateAuthenticatedSession: async () => identityFailure({
          code: IdentityErrorCodes.invalidSessionState,
          message: "Session is not active.",
          boundary: "application",
          retryable: false,
        }),
      },
    });

    const result = await useCase.execute({
      sessionToken: "session-token-1",
    });

    expect(result.ok).toBeFalse();
    expect(result.error.code).toBe(IdentityErrorCodes.invalidSessionState);
  });
});
