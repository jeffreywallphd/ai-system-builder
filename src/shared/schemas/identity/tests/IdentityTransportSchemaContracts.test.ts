import { describe, expect, it } from "bun:test";
import {
  IdentityTransportSchemaValidationError,
  parseIdentityAdminListAccountsRequest,
  parseLoginLocalIdentityRequest,
  parseResolveAuthenticatedSessionResponse,
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

  it("rejects invalid login payloads", () => {
    expect(() => parseLoginLocalIdentityRequest({
      providerSubject: "",
      credential: {
        candidate: "",
      },
    })).toThrow(IdentityTransportSchemaValidationError);
  });
});
