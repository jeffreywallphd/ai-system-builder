import { describe, expect, it } from "bun:test";
import { DeviceTrustMaterialKinds } from "../TrustedDeviceDomain";
import {
  PairingSessionLifecycleTransitionError,
  PairingSessionRejectionReasons,
  PairingSessionStatuses,
  PairingTokenActorScopes,
  PairingTokenArtifactTypes,
  PairingTokenInvalidationReasons,
  PairingTokenLifecycleTransitionError,
  PairingTokenStatuses,
  TrustedDevicePairingDomainError,
  completePairingSession,
  consumePairingToken,
  createPairingSession,
  createPairingToken,
  expirePairingToken,
  invalidatePairingToken,
  markPairingSessionValidated,
  registerPairingTokenFailedAttempt,
  rejectPairingSession,
} from "../TrustedDevicePairingDomain";

describe("TrustedDevicePairingDomain", () => {
  it("enforces single-use pairing tokens through explicit consumption lifecycle rules", () => {
    const token = createPairingToken({
      id: "pairing-token:1",
      pairingSessionId: "pairing-session:1",
      trustedDeviceId: "trusted-device:1",
      userIdentityId: "user:1",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: "hash:1",
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:1",
      },
      issuedAt: "2026-04-04T12:00:00.000Z",
      expiresAt: "2026-04-04T12:05:00.000Z",
    });

    const consumed = consumePairingToken(token, {
      consumedAt: "2026-04-04T12:01:00.000Z",
      consumedByUserIdentityId: "user:1",
    });

    expect(consumed.status).toBe(PairingTokenStatuses.consumed);
    expect(consumed.consumed?.consumedByUserIdentityId).toBe("user:1");
    expect(() => consumePairingToken(consumed)).toThrow(TrustedDevicePairingDomainError);
    expect(() => invalidatePairingToken(consumed, {
      reason: PairingTokenInvalidationReasons.tokenReused,
    })).toThrow(PairingTokenLifecycleTransitionError);
  });

  it("enforces pairing token expiration and validation attempt invalidation boundaries", () => {
    const token = createPairingToken({
      id: "pairing-token:2",
      pairingSessionId: "pairing-session:2",
      trustedDeviceId: "trusted-device:2",
      userIdentityId: "user:2",
      artifactType: PairingTokenArtifactTypes.qrPayload,
      tokenHash: "hash:2",
      actorBinding: {
        scope: PairingTokenActorScopes.sessionBound,
        sessionId: "session:2",
      },
      issuedAt: "2026-04-04T12:00:00.000Z",
      expiresAt: "2026-04-04T12:05:00.000Z",
      attempts: {
        maxValidationAttempts: 2,
      },
    });

    const failedOnce = registerPairingTokenFailedAttempt(token, {
      attemptedAt: "2026-04-04T12:01:00.000Z",
    });
    expect(failedOnce.attempts.failedValidationAttempts).toBe(1);
    expect(failedOnce.status).toBe(PairingTokenStatuses.issued);

    const failedTwice = registerPairingTokenFailedAttempt(failedOnce, {
      attemptedAt: "2026-04-04T12:02:00.000Z",
      invalidatedByUserIdentityId: "user:2",
      note: "Too many attempts",
    });
    expect(failedTwice.status).toBe(PairingTokenStatuses.invalidated);
    expect(failedTwice.invalidation?.reason).toBe(PairingTokenInvalidationReasons.attemptLimitReached);

    const expirable = createPairingToken({
      id: "pairing-token:2b",
      pairingSessionId: "pairing-session:2b",
      trustedDeviceId: "trusted-device:2",
      userIdentityId: "user:2",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: "hash:2b",
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:2",
      },
      issuedAt: "2026-04-04T12:00:00.000Z",
      expiresAt: "2026-04-04T12:03:00.000Z",
    });
    expect(() => expirePairingToken(expirable, new Date("2026-04-04T12:02:00.000Z"))).toThrow("expiresAt");

    const expired = expirePairingToken(expirable, new Date("2026-04-04T12:03:00.000Z"));
    expect(expired.status).toBe(PairingTokenStatuses.expired);
    expect(() => consumePairingToken(expired)).toThrow(TrustedDevicePairingDomainError);
  });

  it("completes pairing sessions only with consumed tokens and supports pinned trust material registration", () => {
    const token = consumePairingToken(createPairingToken({
      id: "pairing-token:3",
      pairingSessionId: "pairing-session:3",
      trustedDeviceId: "trusted-device:3",
      userIdentityId: "user:3",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: "hash:3",
      actorBinding: {
        scope: PairingTokenActorScopes.workspaceAdmin,
        userIdentityId: "admin:3",
      },
      issuedAt: "2026-04-04T12:00:00.000Z",
      expiresAt: "2026-04-04T12:05:00.000Z",
    }), {
      consumedAt: "2026-04-04T12:01:00.000Z",
    });

    const initiated = createPairingSession({
      id: "pairing-session:3",
      trustedDeviceId: "trusted-device:3",
      userIdentityId: "user:3",
      pairingTokenId: token.id,
      initiatedAt: "2026-04-04T12:00:00.000Z",
    });
    const validated = markPairingSessionValidated(initiated, {
      validatedAt: "2026-04-04T12:01:30.000Z",
    });
    const completed = completePairingSession(validated, token, {
      completedAt: "2026-04-04T12:02:00.000Z",
      completedByUserIdentityId: "user:3",
      trustMaterialRegistration: {
        materialKind: DeviceTrustMaterialKinds.sessionSigningKey,
        pinReference: "pin:ref:3",
        publicKeyFingerprint: "fingerprint:pub:3",
      },
    });

    expect(completed.status).toBe(PairingSessionStatuses.completed);
    expect(completed.completion?.trustMaterialRegistration?.pinReference).toBe("pin:ref:3");
    expect(() => rejectPairingSession(completed, {
      reason: PairingSessionRejectionReasons.tokenReused,
    })).toThrow(PairingSessionLifecycleTransitionError);

    const unconsumed = createPairingToken({
      id: "pairing-token:3b",
      pairingSessionId: "pairing-session:3b",
      trustedDeviceId: "trusted-device:3b",
      userIdentityId: "user:3",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: "hash:3b",
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:3",
      },
      issuedAt: "2026-04-04T12:00:00.000Z",
      expiresAt: "2026-04-04T12:05:00.000Z",
    });
    const unconsumedSession = createPairingSession({
      id: "pairing-session:3b",
      trustedDeviceId: "trusted-device:3b",
      userIdentityId: "user:3",
      pairingTokenId: "pairing-token:3b",
      initiatedAt: "2026-04-04T12:00:00.000Z",
    });
    expect(() => completePairingSession(unconsumedSession, unconsumed, {
      completedAt: "2026-04-04T12:01:00.000Z",
    })).toThrow("consumed pairing token");
  });
});
