import { describe, expect, it } from "bun:test";
import { IdentityErrorCodes, identityFailure, identitySuccess } from "../../contracts/IdentityApplicationContracts";
import { RevokeIdentitySessionUseCase } from "../../../src/application/identity/use-cases/RevokeIdentitySessionUseCase";

describe("RevokeIdentitySessionUseCase", () => {
  it("revokes a session by id and defaults reason to security", async () => {
    const useCase = new RevokeIdentitySessionUseCase({
      sessionRepository: {
        saveSession: async () => {
          throw new Error("Unexpected call");
        },
        getSessionById: async () => Object.freeze({
          id: "identity-session:1",
          userIdentityId: "user-identity:1",
          providerId: "provider:local-password",
          providerSubject: "alice",
          status: "active",
          issuedAt: "2026-04-04T18:00:00.000Z",
          expiresAt: "2026-04-05T18:00:00.000Z",
        }),
        listSessionsByUserIdentityId: async () => Object.freeze([]),
        removeSession: async () => identitySuccess(Object.freeze({ changed: false })),
      },
      authenticatedSessionService: {
        revokeAuthenticatedSessionById: async () => identitySuccess(Object.freeze({
          session: Object.freeze({
            id: "identity-session:1",
            userIdentityId: "user-identity:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            status: "revoked",
            issuedAt: "2026-04-04T18:00:00.000Z",
            expiresAt: "2026-04-05T18:00:00.000Z",
            revocation: Object.freeze({
              reason: "security",
              revokedAt: "2026-04-04T18:10:00.000Z",
            }),
          }),
        })),
      },
    });

    const result = await useCase.execute({
      sessionId: "identity-session:1",
      actorUserIdentityId: "user-identity:1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected revoke use case success.");
    }
    expect(result.value.sessionId).toBe("identity-session:1");
    expect(result.value.revocationReason).toBe("security");
  });

  it("fails when actor does not own the target session", async () => {
    const useCase = new RevokeIdentitySessionUseCase({
      sessionRepository: {
        saveSession: async () => {
          throw new Error("Unexpected call");
        },
        getSessionById: async () => Object.freeze({
          id: "identity-session:1",
          userIdentityId: "user-identity:owner",
          providerId: "provider:local-password",
          providerSubject: "owner",
          status: "active",
          issuedAt: "2026-04-04T18:00:00.000Z",
          expiresAt: "2026-04-05T18:00:00.000Z",
        }),
        listSessionsByUserIdentityId: async () => Object.freeze([]),
        removeSession: async () => identitySuccess(Object.freeze({ changed: false })),
      },
      authenticatedSessionService: {
        revokeAuthenticatedSessionById: async () => {
          throw new Error("Should not be called");
        },
      },
    });

    const result = await useCase.execute({
      sessionId: "identity-session:1",
      actorUserIdentityId: "user-identity:other",
    });

    expect(result.ok).toBeFalse();
    expect(result.error.code).toBe(IdentityErrorCodes.invalidRequest);
  });

  it("propagates revoke failures from authenticated session service", async () => {
    const useCase = new RevokeIdentitySessionUseCase({
      sessionRepository: {
        saveSession: async () => {
          throw new Error("Unexpected call");
        },
        getSessionById: async () => Object.freeze({
          id: "identity-session:1",
          userIdentityId: "user-identity:1",
          providerId: "provider:local-password",
          providerSubject: "alice",
          status: "active",
          issuedAt: "2026-04-04T18:00:00.000Z",
          expiresAt: "2026-04-05T18:00:00.000Z",
        }),
        listSessionsByUserIdentityId: async () => Object.freeze([]),
        removeSession: async () => identitySuccess(Object.freeze({ changed: false })),
      },
      authenticatedSessionService: {
        revokeAuthenticatedSessionById: async () => identityFailure({
          code: IdentityErrorCodes.invalidSessionState,
          message: "Session is already revoked.",
          boundary: "application",
          retryable: false,
        }),
      },
    });

    const result = await useCase.execute({
      sessionId: "identity-session:1",
      reason: "admin",
    });

    expect(result.ok).toBeFalse();
    expect(result.error.code).toBe(IdentityErrorCodes.invalidSessionState);
  });
});
