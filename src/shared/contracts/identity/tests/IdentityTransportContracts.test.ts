import { describe, expect, it } from "bun:test";
import { IdentityTransportRoutes } from "../IdentityTransportContracts";

describe("IdentityTransportContracts", () => {
  it("defines canonical identity session and admin-lite routes", () => {
    expect(IdentityTransportRoutes.login).toBe("/api/v1/identity/login");
    expect(IdentityTransportRoutes.resolveSession).toBe("/api/v1/identity/session");
    expect(IdentityTransportRoutes.listSessions).toBe("/api/v1/identity/sessions");
    expect(IdentityTransportRoutes.resolveSessionActorContext).toBe("/api/v1/identity/session/context");
    expect(IdentityTransportRoutes.listAdminAccounts).toBe("/api/v1/identity/admin/accounts");
    expect(IdentityTransportRoutes.listAdminSessions).toBe("/api/v1/identity/admin/sessions");
    expect(IdentityTransportRoutes.listTrustedDevices).toBe("/api/v1/identity/trusted-devices");
  });
});
