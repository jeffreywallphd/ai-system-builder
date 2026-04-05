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
    if (!registered.data?.userIdentityId) {
      throw new Error("Expected registered user id.");
    }
    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:alpha",
      userIdentityId: registered.data.userIdentityId,
    });

    const loggedIn = await harness.backendApi.loginLocalAccount({
      providerSubject: "valid.user",
      client: {
        deviceId: "device:alpha",
        deviceTrustContext: {
          trustedDeviceId: "trusted-device:alpha",
          issuedOnTrustedDevice: true,
          sessionAssuranceLevel: "authenticated-trusted",
          trustStateSnapshot: {
            state: "trusted",
            evaluatedAt: "2026-04-04T18:00:00.000Z",
          },
          invalidationReasons: [],
        },
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
    expect(loggedIn.data?.sessionDeviceTrustContext?.trustedDeviceId).toBe("trusted-device:alpha");
    expect(loggedIn.data?.sessionDeviceTrustContext?.sessionAssuranceLevel).toBe("authenticated-trusted");
    expect(loggedIn.data?.sessionDeviceTrustContext?.trustStateSnapshot?.state).toBe("trusted");
    expect(loggedIn.data?.sessionTrustedDeviceBindingId).toBe("trusted-device:alpha");
    expect(loggedIn.data?.sessionTrustMarker?.startsWith("trusted-device:trusted-device:alpha|material:")).toBeTrue();
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

  it("denies login when trusted-device issuance is required but trust binding is missing", async () => {
    const harness = await createIdentityAuthTestHarness();

    const register = await harness.backendApi.registerLocalAccount({
      username: "trusted.required.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(register.ok).toBeTrue();

    const denied = await harness.backendApi.loginLocalAccount({
      providerSubject: "trusted.required.user",
      sessionTrustRequirement: "require-trusted",
      client: {
        trustedDeviceBindingId: "trusted-device:missing",
      },
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(denied.ok).toBeFalse();
    expect(denied.error?.code).toBe("authentication-failed");
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
    if (!register.ok || !register.data?.userIdentityId) {
      throw new Error("Expected register payload.");
    }
    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:resolve",
      userIdentityId: register.data.userIdentityId,
    });

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
    expect(resolvedData.session.deviceTrustContext?.trustedDeviceId).toBe("trusted-device:resolve");
    expect(resolvedData.session.deviceTrustContext?.sessionAssuranceLevel).toBe("authenticated-trusted");
    expect(resolvedData.session.trustedDeviceBindingId).toBe("trusted-device:resolve");
    expect(resolvedData.session.trustMarker?.startsWith("trusted-device:trusted-device:resolve|material:")).toBeTrue();

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

  it("invalidates trusted-bound sessions when the trusted device is revoked", async () => {
    const harness = await createIdentityAuthTestHarness();

    const register = await harness.backendApi.registerLocalAccount({
      username: "trusted.revoked.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(register.ok).toBeTrue();
    if (!register.ok || !register.data?.userIdentityId) {
      throw new Error("Expected register payload.");
    }

    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:revoked",
      userIdentityId: register.data.userIdentityId,
    });

    const login = await harness.backendApi.loginLocalAccount({
      providerSubject: "trusted.revoked.user",
      sessionTrustRequirement: "require-trusted",
      client: {
        trustedDeviceBindingId: "trusted-device:revoked",
      },
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(login.ok).toBeTrue();
    if (!login.ok || !login.data) {
      throw new Error("Expected login payload.");
    }

    const revokeResult = await harness.adapter.revokeTrustedDevice({
      trustedDeviceId: "trusted-device:revoked",
      reason: "admin-action",
    });
    expect(revokeResult.ok).toBeTrue();

    const resolved = await harness.backendApi.resolveAuthenticatedSession({
      sessionToken: login.data.sessionToken,
    });
    expect(resolved.ok).toBeFalse();
    expect(resolved.error?.code).toBe("authentication-failed");
    expect(resolved.error?.trustFailure?.invalidationReasons).toEqual(["trusted-device-revoked"]);
    expect(resolved.error?.trustFailure?.reason).toContain("revoked");

    const revokedSession = await harness.adapter.getSessionById(login.data.sessionId);
    expect(revokedSession?.status).toBe("revoked");

    const invalidatedTokenMaterial = await harness.adapter.getSessionTokenMaterialBySessionId(login.data.sessionId);
    expect(invalidatedTokenMaterial?.invalidatedAt).toBe("2026-04-04T18:00:00.000Z");
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

  it("changes credentials for an authenticated account and invalidates prior credentials", async () => {
    const harness = await createIdentityAuthTestHarness();

    const register = await harness.backendApi.registerLocalAccount({
      username: "credential.change.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(register.ok).toBeTrue();
    if (!register.ok || !register.data) {
      throw new Error("Expected register success.");
    }

    const change = await harness.backendApi.changeLocalPasswordCredential({
      userIdentityId: register.data.userIdentityId,
      newCredential: {
        candidate: "StrongerPass!2027",
      },
      verification: {
        currentCredential: "StrongPass!2026",
      },
    });
    expect(change.ok).toBeTrue();
    expect(change.data?.userIdentityId).toBe(register.data.userIdentityId);
    expect(change.data?.verificationMode).toBe("current-credential");

    const oldCredentialLogin = await harness.backendApi.loginLocalAccount({
      providerSubject: "credential.change.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(oldCredentialLogin.ok).toBeFalse();
    expect(oldCredentialLogin.error?.code).toBe("authentication-failed");

    const newCredentialLogin = await harness.backendApi.loginLocalAccount({
      providerSubject: "credential.change.user",
      credential: {
        candidate: "StrongerPass!2027",
      },
    });
    expect(newCredentialLogin.ok).toBeTrue();
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

  it("supports trusted-device management and pairing backend flows", async () => {
    const harness = await createIdentityAuthTestHarness();

    const register = await harness.backendApi.registerLocalAccount({
      username: "trusted.device.backend.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(register.ok).toBeTrue();
    if (!register.ok || !register.data) {
      throw new Error("Expected registration payload.");
    }

    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:backend-flow",
      userIdentityId: register.data.userIdentityId,
      trustStatus: "pending-pairing",
    });

    const listed = await harness.backendApi.listTrustedDevices({
      userIdentityId: register.data.userIdentityId,
    });
    expect(listed.ok).toBeTrue();
    expect(listed.data?.devices.some((device) => device.trustedDeviceId === "trusted-device:backend-flow")).toBeTrue();
    expect(listed.data?.devices[0]?.metadata).toBeDefined();

    const detailed = await harness.backendApi.getTrustedDevice({
      trustedDeviceId: "trusted-device:backend-flow",
    });
    expect(detailed.ok).toBeTrue();
    expect(detailed.data?.trustedDevice.trustedDeviceId).toBe("trusted-device:backend-flow");

    const renamed = await harness.backendApi.updateTrustedDeviceDisplayName({
      trustedDeviceId: "trusted-device:backend-flow",
      displayName: "Backend Flow Device",
    });
    expect(renamed.ok).toBeTrue();
    expect(renamed.data?.trustedDevice.displayName).toBe("Backend Flow Device");

    const initiated = await harness.backendApi.initiateTrustedDevicePairing({
      trustedDeviceId: "trusted-device:backend-flow",
      userIdentityId: register.data.userIdentityId,
      artifactType: "one-time-code",
      actorBinding: {
        scope: "same-user",
        userIdentityId: register.data.userIdentityId,
      },
      expiresAt: "2026-04-04T18:30:00.000Z",
    });
    expect(initiated.ok).toBeTrue();
    if (!initiated.ok || !initiated.data) {
      throw new Error("Expected initiated pairing payload.");
    }

    const validated = await harness.backendApi.validateTrustedDevicePairing({
      pairingSessionId: initiated.data.pairingSession.pairingSessionId,
      pairingTokenId: initiated.data.pairingToken.pairingTokenId,
      trustedDeviceId: "trusted-device:backend-flow",
      userIdentityId: register.data.userIdentityId,
      presentedToken: initiated.data.artifact.value,
    });
    expect(validated.ok).toBeTrue();
    expect(validated.data?.outcome).toBe("valid");

    const completed = await harness.backendApi.completeTrustedDevicePairing({
      pairingSessionId: initiated.data.pairingSession.pairingSessionId,
      pairingTokenId: initiated.data.pairingToken.pairingTokenId,
      trustedDeviceId: "trusted-device:backend-flow",
      userIdentityId: register.data.userIdentityId,
      presentedToken: initiated.data.artifact.value,
      trustMaterialRef: {
        materialId: "material:trusted-device:backend-flow",
        kind: "session-signing-key",
        issuedAt: "2026-04-04T18:00:00.000Z",
      },
    });
    expect(completed.ok).toBeTrue();
    expect(completed.data?.trustedDevice.trustStatus).toBe("trusted");

    const revoked = await harness.backendApi.revokeTrustedDevice({
      trustedDeviceId: "trusted-device:backend-flow",
      reason: "user-request",
      revokedByUserIdentityId: register.data.userIdentityId,
    });
    expect(revoked.ok).toBeTrue();
    expect(revoked.data?.revoked).toBeTrue();
  });

  it("supports admin trusted-device oversight with authorization checks", async () => {
    const harness = await createIdentityAuthTestHarness({
      trustedDeviceAdministration: {
        bootstrapAdminUserIdentityIds: ["user-identity:1"],
      },
    });

    const adminRegister = await harness.backendApi.registerLocalAccount({
      username: "trusted.device.admin",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(adminRegister.ok).toBeTrue();
    if (!adminRegister.ok || !adminRegister.data) {
      throw new Error("Expected admin registration payload.");
    }

    const memberRegister = await harness.backendApi.registerLocalAccount({
      username: "trusted.device.member",
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(memberRegister.ok).toBeTrue();
    if (!memberRegister.ok || !memberRegister.data) {
      throw new Error("Expected member registration payload.");
    }

    await harness.provisionTrustedDevice({
      trustedDeviceId: "trusted-device:admin-inspect",
      userIdentityId: memberRegister.data.userIdentityId,
      trustStatus: "trusted",
    });

    const denied = await harness.backendApi.listIdentityAdminTrustedDevices({
      context: {
        actorUserIdentityId: memberRegister.data.userIdentityId,
      },
      userIdentityId: adminRegister.data.userIdentityId,
    });
    expect(denied.ok).toBeFalse();
    expect(denied.error?.code).toBe("forbidden");

    const listed = await harness.backendApi.listIdentityAdminTrustedDevices({
      context: {
        actorUserIdentityId: adminRegister.data.userIdentityId,
      },
      userIdentityId: memberRegister.data.userIdentityId,
    });
    expect(listed.ok).toBeTrue();
    expect(listed.data?.devices.some((device) => device.trustedDeviceId === "trusted-device:admin-inspect")).toBeTrue();

    const revoked = await harness.backendApi.revokeIdentityAdminTrustedDevice({
      context: {
        actorUserIdentityId: adminRegister.data.userIdentityId,
      },
      trustedDeviceId: "trusted-device:admin-inspect",
      reason: "admin-action",
    });
    expect(revoked.ok).toBeTrue();
    expect(revoked.data?.revoked).toBeTrue();
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
    const successfulLogin = await harness.backendApi.loginLocalAccount({
      providerSubject: "obs.user",
      client: {
        trustedDeviceBindingId: "trusted-device:redaction",
        trustMarker: "marker:redaction",
      },
      credential: {
        candidate: "StrongPass!2026",
      },
    });
    expect(successfulLogin.ok).toBeTrue();
    const credentialChange = successfulLogin.ok && successfulLogin.data
      ? await harness.backendApi.changeLocalPasswordCredential({
        userIdentityId: successfulLogin.data.userIdentityId,
        newCredential: {
          candidate: "AnotherSecret!2027",
        },
        verification: {
          currentCredential: "StrongPass!2026",
        },
      })
      : undefined;
    expect(credentialChange?.ok).toBeTrue();

    expect(logger.infoEvents.length).toBeGreaterThanOrEqual(1);
    expect(logger.warnEvents.length).toBeGreaterThanOrEqual(1);

    const serializedLogs = JSON.stringify({
      info: logger.infoEvents,
      warn: logger.warnEvents,
      error: logger.errorEvents,
    });
    expect(serializedLogs.includes("StrongPass!2026")).toBeFalse();
    expect(serializedLogs.includes("LeakySecret!2026")).toBeFalse();
    expect(serializedLogs.includes("AnotherSecret!2027")).toBeFalse();
    expect(serializedLogs.includes("trusted-device:redaction")).toBeFalse();
    expect(serializedLogs.includes("marker:redaction")).toBeFalse();
    expect(successfulLogin.ok && serializedLogs.includes(successfulLogin.data?.sessionToken ?? "")).toBeFalse();
    expect(serializedLogs.includes("[REDACTED]")).toBeTrue();

    expect(auditEventSink.events.length).toBe(4);
    expect(auditEventSink.events[0]?.type).toBe("identity-auth.local.register");
    expect(auditEventSink.events[0]?.outcome).toBe("success");
    expect(auditEventSink.events[1]?.type).toBe("identity-auth.local.login");
    expect(auditEventSink.events[1]?.outcome).toBe("failure");
    expect(auditEventSink.events[2]?.type).toBe("identity-auth.local.login");
    expect(auditEventSink.events[2]?.outcome).toBe("success");
    expect(auditEventSink.events[3]?.type).toBe("identity-auth.local.credential.change");
    expect(auditEventSink.events[3]?.outcome).toBe("success");

    const serializedAuditEvents = JSON.stringify(auditEventSink.events);
    expect(serializedAuditEvents.includes("StrongPass!2026")).toBeFalse();
    expect(serializedAuditEvents.includes("LeakySecret!2026")).toBeFalse();
    expect(serializedAuditEvents.includes("AnotherSecret!2027")).toBeFalse();
    expect(serializedAuditEvents.includes("trusted-device:redaction")).toBeFalse();
    expect(serializedAuditEvents.includes("marker:redaction")).toBeFalse();
    expect(successfulLogin.ok && serializedAuditEvents.includes(successfulLogin.data?.sessionToken ?? "")).toBeFalse();
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

  it("rejects local registration when disabled by configuration", async () => {
    const harness = await createIdentityAuthTestHarness({
      featurePolicies: {
        allowLocalRegistration: false,
      },
    });

    const response = await harness.backendApi.registerLocalAccount({
      username: "disabled.registration.user",
      credential: {
        candidate: "StrongPass!2026",
      },
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("forbidden");
  });

  it("rejects identity administration operations when disabled by configuration", async () => {
    const harness = await createIdentityAuthTestHarness({
      featurePolicies: {
        allowLocalAdministration: false,
      },
    });

    const list = await harness.backendApi.listIdentityAdminAccounts({
      context: {
        actorUserIdentityId: "user:admin",
      },
    });
    expect(list.ok).toBeFalse();
    expect(list.error?.code).toBe("forbidden");

    const getStatus = await harness.backendApi.getIdentityAdminAccountStatus({
      context: {
        actorUserIdentityId: "user:admin",
      },
      userIdentityId: "user:missing",
    });
    expect(getStatus.ok).toBeFalse();
    expect(getStatus.error?.code).toBe("forbidden");

    const setStatus = await harness.backendApi.setIdentityAdminAccountStatus({
      context: {
        actorUserIdentityId: "user:admin",
      },
      userIdentityId: "user:missing",
      action: "disable",
    });
    expect(setStatus.ok).toBeFalse();
    expect(setStatus.error?.code).toBe("forbidden");

    const listTrustedDevices = await harness.backendApi.listIdentityAdminTrustedDevices({
      context: {
        actorUserIdentityId: "user:admin",
      },
      userIdentityId: "user:missing",
    });
    expect(listTrustedDevices.ok).toBeFalse();
    expect(listTrustedDevices.error?.code).toBe("forbidden");

    const revokeTrustedDevice = await harness.backendApi.revokeIdentityAdminTrustedDevice({
      context: {
        actorUserIdentityId: "user:admin",
      },
      trustedDeviceId: "trusted-device:missing",
      reason: "admin-action",
    });
    expect(revokeTrustedDevice.ok).toBeFalse();
    expect(revokeTrustedDevice.error?.code).toBe("forbidden");
  });
});
