import { describe, expect, it } from "bun:test";
import {
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceRevocationReasons,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  TrustedDeviceDomainError,
  TrustedDeviceLifecycleTransitionError,
  TrustedDeviceLifecycleTransitions,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
  expireTrustedDevice,
  isTrustedDeviceTransitionAllowed,
  pairTrustedDevice,
  revokeTrustedDevice,
  touchTrustedDevice,
  updateTrustedDeviceDisplayName,
} from "../TrustedDeviceDomain";

describe("TrustedDeviceDomain", () => {
  it("creates pending trusted-device entities with explicit identity/workspace association", () => {
    const device = createTrustedDevice({
      id: "trusted-device:1",
      userIdentityId: "user:1",
      workspaceId: "workspace:alpha",
      displayName: "Jeff's MacBook Pro",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "ab12cd34",
        capturedAt: "2026-04-04T12:00:00.000Z",
      }),
      pairingMethod: DevicePairingMethods.qrCode,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      registeredAt: "2026-04-04T12:00:00.000Z",
      metadata: {
        platform: "desktop",
        osVersion: "macOS 14",
      },
    });

    expect(device.workspaceId).toBe("workspace:alpha");
    expect(device.trustStatus).toBe(DeviceTrustStatuses.pendingPairing);
    expect(device.pairedAt).toBeUndefined();
  });

  it("requires trust material and pairing timestamp before a device can be trusted", () => {
    expect(() => createTrustedDevice({
      id: "trusted-device:2",
      userIdentityId: "user:1",
      displayName: "Studio Laptop",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha512,
        value: "zz99yy88",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.trusted,
      registeredAt: "2026-04-04T12:00:00.000Z",
    })).toThrow("trustMaterialRef");
  });

  it("pairs pending devices and records trust material references", () => {
    const pending = createTrustedDevice({
      id: "trusted-device:3",
      userIdentityId: "user:3",
      displayName: "Workstation",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fprint-3",
      }),
      pairingMethod: DevicePairingMethods.passkey,
      registeredAt: "2026-04-04T12:00:00.000Z",
    });

    const trustMaterial = createDeviceTrustMaterialRef({
      materialId: "trust-material:3",
      kind: DeviceTrustMaterialKinds.attestationKey,
      version: "v1",
      issuedAt: "2026-04-04T12:01:00.000Z",
      expiresAt: "2026-07-04T12:01:00.000Z",
    });

    const paired = pairTrustedDevice(pending, {
      trustMaterialRef: trustMaterial,
      pairedAt: "2026-04-04T12:02:00.000Z",
      now: new Date("2026-04-04T12:02:00.000Z"),
    });

    expect(paired.trustStatus).toBe(DeviceTrustStatuses.trusted);
    expect(paired.trustMaterialRef?.materialId).toBe("trust-material:3");
    expect(paired.pairedAt).toBe("2026-04-04T12:02:00.000Z");

    const revoked = revokeTrustedDevice(paired, {
      reason: DeviceRevocationReasons.userRequest,
      revokedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(() => pairTrustedDevice(revoked, {
      trustMaterialRef: trustMaterial,
    })).toThrow(TrustedDeviceLifecycleTransitionError);
  });

  it("tracks revocation and blocks last-seen updates for revoked devices", () => {
    const paired = createTrustedDevice({
      id: "trusted-device:4",
      userIdentityId: "user:4",
      displayName: "Admin iPad",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.opaque,
        value: "opaque-device-4",
      }),
      pairingMethod: DevicePairingMethods.adminProvisioned,
      trustStatus: DeviceTrustStatuses.trusted,
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "trust-material:4",
        kind: DeviceTrustMaterialKinds.opaqueMarker,
      }),
      registeredAt: "2026-04-04T12:00:00.000Z",
      pairedAt: "2026-04-04T12:00:10.000Z",
    });

    const revoked = revokeTrustedDevice(paired, {
      reason: DeviceRevocationReasons.adminAction,
      revokedAt: "2026-04-04T13:00:00.000Z",
      revokedByUserIdentityId: "admin:user:1",
      note: "Security review",
    });

    expect(revoked.revocation?.reason).toBe(DeviceRevocationReasons.adminAction);
    expect(() => touchTrustedDevice(revoked, {
      seenAt: "2026-04-04T14:00:00.000Z",
    })).toThrow(TrustedDeviceDomainError);
  });

  it("enforces display-name, lifecycle transition, and timestamp invariants", () => {
    expect(() => createTrustedDevice({
      id: "trusted-device:5",
      userIdentityId: "user:5",
      displayName: "x".repeat(81),
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fprint-5",
      }),
      pairingMethod: DevicePairingMethods.recoveryFlow,
      registeredAt: "2026-04-04T12:00:00.000Z",
    })).toThrow("80 characters");

    const pending = createTrustedDevice({
      id: "trusted-device:6",
      userIdentityId: "user:6",
      displayName: "Phone",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fprint-6",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      registeredAt: "2026-04-04T12:00:00.000Z",
    });

    expect(TrustedDeviceLifecycleTransitions[DeviceTrustStatuses.pendingPairing]).toEqual([
      DeviceTrustStatuses.trusted,
      DeviceTrustStatuses.revoked,
      DeviceTrustStatuses.expired,
    ]);
    expect(isTrustedDeviceTransitionAllowed(DeviceTrustStatuses.expired, DeviceTrustStatuses.pendingPairing)).toBeTrue();
    expect(isTrustedDeviceTransitionAllowed(DeviceTrustStatuses.trusted, DeviceTrustStatuses.pendingPairing)).toBeFalse();

    const expired = expireTrustedDevice(pending, new Date("2026-04-04T13:00:00.000Z"));
    expect(expired.trustStatus).toBe(DeviceTrustStatuses.expired);

    expect(() => touchTrustedDevice(
      updateTrustedDeviceDisplayName(expired, "Primary Phone"),
      { seenAt: "2026-04-04T11:59:59.000Z" },
    )).toThrow("lastSeenAt");
  });
});
