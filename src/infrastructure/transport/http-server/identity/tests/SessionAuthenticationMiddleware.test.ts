import { describe, expect, it } from "bun:test";
import type { IncomingMessage } from "node:http";
import type { IdentityAuthBackendApi } from "../../../../api/identity/IdentityAuthBackendApi";
import { IdentityAuthApiErrorCodes, type ResolveAuthenticatedSessionApiResponse } from "../../../../api/identity/sdk/PublicIdentityAuthApiContract";
import {
  buildAuthenticatedSessionActorContext,
  resolveAuthenticatedSessionFromRequest,
} from "../middleware/session-authentication";

function createRequest(authorization: string | undefined): IncomingMessage {
  return {
    headers: {
      ...(authorization ? { authorization } : {}),
    },
  } as IncomingMessage;
}

function createBackendApiStub(
  response: Awaited<ReturnType<IdentityAuthBackendApi["resolveAuthenticatedSession"]>>,
  calls: string[],
): IdentityAuthBackendApi {
  return {
    resolveAuthenticatedSession: async ({ sessionToken }) => {
      calls.push(sessionToken);
      return response;
    },
  } as unknown as IdentityAuthBackendApi;
}

describe("session-authentication middleware utilities", () => {
  it("returns authentication-failed for missing bearer authorization header", async () => {
    const calls: string[] = [];
    const backendApi = createBackendApiStub({
      ok: true,
      data: {} as ResolveAuthenticatedSessionApiResponse,
    }, calls);

    const result = await resolveAuthenticatedSessionFromRequest(createRequest(undefined), backendApi, {
      mapStatusCode: () => 401,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected missing bearer flow to fail.");
    }
    expect(result.statusCode).toBe(401);
    expect(result.requestLogPayload).toEqual({});
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.authenticationFailed,
        message: "Missing Authorization bearer token.",
      },
    });
    expect(calls.length).toBe(0);
  });

  it("returns authentication-failed for malformed authorization header", async () => {
    const calls: string[] = [];
    const backendApi = createBackendApiStub({
      ok: true,
      data: {} as ResolveAuthenticatedSessionApiResponse,
    }, calls);

    const result = await resolveAuthenticatedSessionFromRequest(createRequest("Basic abc123"), backendApi, {
      mapStatusCode: () => 401,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected malformed bearer flow to fail.");
    }
    expect(result.statusCode).toBe(401);
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: IdentityAuthApiErrorCodes.authenticationFailed,
        message: "Missing Authorization bearer token.",
      },
    });
    expect(calls.length).toBe(0);
  });

  it("maps invalid or expired session resolution failures without changing backend semantics", async () => {
    const calls: string[] = [];
    const backendFailure = Object.freeze({
      ok: false as const,
      error: Object.freeze({
        code: IdentityAuthApiErrorCodes.authenticationFailed,
        message: "Session expired or revoked.",
      }),
    });
    const backendApi = createBackendApiStub(backendFailure, calls);

    const result = await resolveAuthenticatedSessionFromRequest(createRequest("Bearer session-token-expired"), backendApi, {
      mapStatusCode: () => 401,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid session flow to fail.");
    }
    expect(result.statusCode).toBe(401);
    expect(result.body).toEqual(backendFailure);
    expect(result.requestLogPayload).toEqual({ sessionToken: "session-token-expired" });
    expect(calls).toEqual(["session-token-expired"]);
  });

  it("builds authenticated actor context from a valid resolved session", async () => {
    const calls: string[] = [];
    const resolvedSession: ResolveAuthenticatedSessionApiResponse = Object.freeze({
      principal: Object.freeze({
        userIdentityId: "user-identity:42",
        username: "actor.user",
      }),
      session: Object.freeze({
        sessionId: "session:42",
        providerSubject: "actor.user",
        accessChannel: "desktop",
        deviceTrustContext: Object.freeze({
          sessionAssuranceLevel: "authenticated-trusted",
        }),
      }),
    } as ResolveAuthenticatedSessionApiResponse);

    const backendApi = createBackendApiStub({
      ok: true,
      data: resolvedSession,
    }, calls);

    const result = await resolveAuthenticatedSessionFromRequest(createRequest("Bearer session-token-valid"), backendApi, {
      mapStatusCode: () => 401,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected valid session flow to succeed.");
    }
    expect(calls).toEqual(["session-token-valid"]);
    const context = buildAuthenticatedSessionActorContext({
      resolvedSession: result.resolvedSession,
      sessionToken: result.sessionToken,
      sessionAssuranceLevel: "authenticated-trusted",
      transport: Object.freeze({
        connection: Object.freeze({
          encryptedTransportEstablished: true,
        }),
        channel: Object.freeze({
          accessChannel: "desktop",
        }),
        trustValidation: Object.freeze({
          enforced: true,
        }),
      }),
    });

    expect(context.actor).toEqual({
      userIdentityId: "user-identity:42",
      username: "actor.user",
    });
    expect(context.sessionToken).toBe("session-token-valid");
    expect(context.sessionTrust).toEqual({
      assuranceLevel: "authenticated-trusted",
      isTrusted: true,
    });
  });
});
