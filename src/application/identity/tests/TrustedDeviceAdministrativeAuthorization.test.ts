import { describe, expect, it } from "bun:test";
import {
  RoleAwareTrustedDeviceAdministrativeAuthorizationPolicy,
  TrustedDeviceAdministrativeActions,
} from "../use-cases/TrustedDeviceAdministrativeAuthorization";

describe("TrustedDeviceAdministrativeAuthorizationPolicy", () => {
  it("allows self-service access without admin assertions", () => {
    const policy = new RoleAwareTrustedDeviceAdministrativeAuthorizationPolicy();

    const decision = policy.evaluate({
      action: TrustedDeviceAdministrativeActions.listTrustedDevices,
      context: {
        actorUserIdentityId: "user:alpha",
      },
      targetUserIdentityId: "user:alpha",
    });

    expect(decision.allowed).toBeTrue();
  });

  it("denies cross-user access without assertions or bootstrap admin identity", () => {
    const policy = new RoleAwareTrustedDeviceAdministrativeAuthorizationPolicy();

    const decision = policy.evaluate({
      action: TrustedDeviceAdministrativeActions.revokeTrustedDevice,
      context: {
        actorUserIdentityId: "user:actor",
      },
      targetUserIdentityId: "user:target",
    });

    expect(decision.allowed).toBeFalse();
    expect(decision.reasonCode).toBe("missing-admin-assertion");
  });

  it("allows cross-user access for bootstrap admin identities", () => {
    const policy = new RoleAwareTrustedDeviceAdministrativeAuthorizationPolicy({
      bootstrapAdminUserIdentityIds: ["user:admin"],
    });

    const decision = policy.evaluate({
      action: TrustedDeviceAdministrativeActions.revokeTrustedDevice,
      context: {
        actorUserIdentityId: "user:admin",
      },
      targetUserIdentityId: "user:target",
      targetWorkspaceId: "workspace:alpha",
    });

    expect(decision.allowed).toBeTrue();
  });
});
