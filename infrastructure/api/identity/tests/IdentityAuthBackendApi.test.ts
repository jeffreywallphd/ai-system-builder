import { describe, expect, it } from "bun:test";
import { createIdentityAuthTestHarness } from "./TestIdentityAuthHarness";

describe("IdentityAuthBackendApi", () => {
  it("registers and logs in local accounts through stable response contracts", async () => {
    const harness = await createIdentityAuthTestHarness();

    const registered = await harness.backendApi.registerLocalAccount({
      username: "Valid.User",
      email: "valid.user@example.com",
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(registered.ok).toBeTrue();
    expect(registered.data?.userIdentityId).toBeDefined();
    expect(registered.data?.providerId).toBe("provider:local-password");
    expect(registered.data?.providerSubject).toBe("valid.user");

    const loggedIn = await harness.backendApi.loginLocalAccount({
      providerSubject: "valid.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(loggedIn.ok).toBeTrue();
    expect(loggedIn.data?.userIdentityId).toBe(registered.data?.userIdentityId);
    expect(loggedIn.data?.username).toBe("valid.user");
    expect(loggedIn.data?.authenticatedAt).toBe("2026-04-04T18:00:00.000Z");
  });

  it("maps duplicate registration to conflict and invalid login to authentication-failed", async () => {
    const harness = await createIdentityAuthTestHarness();

    const initial = await harness.backendApi.registerLocalAccount({
      username: "duplicate.user",
      email: "duplicate@example.com",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(initial.ok).toBeTrue();

    const duplicate = await harness.backendApi.registerLocalAccount({
      username: "duplicate.user",
      email: "duplicate2@example.com",
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(duplicate.ok).toBeFalse();
    expect(duplicate.error?.code).toBe("conflict");

    const missing = await harness.backendApi.loginLocalAccount({
      providerSubject: "missing.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(missing.ok).toBeFalse();
    expect(missing.error?.code).toBe("authentication-failed");
  });
});
