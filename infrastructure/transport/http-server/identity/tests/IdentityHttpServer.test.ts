import { afterEach, describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { SessionRevocationReasons, revokeSession } from "../../../../../src/domain/identity/IdentityDomain";
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
): Promise<{ readonly baseUrl: string; readonly harness: Awaited<ReturnType<typeof createIdentityAuthTestHarness>> }> {
  const harness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: harness.backendApi,
    logger,
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
