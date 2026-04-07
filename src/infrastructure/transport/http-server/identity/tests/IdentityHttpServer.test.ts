import { afterEach, describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { SessionRevocationReasons, revokeSession } from "@domain/identity/IdentityDomain";
import {
  createIdentityHttpServer,
  type IdentityHttpServerLogEvent,
  type IdentityHttpServerLogger,
} from "../IdentityHttpServer";

class CapturingLogger implements IdentityHttpServerLogger {
  public readonly events: IdentityHttpServerLogEvent[] = [];

  public info(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }

  public warn(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }

  public error(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
});

async function startServer(
  logger: CapturingLogger,
  harnessOptions: Parameters<typeof createIdentityAuthTestHarness>[0] = {},
  serverOptions: Partial<Parameters<typeof createIdentityHttpServer>[0]> = {},
): Promise<{ readonly baseUrl: string; readonly harness: Awaited<ReturnType<typeof createIdentityAuthTestHarness>> }> {
  const harness = await createIdentityAuthTestHarness(harnessOptions);
  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    logger,
    ...serverOptions,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  servers.push(server);

  const address = server.address() as AddressInfo;
  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    harness,
  });
}

describe("IdentityHttpServer", () => {
  it("composes and logs authoritative route family registration at startup", async () => {
    const logger = new CapturingLogger();
    await startServer(logger);

    const event = logger.events.find((entry) => entry.event === "identity-http.route-families.composed");
    expect(event).toBeDefined();
    const details = event?.details as { routeFamilyIds?: unknown } | undefined;
    expect(Array.isArray(details?.routeFamilyIds)).toBeTrue();
    expect(details?.routeFamilyIds).toEqual(["identity-auth"]);
  });

  it("supports development login route when explicitly enabled", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger, {}, {
      development: {
        enableDevLoginRoute: true,
      },
    });

    const devLoginResponse = await fetch(`${baseUrl}/api/v1/identity/dev-login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(devLoginResponse.status).toBe(200);
    const devLoginBody = await devLoginResponse.json();
    expect(devLoginBody.ok).toBe(true);
    expect(devLoginBody.data.username).toBe("dev.local.user");
    expect(devLoginBody.data.sessionToken).toBeDefined();
    expect(devLoginBody.data.sessionAccessChannel).toBe("thin-client");
  });

  it("honors dev-login access-channel hints when provided", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger, {}, {
      development: {
        enableDevLoginRoute: true,
      },
    });

    const devLoginResponse = await fetch(`${baseUrl}/api/v1/identity/dev-login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        accessChannel: "desktop",
      }),
    });

    expect(devLoginResponse.status).toBe(200);
    const devLoginBody = await devLoginResponse.json();
    expect(devLoginBody.ok).toBe(true);
    expect(devLoginBody.data.sessionAccessChannel).toBe("desktop");
  });

  it("does not expose development login route when disabled", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger, {}, {
      development: {
        enableDevLoginRoute: false,
      },
    });

    const devLoginResponse = await fetch(`${baseUrl}/api/v1/identity/dev-login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(devLoginResponse.status).toBe(404);
  });

  it("handles CORS preflight and emits CORS headers for API routes", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);
    const origin = "http://127.0.0.1:5174";

    const preflight = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, authorization",
      },
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
    expect(preflight.headers.get("access-control-allow-headers")).toContain("content-type");
    expect(preflight.headers.get("vary")).toContain("Origin");

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "cors.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("rejects disallowed cross-origin API requests", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const disallowedOriginRequest = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        origin: "https://example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "blocked.cors.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(disallowedOriginRequest.status).toBe(403);
    const body = await disallowedOriginRequest.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("forbidden");
  });

  it("exposes end-to-end register and login endpoints", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "api.user",
        email: "api.user@example.com",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();
    expect(registerBody.ok).toBe(true);
    expect(registerBody.data.providerId).toBe("provider:local-password");

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "api.user",
        accessChannel: "thin-client",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.ok).toBe(true);
    expect(loginBody.data.username).toBe("api.user");
    expect(loginBody.data.authPath).toBe("password");
    expect(loginBody.data.sessionTokenType).toBe("Bearer");
    expect(loginBody.data.sessionToken).toBeDefined();
  });

  it("returns stable API error responses for validation and auth failures", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const invalidResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "",
        credential: {
          candidate: "",
        },
      }),
    });

    expect(invalidResponse.status).toBe(400);
    const invalidBody = await invalidResponse.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.code).toBe("invalid-request");
    expect(invalidBody.error.sharedCode).toBe("invalid-request");
    expect(invalidBody.error.domainCode).toBe("invalid-request");
    expect(invalidBody.error.retryable).toBe(false);
    expect(typeof invalidBody.error.userMessage).toBe("string");
    expect(Array.isArray(invalidBody.error.validationErrors)).toBe(true);

    const failedLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "missing.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(failedLoginResponse.status).toBe(401);
    const failedLoginBody = await failedLoginResponse.json();
    expect(failedLoginBody.ok).toBe(false);
    expect(failedLoginBody.error.code).toBe("authentication-failed");
    expect(failedLoginBody.error.sharedCode).toBe("authentication-failed");
    expect(failedLoginBody.error.retryable).toBe(false);
    expect(typeof failedLoginBody.error.userMessage).toBe("string");
  });

  it("propagates request/correlation identifiers in headers, error envelopes, and observability hooks", async () => {
    const logger = new CapturingLogger();
    const observedEvents: IdentityHttpServerLogEvent[] = [];
    const { baseUrl } = await startServer(
      logger,
      {},
      {
        observability: {
          onOperationalEvent: (event) => {
            observedEvents.push(event);
          },
        },
      },
    );

    const correlationId = "ui-debug-correlation-42";
    const invalidResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({
        username: "",
        credential: {
          candidate: "",
        },
      }),
    });

    expect(invalidResponse.status).toBe(400);
    const requestIdHeader = invalidResponse.headers.get("x-request-id");
    const correlationHeader = invalidResponse.headers.get("x-correlation-id");
    expect(typeof requestIdHeader).toBe("string");
    expect((requestIdHeader ?? "").length).toBeGreaterThan(10);
    expect(correlationHeader).toBe(correlationId);

    const invalidBody = await invalidResponse.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.correlationId).toBe(correlationId);

    expect(observedEvents.length).toBeGreaterThan(0);
    const completedEvent = observedEvents.find((entry) => entry.event === "identity-http.request.completed");
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.correlationId).toBe(correlationId);
  });

  it("returns standardized not-found semantics for unknown routes", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const response = await fetch(`${baseUrl}/api/v1/identity/unknown-route`, {
      method: "POST",
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not-found");
    expect(body.error.sharedCode).toBe("not-found");
    expect(body.error.retryable).toBe(false);
    expect(typeof body.error.userMessage).toBe("string");
  });

  it("sanitizes unhandled internal errors before sending responses", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(
      logger,
      {},
      {
        backendApi: {
          registerLocalAccount: async () => {
            throw new Error("sqlite failure at C:\\private\\secrets\\identity.db with token abc");
          },
        } as never,
      },
    );

    const response = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "internal.error.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("internal");
    expect(body.error.sharedCode).toBe("internal");
    expect(body.error.retryable).toBe(false);
    expect(typeof body.error.userMessage).toBe("string");
    expect(String(body.error.message).toLowerCase()).not.toContain("sqlite");
    expect(String(body.error.message).toLowerCase()).not.toContain("secret");
    expect(String(body.error.message).toLowerCase()).not.toContain("token");
  });

  it("returns specific registration policy error details for weak credential input", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const invalidResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "weak.policy.user",
        credential: {
          candidate: "1",
        },
      }),
    });

    expect(invalidResponse.status).toBe(400);
    const invalidBody = await invalidResponse.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.code).toBe("invalid-request");
    expect(invalidBody.error.message).toContain("Credential policy validation failed.");
    expect(invalidBody.error.message).not.toBe("The registration request is invalid.");
  });

  it("redacts credential and token material in transport logs", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "redaction.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "redaction.user",
        client: {
          trustedDeviceBindingId: "trusted-device:redaction",
          trustMarker: "marker:redaction",
        },
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();

    await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "missing.user",
        credential: {
          candidate: "LeakySecret!2026",
        },
      }),
    });
    await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    await fetch(`${baseUrl}/api/v1/identity/credential/change`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
      body: JSON.stringify({
        newCredential: {
          candidate: "AnotherLeakySecret!2026",
        },
        verification: {
          currentCredential: "StrongPass!2026",
        },
      }),
    });

    const serializedEvents = JSON.stringify(logger.events);
    expect(serializedEvents.includes("LeakySecret!2026")).toBeFalse();
    expect(serializedEvents.includes("AnotherLeakySecret!2026")).toBeFalse();
    expect(serializedEvents.includes("trusted-device:redaction")).toBeFalse();
    expect(serializedEvents.includes("marker:redaction")).toBeFalse();
    expect(serializedEvents.includes(loginBody.data.sessionToken)).toBeFalse();
    expect(serializedEvents.includes("[REDACTED]")).toBeTrue();
  });

  it("protects session endpoints with bearer validation and resolves principal context", async () => {
    const logger = new CapturingLogger();
    const { baseUrl, harness } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "guard.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "guard.user",
        client: {
          deviceId: "device:guard",
          trustedDeviceBindingId: "trusted-device:guard",
          trustMarker: "marker:guard",
        },
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();

    const missingToken = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
    });
    expect(missingToken.status).toBe(401);
    const missingTokenBody = await missingToken.json();
    expect(missingTokenBody.ok).toBe(false);
    expect(missingTokenBody.error.code).toBe("authentication-failed");

    const validSessionResponse = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(validSessionResponse.status).toBe(200);
    const validSessionBody = await validSessionResponse.json();
    expect(validSessionBody.ok).toBe(true);
    expect(validSessionBody.data.principal.username).toBe("guard.user");
    expect(validSessionBody.data.session.sessionId).toBe(loginBody.data.sessionId);
    expect(validSessionBody.data.session.deviceId).toBe("device:guard");
    expect(validSessionBody.data.session.trustedDeviceBindingId).toBe("trusted-device:guard");
    expect(validSessionBody.data.session.trustMarker).toBe("marker:guard");

    const issuedSession = await harness.adapter.getSessionById(loginBody.data.sessionId);
    if (!issuedSession) {
      throw new Error("Expected persisted session for protected endpoint test.");
    }

    await harness.adapter.saveSession(revokeSession(issuedSession, SessionRevocationReasons.security, harness.adapter.now()));
    const revokedResponse = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(revokedResponse.status).toBe(401);
    const revokedBody = await revokedResponse.json();
    expect(revokedBody.ok).toBe(false);
    expect(revokedBody.error.code).toBe("authentication-failed");

    const secondLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "guard.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(secondLoginResponse.status).toBe(200);
    const secondLoginBody = await secondLoginResponse.json();

    harness.adapter.setNow("2026-04-05T18:30:00.000Z");
    const expiredResponse = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${secondLoginBody.data.sessionToken}`,
      },
    });
    expect(expiredResponse.status).toBe(401);
    const expiredBody = await expiredResponse.json();
    expect(expiredBody.ok).toBe(false);
    expect(expiredBody.error.code).toBe("authentication-failed");
  });

  it("returns unified session actor-context bootstrap payload with safe trusted-device and workspace projections", async () => {
    const logger = new CapturingLogger();
    const { baseUrl, harness } = await startServer(
      logger,
      {},
      {
        workspaceAdministrationBackendApi: {
          listWorkspaces: async () => Object.freeze({
            ok: true,
            data: Object.freeze({
              workspaces: Object.freeze([
                Object.freeze({
                  workspaceId: "workspace:alpha",
                  slug: "alpha",
                  displayName: "Workspace Alpha",
                  status: "active",
                  visibility: "team",
                  actorAccess: Object.freeze({
                    membershipStatus: "active",
                    effectiveRoles: Object.freeze(["member"]),
                    canAdministrate: false,
                    isWorkspaceOwner: false,
                    capabilities: Object.freeze({
                      canManageWorkspaceSettings: false,
                      canManageMembers: false,
                      canManageInvitations: false,
                      canManageRoles: false,
                    }),
                  }),
                }),
                Object.freeze({
                  workspaceId: "workspace:beta",
                  slug: "beta",
                  displayName: "Workspace Beta",
                  status: "active",
                  visibility: "private",
                  actorAccess: Object.freeze({
                    membershipStatus: "active",
                    effectiveRoles: Object.freeze(["owner"]),
                    canAdministrate: true,
                    isWorkspaceOwner: true,
                    capabilities: Object.freeze({
                      canManageWorkspaceSettings: true,
                      canManageMembers: true,
                      canManageInvitations: true,
                      canManageRoles: true,
                    }),
                  }),
                }),
              ]),
              pagination: Object.freeze({
                limit: 200,
                offset: 0,
                returned: 2,
                hasMore: false,
              }),
            }),
          }),
        } as never,
      },
    );

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "context.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();

    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:context",
      userIdentityId: registerBody.data.userIdentityId,
      trustStatus: "trusted",
    });

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "context.user",
        sessionTrustRequirement: "require-trusted",
        client: {
          trustedDeviceBindingId: "trusted-device:context",
          trustMarker: "marker:private-material",
        },
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();

    const unauthenticatedResponse = await fetch(`${baseUrl}/api/v1/identity/session/context`, {
      method: "GET",
    });
    expect(unauthenticatedResponse.status).toBe(401);

    const contextResponse = await fetch(
      `${baseUrl}/api/v1/identity/session/context?workspaceId=${encodeURIComponent("workspace:beta")}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${loginBody.data.sessionToken}`,
        },
      },
    );
    expect(contextResponse.status).toBe(200);
    const contextBody = await contextResponse.json();
    expect(contextBody.ok).toBe(true);
    expect(contextBody.data.actor.userIdentityId).toBe(registerBody.data.userIdentityId);
    expect(contextBody.data.session.sessionId).toBe(loginBody.data.sessionId);
    expect(contextBody.data.session.trustedDeviceId).toBe("trusted-device:context");
    expect(contextBody.data.workspaceContext.requestedWorkspaceId).toBe("workspace:beta");
    expect(contextBody.data.workspaceContext.resolvedWorkspaceId).toBe("workspace:beta");
    expect(contextBody.data.workspaceContext.workspaces.length).toBe(2);
    expect(contextBody.data.trustedDevice.trustedDeviceId).toBe("trusted-device:context");

    const serialized = JSON.stringify(contextBody);
    expect(serialized.includes("trustMarker")).toBeFalse();
    expect(serialized.includes("trustedDeviceBindingId")).toBeFalse();
    expect(serialized.includes("trustMaterialRef")).toBeFalse();
  });

  it("supports bearer-authenticated logout and targeted session revocation", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "logout.api.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "logout.api.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();

    const logoutResponse = await fetch(`${baseUrl}/api/v1/identity/logout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(logoutResponse.status).toBe(200);
    const logoutBody = await logoutResponse.json();
    expect(logoutBody.ok).toBe(true);
    expect(logoutBody.data.sessionId).toBe(loginBody.data.sessionId);
    expect(logoutBody.data.revocationReason).toBe("logout");

    const invalidAfterLogout = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(invalidAfterLogout.status).toBe(401);

    const secondLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "logout.api.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(secondLoginResponse.status).toBe(200);
    const secondLoginBody = await secondLoginResponse.json();

    const revokeResponse = await fetch(`${baseUrl}/api/v1/identity/session/revoke`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secondLoginBody.data.sessionToken}`,
      },
      body: JSON.stringify({
        sessionId: secondLoginBody.data.sessionId,
        reason: "security",
      }),
    });
    expect(revokeResponse.status).toBe(200);
    const revokeBody = await revokeResponse.json();
    expect(revokeBody.ok).toBe(true);
    expect(revokeBody.data.revocationReason).toBe("security");

    const invalidAfterRevoke = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${secondLoginBody.data.sessionToken}`,
      },
    });
    expect(invalidAfterRevoke.status).toBe(401);
  });

  it("rejects high-assurance routes for untrusted sessions", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "untrusted.high.assurance.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "untrusted.high.assurance.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();

    const credentialChange = await fetch(`${baseUrl}/api/v1/identity/credential/change`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
      body: JSON.stringify({
        newCredential: {
          candidate: "StrongerPass!2027",
        },
        verification: {
          currentCredential: "StrongPass!2026",
        },
      }),
    });
    expect(credentialChange.status).toBe(403);
    const credentialBody = await credentialChange.json();
    expect(credentialBody.ok).toBe(false);
    expect(credentialBody.error.code).toBe("forbidden");
  });

  it("supports bearer-authenticated local credential change", async () => {
    const logger = new CapturingLogger();
    const { baseUrl, harness } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "credential.change.api.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();
    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:credential-change",
      userIdentityId: registerBody.data.userIdentityId,
    });

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "credential.change.api.user",
        sessionTrustRequirement: "require-trusted",
        client: {
          trustedDeviceBindingId: "trusted-device:credential-change",
        },
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();

    const changeCredentialResponse = await fetch(`${baseUrl}/api/v1/identity/credential/change`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
      body: JSON.stringify({
        newCredential: {
          candidate: "StrongerPass!2027",
        },
        verification: {
          currentCredential: "StrongPass!2026",
        },
      }),
    });
    expect(changeCredentialResponse.status).toBe(200);
    const changeCredentialBody = await changeCredentialResponse.json();
    expect(changeCredentialBody.ok).toBe(true);
    expect(changeCredentialBody.data.verificationMode).toBe("current-credential");

    const oldCredentialLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "credential.change.api.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(oldCredentialLoginResponse.status).toBe(401);

    const newCredentialLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "credential.change.api.user",
        credential: {
          candidate: "StrongerPass!2027",
        },
      }),
    });
    expect(newCredentialLoginResponse.status).toBe(200);
  });

  it("supports bearer-authenticated local account administration endpoints", async () => {
    const logger = new CapturingLogger();
    const { baseUrl, harness } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "admin.api.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();
    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:admin",
      userIdentityId: registerBody.data.userIdentityId,
    });

    const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "admin.api.user",
        sessionTrustRequirement: "require-trusted",
        client: {
          trustedDeviceBindingId: "trusted-device:admin",
        },
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();

    const listResponse = await fetch(`${baseUrl}/api/v1/identity/admin/accounts`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.accounts.some((account: { userIdentityId: string }) => account.userIdentityId === registerBody.data.userIdentityId)).toBeTrue();

    const getResponse = await fetch(`${baseUrl}/api/v1/identity/admin/accounts/${encodeURIComponent(registerBody.data.userIdentityId)}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.ok).toBe(true);
    expect(getBody.data.account.userIdentityId).toBe(registerBody.data.userIdentityId);

    const disableResponse = await fetch(`${baseUrl}/api/v1/identity/admin/accounts/${encodeURIComponent(registerBody.data.userIdentityId)}/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
      body: JSON.stringify({
        action: "disable",
      }),
    });
    expect(disableResponse.status).toBe(200);
    const disableBody = await disableResponse.json();
    expect(disableBody.ok).toBe(true);
    expect(disableBody.data.status).toBe("suspended");
    expect(disableBody.data.affectedSessionIds).toEqual([loginBody.data.sessionId]);

    const sessionAfterDisable = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(sessionAfterDisable.status).toBe(401);
  });

  it("lists active sessions for the authenticated account with status/access-channel filters", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "session.list.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);

    const desktopLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "session.list.user",
        accessChannel: "desktop",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(desktopLoginResponse.status).toBe(200);

    const thinLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "session.list.user",
        accessChannel: "thin-client",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(thinLoginResponse.status).toBe(200);
    const thinLoginBody = await thinLoginResponse.json();

    const sessionsResponse = await fetch(
      `${baseUrl}/api/v1/identity/sessions?status=active&accessChannel=desktop`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${thinLoginBody.data.sessionToken}`,
        },
      },
    );
    expect(sessionsResponse.status).toBe(200);
    const sessionsBody = await sessionsResponse.json();
    expect(sessionsBody.ok).toBe(true);
    expect(Array.isArray(sessionsBody.data.sessions)).toBeTrue();
    expect(sessionsBody.data.sessions.length).toBe(1);
    expect(sessionsBody.data.sessions[0].accessChannel).toBe("desktop");
    expect(sessionsBody.data.sessions[0].status).toBe("active");
  });

  it("enforces admin authorization for trusted-device oversight endpoints", async () => {
    const logger = new CapturingLogger();
    const { baseUrl, harness } = await startServer(logger, {
      trustedDeviceAdministration: {
        bootstrapAdminUserIdentityIds: ["user-identity:1"],
      },
    });

    const adminRegisterResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "trusted.device.admin.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(adminRegisterResponse.status).toBe(200);
    const adminRegisterBody = await adminRegisterResponse.json();
    expect(adminRegisterBody.data.userIdentityId).toBe("user-identity:1");
    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:admin-self",
      userIdentityId: adminRegisterBody.data.userIdentityId,
      trustStatus: "trusted",
    });

    const memberRegisterResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "trusted.device.member.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(memberRegisterResponse.status).toBe(200);
    const memberRegisterBody = await memberRegisterResponse.json();
    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:member-managed",
      userIdentityId: memberRegisterBody.data.userIdentityId,
      trustStatus: "trusted",
    });

    const memberLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "trusted.device.member.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(memberLoginResponse.status).toBe(200);
    const memberLoginBody = await memberLoginResponse.json();

    const forbiddenListResponse = await fetch(
      `${baseUrl}/api/v1/identity/admin/trusted-devices?userIdentityId=${encodeURIComponent(adminRegisterBody.data.userIdentityId)}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${memberLoginBody.data.sessionToken}`,
        },
      },
    );
    expect(forbiddenListResponse.status).toBe(403);
    const forbiddenListBody = await forbiddenListResponse.json();
    expect(forbiddenListBody.ok).toBe(false);
    expect(forbiddenListBody.error.code).toBe("forbidden");

    const adminLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "trusted.device.admin.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(adminLoginResponse.status).toBe(200);
    const adminLoginBody = await adminLoginResponse.json();

    const adminListResponse = await fetch(
      `${baseUrl}/api/v1/identity/admin/trusted-devices?userIdentityId=${encodeURIComponent(memberRegisterBody.data.userIdentityId)}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${adminLoginBody.data.sessionToken}`,
        },
      },
    );
    expect(adminListResponse.status).toBe(200);
    const adminListBody = await adminListResponse.json();
    expect(adminListBody.ok).toBe(true);
    expect(adminListBody.data.devices.some((device: { trustedDeviceId: string }) => (
      device.trustedDeviceId === "trusted-device:member-managed"
    ))).toBeTrue();

    const adminRevokeResponse = await fetch(
      `${baseUrl}/api/v1/identity/admin/trusted-devices/${encodeURIComponent("trusted-device:member-managed")}/revoke`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminLoginBody.data.sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "admin-action",
        }),
      },
    );
    expect(adminRevokeResponse.status).toBe(200);
    const adminRevokeBody = await adminRevokeResponse.json();
    expect(adminRevokeBody.ok).toBe(true);
    expect(adminRevokeBody.data.revoked).toBe(true);
  });

  it("supports admin session oversight listing and admin revocation", async () => {
    const logger = new CapturingLogger();
    const { baseUrl } = await startServer(logger, {
      trustedDeviceAdministration: {
        bootstrapAdminUserIdentityIds: ["user-identity:1"],
      },
    });

    const adminRegisterResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "session.admin.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(adminRegisterResponse.status).toBe(200);
    const adminRegisterBody = await adminRegisterResponse.json();

    const memberRegisterResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "session.member.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(memberRegisterResponse.status).toBe(200);
    const memberRegisterBody = await memberRegisterResponse.json();

    const memberLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "session.member.user",
        accessChannel: "thin-client",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(memberLoginResponse.status).toBe(200);
    const memberLoginBody = await memberLoginResponse.json();

    const forbiddenResponse = await fetch(
      `${baseUrl}/api/v1/identity/admin/sessions?userIdentityId=${encodeURIComponent(adminRegisterBody.data.userIdentityId)}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${memberLoginBody.data.sessionToken}`,
        },
      },
    );
    expect(forbiddenResponse.status).toBe(403);

    const adminLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "session.admin.user",
        accessChannel: "desktop",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(adminLoginResponse.status).toBe(200);
    const adminLoginBody = await adminLoginResponse.json();

    const listResponse = await fetch(
      `${baseUrl}/api/v1/identity/admin/sessions?userIdentityId=${encodeURIComponent(memberRegisterBody.data.userIdentityId)}&status=active`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${adminLoginBody.data.sessionToken}`,
        },
      },
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.sessions.some((session: { sessionId: string }) => session.sessionId === memberLoginBody.data.sessionId)).toBeTrue();

    const revokeResponse = await fetch(
      `${baseUrl}/api/v1/identity/admin/sessions/${encodeURIComponent(memberLoginBody.data.sessionId)}/revoke`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminLoginBody.data.sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "admin",
        }),
      },
    );
    expect(revokeResponse.status).toBe(200);
    const revokeBody = await revokeResponse.json();
    expect(revokeBody.ok).toBe(true);
    expect(revokeBody.data.revocationReason).toBe("admin");

    const invalidAfterAdminRevoke = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${memberLoginBody.data.sessionToken}`,
      },
    });
    expect(invalidAfterAdminRevoke.status).toBe(401);
  });

  it("hardens the full local identity lifecycle journey across endpoints", async () => {
    const logger = new CapturingLogger();
    const { baseUrl, harness } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "lifecycle.user",
        email: "lifecycle.user@example.com",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();
    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:lifecycle",
      userIdentityId: registerBody.data.userIdentityId,
    });

    const firstLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerSubject: "lifecycle.user",
        sessionTrustRequirement: "require-trusted",
        client: {
          trustedDeviceBindingId: "trusted-device:lifecycle",
        },
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(firstLoginResponse.status).toBe(200);
    const firstLoginBody = await firstLoginResponse.json();

    const sessionResolveResponse = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${firstLoginBody.data.sessionToken}`,
      },
    });
    expect(sessionResolveResponse.status).toBe(200);

    const changeCredentialResponse = await fetch(`${baseUrl}/api/v1/identity/credential/change`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${firstLoginBody.data.sessionToken}`,
      },
      body: JSON.stringify({
        newCredential: {
          candidate: "StrongerPass!2027",
        },
        verification: {
          currentCredential: "StrongPass!2026",
        },
      }),
    });
    expect(changeCredentialResponse.status).toBe(200);

    const logoutResponse = await fetch(`${baseUrl}/api/v1/identity/logout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${firstLoginBody.data.sessionToken}`,
      },
    });
    expect(logoutResponse.status).toBe(200);

    const oldCredentialLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerSubject: "lifecycle.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(oldCredentialLoginResponse.status).toBe(401);

    const secondLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerSubject: "lifecycle.user",
        sessionTrustRequirement: "require-trusted",
        client: {
          trustedDeviceBindingId: "trusted-device:lifecycle",
        },
        credential: {
          candidate: "StrongerPass!2027",
        },
      }),
    });
    expect(secondLoginResponse.status).toBe(200);
    const secondLoginBody = await secondLoginResponse.json();

    const disableResponse = await fetch(`${baseUrl}/api/v1/identity/admin/accounts/${encodeURIComponent(registerBody.data.userIdentityId)}/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secondLoginBody.data.sessionToken}`,
      },
      body: JSON.stringify({
        action: "disable",
      }),
    });
    expect(disableResponse.status).toBe(200);

    const disabledSessionResponse = await fetch(`${baseUrl}/api/v1/identity/session`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${secondLoginBody.data.sessionToken}`,
      },
    });
    expect(disabledSessionResponse.status).toBe(401);

    const disabledLoginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerSubject: "lifecycle.user",
        credential: {
          candidate: "StrongerPass!2027",
        },
      }),
    });
    expect(disabledLoginResponse.status).toBe(403);
  });

  it("supports trusted-device management and pairing endpoints with authenticated context", async () => {
    const logger = new CapturingLogger();
    const { baseUrl, harness } = await startServer(logger);

    const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "trusted.device.api.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(registerResponse.status).toBe(200);
    const registerBody = await registerResponse.json();

    const trustedDeviceId = "trusted-device:http-flow";
    await harness.provisionTrustedDevice({
      trustedDeviceId,
      userIdentityId: registerBody.data.userIdentityId,
      trustStatus: "pending-pairing",
    });

    const provisioned = await fetch(`${baseUrl}/api/v1/identity/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerSubject: "trusted.device.api.user",
        credential: {
          candidate: "StrongPass!2026",
        },
      }),
    });
    expect(provisioned.status).toBe(200);
    const loginBody = await provisioned.json();

    const initiateResponse = await fetch(`${baseUrl}/api/v1/identity/trusted-devices/pairing/initiate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        trustedDeviceId,
        userIdentityId: "malicious-override-ignored",
        artifactType: "one-time-code",
        actorBinding: {
          scope: "same-user",
          userIdentityId: registerBody.data.userIdentityId,
        },
        expiresAt: "2026-04-04T18:30:00.000Z",
      }),
    });
    expect(initiateResponse.status).toBe(200);
    const initiateBody = await initiateResponse.json();
    expect(initiateBody.ok).toBe(true);

    const validateResponse = await fetch(`${baseUrl}/api/v1/identity/trusted-devices/pairing/validate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pairingSessionId: initiateBody.data.pairingSession.pairingSessionId,
        pairingTokenId: initiateBody.data.pairingToken.pairingTokenId,
        trustedDeviceId,
        userIdentityId: "malicious-override-ignored",
        presentedToken: initiateBody.data.artifact.value,
      }),
    });
    expect(validateResponse.status).toBe(200);
    const validateBody = await validateResponse.json();
    expect(validateBody.ok).toBe(true);
    expect(validateBody.data.outcome).toBe("valid");

    const completeResponse = await fetch(`${baseUrl}/api/v1/identity/trusted-devices/pairing/complete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pairingSessionId: initiateBody.data.pairingSession.pairingSessionId,
        pairingTokenId: initiateBody.data.pairingToken.pairingTokenId,
        trustedDeviceId,
        userIdentityId: "malicious-override-ignored",
        presentedToken: initiateBody.data.artifact.value,
        trustMaterialRef: {
          materialId: `material:${trustedDeviceId}`,
          kind: "session-signing-key",
          issuedAt: "2026-04-04T18:00:00.000Z",
        },
      }),
    });
    expect(completeResponse.status).toBe(200);
    const completeBody = await completeResponse.json();
    expect(completeBody.ok).toBe(true);
    expect(completeBody.data.trustedDevice.trustStatus).toBe("trusted");

    const listResponse = await fetch(`${baseUrl}/api/v1/identity/trusted-devices`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.data.devices.some((device: { trustedDeviceId: string }) => device.trustedDeviceId === trustedDeviceId)).toBeTrue();

    const getResponse = await fetch(`${baseUrl}/api/v1/identity/trusted-devices/${encodeURIComponent(trustedDeviceId)}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.ok).toBe(true);
    expect(getBody.data.trustedDevice.trustedDeviceId).toBe(trustedDeviceId);

    const renameResponse = await fetch(`${baseUrl}/api/v1/identity/trusted-devices/${encodeURIComponent(trustedDeviceId)}/display-name`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        displayName: "HTTP Flow Device",
      }),
    });
    expect(renameResponse.status).toBe(200);
    const renameBody = await renameResponse.json();
    expect(renameBody.ok).toBe(true);
    expect(renameBody.data.trustedDevice.displayName).toBe("HTTP Flow Device");

    const revokeResponse = await fetch(`${baseUrl}/api/v1/identity/trusted-devices/${encodeURIComponent(trustedDeviceId)}/revoke`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${loginBody.data.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reason: "user-request",
      }),
    });
    expect(revokeResponse.status).toBe(200);
    const revokeBody = await revokeResponse.json();
    expect(revokeBody.ok).toBe(true);
    expect(revokeBody.data.revoked).toBe(true);
  });
});

