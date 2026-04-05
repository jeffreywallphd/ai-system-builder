import { describe, expect, it } from "bun:test";
import { HttpIdentityAuthClient } from "../IdentityAuthClient";

describe("HttpIdentityAuthClient", () => {
  it("calls register/login/session/logout/revoke/credential/admin/trusted-device identity API endpoints", async () => {
    const requests: ReadonlyArray<{ method: string; url: string; body: string; authorization?: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      (requests as Array<{ method: string; url: string; body: string; authorization?: string }>).push({
        method: String(init?.method ?? "GET"),
        url: input,
        body: String(init?.body ?? ""),
        authorization: headers?.authorization,
      });
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = new HttpIdentityAuthClient("http://127.0.0.1:8788/");
    await client.registerLocalAccount({
      username: "alice",
      credential: { candidate: "password-1" },
    });
    await client.loginLocalAccount({
      providerSubject: "alice",
      credential: { candidate: "password-1" },
    });
    await client.resolveAuthenticatedSession("token-0");
    await client.logoutAuthenticatedSession("token-1");
    await client.revokeIdentitySession({ sessionId: "identity-session:1", reason: "security" }, "token-2");
    await client.changeLocalPasswordCredential({
      newCredential: { candidate: "password-2" },
      verification: { currentCredential: "password-1" },
    }, "token-2b");
    await client.listIdentityAdminAccounts({
      context: { actorUserIdentityId: "user-1" },
      includeStatuses: ["active", "suspended"],
      limit: 10,
      offset: 20,
    }, "token-3");
    await client.getIdentityAdminAccountStatus({
      context: { actorUserIdentityId: "user-1" },
      userIdentityId: "user-2",
      providerId: "provider:local-password",
    }, "token-4");
    await client.setIdentityAdminAccountStatus({
      context: { actorUserIdentityId: "user-1" },
      userIdentityId: "user-2",
      action: "disable",
      providerId: "provider:local-password",
    }, "token-5");
    await client.listIdentityAdminTrustedDevices({
      context: { actorUserIdentityId: "user-1" },
      userIdentityId: "user-2",
      workspaceId: "workspace:alpha",
      includeStatuses: ["trusted"],
      limit: 5,
      offset: 2,
    }, "token-5b");
    await client.revokeIdentityAdminTrustedDevice({
      context: { actorUserIdentityId: "user-1" },
      trustedDeviceId: "trusted-device:beta",
      reason: "admin-action",
    }, "token-5c");
    await client.listTrustedDevices({
      userIdentityId: "user-1",
      includeStatuses: ["pending-pairing", "trusted"],
      limit: 5,
      offset: 10,
    }, "token-6");
    await client.getTrustedDevice({
      trustedDeviceId: "trusted-device:alpha",
    }, "token-7");
    await client.revokeTrustedDevice({
      trustedDeviceId: "trusted-device:alpha",
      reason: "user-request",
    }, "token-8");
    await client.updateTrustedDeviceDisplayName({
      trustedDeviceId: "trusted-device:alpha",
      displayName: "Alice Laptop",
    }, "token-9");
    await client.initiateTrustedDevicePairing({
      trustedDeviceId: "trusted-device:alpha",
      userIdentityId: "user-1",
      artifactType: "one-time-code",
      actorBinding: {
        scope: "same-user",
        userIdentityId: "user-1",
      },
      expiresAt: "2026-04-05T12:00:00.000Z",
    }, "token-10");
    await client.validateTrustedDevicePairing({
      pairingSessionId: "pairing-session:1",
      pairingTokenId: "pairing-token:1",
      trustedDeviceId: "trusted-device:alpha",
      userIdentityId: "user-1",
      presentedToken: "token-value",
    }, "token-11");
    await client.completeTrustedDevicePairing({
      pairingSessionId: "pairing-session:1",
      pairingTokenId: "pairing-token:1",
      trustedDeviceId: "trusted-device:alpha",
      userIdentityId: "user-1",
      presentedToken: "token-value",
      trustMaterialRef: {
        materialId: "material:trusted-device:alpha",
        kind: "session-signing-key",
        issuedAt: "2026-04-05T12:00:00.000Z",
      },
    }, "token-12");

    expect(requests.map((entry) => entry.method)).toEqual([
      "POST",
      "POST",
      "GET",
      "POST",
      "POST",
      "GET",
      "POST",
      "POST",
      "GET",
      "GET",
      "POST",
      "GET",
      "GET",
      "POST",
      "POST",
      "POST",
      "POST",
      "POST",
    ]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/identity/register",
      "http://127.0.0.1:8788/api/v1/identity/login",
      "http://127.0.0.1:8788/api/v1/identity/session",
      "http://127.0.0.1:8788/api/v1/identity/logout",
      "http://127.0.0.1:8788/api/v1/identity/session/revoke",
      "http://127.0.0.1:8788/api/v1/identity/credential/change",
      "http://127.0.0.1:8788/api/v1/identity/admin/accounts?status=active&status=suspended&limit=10&offset=20",
      "http://127.0.0.1:8788/api/v1/identity/admin/accounts/user-2?providerId=provider%3Alocal-password",
      "http://127.0.0.1:8788/api/v1/identity/admin/accounts/user-2/status",
      "http://127.0.0.1:8788/api/v1/identity/admin/trusted-devices?userIdentityId=user-2&workspaceId=workspace%3Aalpha&status=trusted&limit=5&offset=2",
      "http://127.0.0.1:8788/api/v1/identity/admin/trusted-devices/trusted-device%3Abeta/revoke",
      "http://127.0.0.1:8788/api/v1/identity/trusted-devices?status=pending-pairing&status=trusted&limit=5&offset=10",
      "http://127.0.0.1:8788/api/v1/identity/trusted-devices/trusted-device%3Aalpha",
      "http://127.0.0.1:8788/api/v1/identity/trusted-devices/trusted-device%3Aalpha/revoke",
      "http://127.0.0.1:8788/api/v1/identity/trusted-devices/trusted-device%3Aalpha/display-name",
      "http://127.0.0.1:8788/api/v1/identity/trusted-devices/pairing/initiate",
      "http://127.0.0.1:8788/api/v1/identity/trusted-devices/pairing/validate",
      "http://127.0.0.1:8788/api/v1/identity/trusted-devices/pairing/complete",
    ]);
    expect(requests[2]?.authorization).toBe("Bearer token-0");
    expect(requests[3]?.authorization).toBe("Bearer token-1");
    expect(requests[4]?.authorization).toBe("Bearer token-2");
    expect(requests[5]?.authorization).toBe("Bearer token-2b");
    expect(requests[6]?.authorization).toBe("Bearer token-3");
    expect(requests[7]?.authorization).toBe("Bearer token-4");
    expect(requests[8]?.authorization).toBe("Bearer token-5");
    expect(requests[9]?.authorization).toBe("Bearer token-5b");
    expect(requests[10]?.authorization).toBe("Bearer token-5c");
    expect(requests[11]?.authorization).toBe("Bearer token-6");
    expect(requests[12]?.authorization).toBe("Bearer token-7");
    expect(requests[13]?.authorization).toBe("Bearer token-8");
    expect(requests[14]?.authorization).toBe("Bearer token-9");
    expect(requests[15]?.authorization).toBe("Bearer token-10");
    expect(requests[16]?.authorization).toBe("Bearer token-11");
    expect(requests[17]?.authorization).toBe("Bearer token-12");
  });
});
