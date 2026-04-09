import { describe, expect, it } from "vitest";
import { guardAuthenticationInitialization } from "../AuthenticationInitializationGuard";
import type { LoginLocalIdentityApiResponse } from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

const sampleSession: LoginLocalIdentityApiResponse = Object.freeze({
  userIdentityId: "user:alpha",
  username: "alpha.user",
  providerId: "provider:local-password",
  providerSubject: "alpha.user",
  authPath: "password",
  authenticatedAt: "2026-04-09T00:00:00.000Z",
  sessionId: "session:alpha",
  sessionToken: "token-alpha",
  sessionTokenType: "Bearer",
  sessionIssuedAt: "2026-04-09T00:00:00.000Z",
  sessionExpiresAt: "2026-05-09T00:00:00.000Z",
});

describe("guardAuthenticationInitialization", () => {
  it("returns initialized when callback resolves true", async () => {
    const result = await guardAuthenticationInitialization(async () => true, sampleSession, 10);
    expect(result).toEqual({
      initialized: true,
      timedOut: false,
    });
  });

  it("returns non-timeout failure when callback resolves false", async () => {
    const result = await guardAuthenticationInitialization(async () => false, sampleSession, 10);
    expect(result).toEqual({
      initialized: false,
      timedOut: false,
    });
  });

  it("returns timeout failure when callback does not settle before timeout", async () => {
    const result = await guardAuthenticationInitialization(
      async () => await new Promise<boolean>(() => undefined),
      sampleSession,
      5,
    );
    expect(result).toEqual({
      initialized: false,
      timedOut: true,
    });
  });
});
