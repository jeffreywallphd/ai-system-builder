import { describe, expect, it } from "bun:test";
import {
  IdentityTransportSchemaValidationError,
  parseIdentityAdminListAccountsRequest,
  parseLoginLocalIdentityRequest,
  parseResolveAuthenticatedSessionResponse,
  parseResolveSessionActorContextResponse,
} from "../IdentityTransportSchemaContracts";

describe("IdentityTransportSchemaContracts", () => {
  it("parses valid identity login and admin-list requests", () => {
    const login = parseLoginLocalIdentityRequest({
      providerSubject: "dev.local.user",
      credential: {
        candidate: "password",
      },
      accessChannel: "thin-client",
    });
    expect(login.providerSubject).toBe("dev.local.user");

    const adminList = parseIdentityAdminListAccountsRequest({
      actorUserIdentityId: "user:admin",
      includeStatuses: ["active"],
      limit: 20,
      offset: 0,
    });
    expect(adminList.limit).toBe(20);
  });

  it("parses canonical session response envelopes", () => {
    const serialized = JSON.stringify({
      ok: true,
      data: {
        principal: {
          userIdentityId: "user:1",
          providerId: "provider:local-password",
          providerSubject: "dev.local.user",
          username: "dev.local.user",
        },
        session: {
          sessionId: "session:1",
          issuedAt: "2026-04-06T10:00:00.000Z",
          expiresAt: "2026-04-06T12:00:00.000Z",
          accessChannel: "thin-client",
          sessionAssuranceLevel: "authenticated-untrusted",
        },
      },
    });
    const response = parseResolveAuthenticatedSessionResponse(JSON.parse(serialized));

    expect(response.ok).toBeTrue();
    expect(response.data?.session.sessionId).toBe("session:1");
  });

  it("parses canonical actor-context bootstrap session envelopes", () => {
    const response = parseResolveSessionActorContextResponse({
      ok: true,
      data: {
        actor: {
          userIdentityId: "user:1",
          username: "dev.local.user",
          email: "dev.local.user@example.com",
          displayName: "Dev User",
        },
        session: {
          sessionId: "session:1",
          providerId: "provider:local-password",
          accessChannel: "thin-client",
          issuedAt: "2026-04-06T10:00:00.000Z",
          expiresAt: "2026-04-06T12:00:00.000Z",
          assuranceLevel: "authenticated-untrusted",
          trustedDeviceId: "trusted-device:1",
          issuedOnTrustedDevice: true,
          trustState: "trusted",
          trustEvaluatedAt: "2026-04-06T10:00:00.000Z",
          trustInvalidationReasons: [],
        },
        trustedDevice: {
          trustedDeviceId: "trusted-device:1",
          userIdentityId: "user:1",
          displayName: "Dev Laptop",
          pairingMethod: "one-time-code",
          trustStatus: "trusted",
          registeredAt: "2026-04-06T09:00:00.000Z",
          metadata: {},
          updatedAt: "2026-04-06T10:00:00.000Z",
        },
        workspaceContext: {
          requestedWorkspaceId: "workspace:alpha",
          resolvedWorkspaceId: "workspace:alpha",
          workspaces: [{
            workspaceId: "workspace:alpha",
            slug: "alpha",
            displayName: "Workspace Alpha",
            status: "active",
            visibility: "team",
            membershipStatus: "active",
            effectiveRoles: ["owner"],
            canAdministrate: true,
            isWorkspaceOwner: true,
          }],
        },
      },
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.workspaceContext.resolvedWorkspaceId).toBe("workspace:alpha");
  });

  it("rejects invalid login payloads", () => {
    expect(() => parseLoginLocalIdentityRequest({
      providerSubject: "",
      credential: {
        candidate: "",
      },
    })).toThrow(IdentityTransportSchemaValidationError);
  });
});
