import { describe, expect, it } from "bun:test";
import { SessionRevocationReasons, revokeSession } from "../../../../src/domain/identity/IdentityDomain";
import { createIdentityAuthTestHarness } from "./TestIdentityAuthHarness";
import type {
  IdentityAuthAuditEvent,
  IdentityAuthAuditEventSink,
  IdentityAuthObservabilityLogEvent,
  IdentityAuthObservabilityLogger,
} from "../IdentityAuthObservability";

class CapturingObservabilityLogger implements IdentityAuthObservabilityLogger {
  public readonly infoEvents: IdentityAuthObservabilityLogEvent[] = [];
  public readonly warnEvents: IdentityAuthObservabilityLogEvent[] = [];
  public readonly errorEvents: IdentityAuthObservabilityLogEvent[] = [];

  public info(event: IdentityAuthObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: IdentityAuthObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: IdentityAuthObservabilityLogEvent): void {
    this.errorEvents.push(event);
  }
}

class CapturingAuditEventSink implements IdentityAuthAuditEventSink {
  public readonly events: IdentityAuthAuditEvent[] = [];

  public emit(event: IdentityAuthAuditEvent): void {
    this.events.push(event);
  }
}

class ThrowingAuditEventSink implements IdentityAuthAuditEventSink {
  public emit(_event: IdentityAuthAuditEvent): void {
    throw new Error("sink offline");
  }
}

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
      client: {
        deviceId: "device:alpha",
        trustedDeviceBindingId: "trusted-device:alpha",
        trustMarker: "marker:alpha",
      },
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(loggedIn.ok).toBeTrue();
    expect(loggedIn.data?.userIdentityId).toBe(registered.data?.userIdentityId);
    expect(loggedIn.data?.username).toBe("valid.user");
    expect(loggedIn.data?.authenticatedAt).toBe("2026-04-04T18:00:00.000Z");
    expect(loggedIn.data?.sessionId).toBeDefined();
    expect(loggedIn.data?.sessionToken).toBeDefined();
    expect(loggedIn.data?.sessionTokenType).toBe("Bearer");
    expect(loggedIn.data?.sessionAccessChannel).toBe("thin-client");
    expect(loggedIn.data?.sessionDeviceId).toBe("device:alpha");
    expect(loggedIn.data?.sessionTrustedDeviceBindingId).toBe("trusted-device:alpha");
    expect(loggedIn.data?.sessionTrustMarker).toBe("marker:alpha");
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

  it("resolves authenticated principal context and rejects expired or revoked sessions", async () => {
    const harness = await createIdentityAuthTestHarness();

    const register = await harness.backendApi.registerLocalAccount({
      username: "session.validation.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(register.ok).toBeTrue();

    const login = await harness.backendApi.loginLocalAccount({
      providerSubject: "session.validation.user",
      client: {
        deviceId: "device:resolve",
        trustedDeviceBindingId: "trusted-device:resolve",
        trustMarker: "marker:resolve",
      },
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(login.ok).toBeTrue();
    if (!login.ok) {
      throw new Error("Expected login success.");
    }
    const loginData = login.data;
    if (!loginData) {
      throw new Error("Expected login response payload.");
    }

    const resolved = await harness.backendApi.resolveAuthenticatedSession({
      sessionToken: loginData.sessionToken,
    });
    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) {
      throw new Error("Expected authenticated session resolution success.");
    }
    const resolvedData = resolved.data;
    if (!resolvedData) {
      throw new Error("Expected resolved authenticated session payload.");
    }
    expect(resolvedData.principal.username).toBe("session.validation.user");
    expect(resolvedData.session.sessionId).toBe(loginData.sessionId);
    expect(resolvedData.session.deviceId).toBe("device:resolve");
    expect(resolvedData.session.trustedDeviceBindingId).toBe("trusted-device:resolve");
    expect(resolvedData.session.trustMarker).toBe("marker:resolve");

    harness.adapter.setNow("2026-04-05T18:30:00.000Z");
    const expired = await harness.backendApi.resolveAuthenticatedSession({
      sessionToken: loginData.sessionToken,
    });
    expect(expired.ok).toBeFalse();
    expect(expired.error?.code).toBe("authentication-failed");

    const secondLogin = await harness.backendApi.loginLocalAccount({
      providerSubject: "session.validation.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(secondLogin.ok).toBeTrue();
    if (!secondLogin.ok) {
      throw new Error("Expected second login success.");
    }
    const secondLoginData = secondLogin.data;
    if (!secondLoginData) {
      throw new Error("Expected second login payload.");
    }

    const session = await harness.adapter.getSessionById(secondLoginData.sessionId);
    if (!session) {
      throw new Error("Expected persisted session for revocation test.");
    }

    await harness.adapter.saveSession(revokeSession(session, SessionRevocationReasons.security, harness.adapter.now()));
    const revoked = await harness.backendApi.resolveAuthenticatedSession({
      sessionToken: secondLoginData.sessionToken,
    });
    expect(revoked.ok).toBeFalse();
    expect(revoked.error?.code).toBe("authentication-failed");
  });

  it("supports explicit logout and authenticated session revocation flows", async () => {
    const harness = await createIdentityAuthTestHarness();

    const register = await harness.backendApi.registerLocalAccount({
      username: "logout.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(register.ok).toBeTrue();

    const login = await harness.backendApi.loginLocalAccount({
      providerSubject: "logout.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(login.ok).toBeTrue();
    if (!login.ok || !login.data) {
      throw new Error("Expected login success.");
    }

    const logout = await harness.backendApi.logoutAuthenticatedSession({
      sessionToken: login.data.sessionToken,
    });
    expect(logout.ok).toBeTrue();
    expect(logout.data?.sessionId).toBe(login.data.sessionId);
    expect(logout.data?.revocationReason).toBe("logout");

    const postLogoutResolve = await harness.backendApi.resolveAuthenticatedSession({
      sessionToken: login.data.sessionToken,
    });
    expect(postLogoutResolve.ok).toBeFalse();
    expect(postLogoutResolve.error?.code).toBe("authentication-failed");

    const secondLogin = await harness.backendApi.loginLocalAccount({
      providerSubject: "logout.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(secondLogin.ok).toBeTrue();
    if (!secondLogin.ok || !secondLogin.data) {
      throw new Error("Expected second login success.");
    }

    const revoke = await harness.backendApi.revokeIdentitySession({
      actorUserIdentityId: secondLogin.data.userIdentityId,
      sessionId: secondLogin.data.sessionId,
      reason: "security",
    });
    expect(revoke.ok).toBeTrue();
    expect(revoke.data?.sessionId).toBe(secondLogin.data.sessionId);
    expect(revoke.data?.revocationReason).toBe("security");

    const postRevokeResolve = await harness.backendApi.resolveAuthenticatedSession({
      sessionToken: secondLogin.data.sessionToken,
    });
    expect(postRevokeResolve.ok).toBeFalse();
    expect(postRevokeResolve.error?.code).toBe("authentication-failed");
  });

  it("supports local account administration list/read/status-change flows", async () => {
    const harness = await createIdentityAuthTestHarness();

    const register = await harness.backendApi.registerLocalAccount({
      username: "admin.managed.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(register.ok).toBeTrue();

    const login = await harness.backendApi.loginLocalAccount({
      providerSubject: "admin.managed.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(login.ok).toBeTrue();
    if (!login.ok || !login.data) {
      throw new Error("Expected login success.");
    }

    const list = await harness.backendApi.listIdentityAdminAccounts({
      context: {
        actorUserIdentityId: "user:admin",
      },
    });
    expect(list.ok).toBeTrue();
    expect(list.data?.accounts.some((account) => account.userIdentityId === register.data?.userIdentityId)).toBeTrue();

    const getStatus = await harness.backendApi.getIdentityAdminAccountStatus({
      context: {
        actorUserIdentityId: "user:admin",
      },
      userIdentityId: register.data!.userIdentityId,
    });
    expect(getStatus.ok).toBeTrue();
    expect(getStatus.data?.account.activeSessionCount).toBe(1);

    const disable = await harness.backendApi.setIdentityAdminAccountStatus({
      context: {
        actorUserIdentityId: "user:admin",
      },
      userIdentityId: register.data!.userIdentityId,
      action: "disable",
    });
    expect(disable.ok).toBeTrue();
    expect(disable.data?.status).toBe("suspended");
    expect(disable.data?.affectedSessionIds).toEqual([login.data.sessionId]);

    const afterDisable = await harness.backendApi.loginLocalAccount({
      providerSubject: "admin.managed.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(afterDisable.ok).toBeFalse();
    expect(afterDisable.error?.code).toBe("account-inactive");

    const resolveDisabledSession = await harness.backendApi.resolveAuthenticatedSession({
      sessionToken: login.data.sessionToken,
    });
    expect(resolveDisabledSession.ok).toBeFalse();
    expect(resolveDisabledSession.error?.code).toBe("authentication-failed");
  });

  it("emits structured redacted observability events for register/login success and failure", async () => {
    const logger = new CapturingObservabilityLogger();
    const auditEventSink = new CapturingAuditEventSink();
    const harness = await createIdentityAuthTestHarness({
      observability: {
        logger,
        auditEventSink,
      },
    });

    const register = await harness.backendApi.registerLocalAccount({
      username: "obs.user",
      email: "obs.user@example.com",
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(register.ok).toBeTrue();

    const failedLogin = await harness.backendApi.loginLocalAccount({
      providerSubject: "missing.user",
      credential: {
        candidate: "LeakySecret!2026",
      },
    });

    expect(failedLogin.ok).toBeFalse();

    expect(logger.infoEvents.length).toBeGreaterThanOrEqual(1);
    expect(logger.warnEvents.length).toBeGreaterThanOrEqual(1);

    const serializedLogs = JSON.stringify({
      info: logger.infoEvents,
      warn: logger.warnEvents,
      error: logger.errorEvents,
    });
    expect(serializedLogs.includes("StrongPass!2026")).toBeFalse();
    expect(serializedLogs.includes("LeakySecret!2026")).toBeFalse();
    expect(serializedLogs.includes("[REDACTED]")).toBeTrue();

    expect(auditEventSink.events.length).toBe(2);
    expect(auditEventSink.events[0]?.type).toBe("identity-auth.local.register");
    expect(auditEventSink.events[0]?.outcome).toBe("success");
    expect(auditEventSink.events[1]?.type).toBe("identity-auth.local.login");
    expect(auditEventSink.events[1]?.outcome).toBe("failure");

    const serializedAuditEvents = JSON.stringify(auditEventSink.events);
    expect(serializedAuditEvents.includes("StrongPass!2026")).toBeFalse();
    expect(serializedAuditEvents.includes("LeakySecret!2026")).toBeFalse();
    expect(serializedAuditEvents.includes("[REDACTED]")).toBeTrue();
  });

  it("does not fail auth flow when audit sink emission fails", async () => {
    const logger = new CapturingObservabilityLogger();
    const harness = await createIdentityAuthTestHarness({
      observability: {
        logger,
        auditEventSink: new ThrowingAuditEventSink(),
      },
    });

    const register = await harness.backendApi.registerLocalAccount({
      username: "sink.failure.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(register.ok).toBeTrue();
    const serializedErrors = JSON.stringify(logger.errorEvents);
    expect(serializedErrors.includes("audit-sink.emit-failed")).toBeTrue();
    expect(serializedErrors.includes("StrongPass!2026")).toBeFalse();
  });
});
