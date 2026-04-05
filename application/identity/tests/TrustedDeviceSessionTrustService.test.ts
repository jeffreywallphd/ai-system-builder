import { describe, expect, it } from "bun:test";
import { DeviceTrustStatuses, createTrustedDevice, createDeviceFingerprint, DeviceFingerprintAlgorithms, DevicePairingMethods, createDeviceTrustMaterialRef, DeviceTrustMaterialKinds } from "../../../src/domain/identity/TrustedDeviceDomain";
import type { TrustedDevice } from "../../../src/domain/identity/TrustedDeviceDomain";
import { TrustedDeviceSessionTrustService } from "../services/TrustedDeviceSessionTrustService";
import type { ITrustedDeviceRepository } from "../ports/ITrustedDeviceRepository";
import { createSession, IdentitySessionAccessChannels } from "../../../src/domain/identity/IdentityDomain";
import { IdentityErrorCodes, identityFailure, type IdentityMutationOutcome, type IdentityOperationResult, type TrustedDeviceListQuery, type TrustedDeviceLookupByFingerprintQuery, type TrustedDeviceRevocationRequest } from "../../contracts/IdentityApplicationContracts";

class InMemoryTrustedDeviceRepository implements ITrustedDeviceRepository {
  private readonly devices = new Map<string, TrustedDevice>();

  public async createTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    this.devices.set(device.id, device);
    return device;
  }

  public async getTrustedDeviceById(trustedDeviceId: string): Promise<TrustedDevice | undefined> {
    return this.devices.get(trustedDeviceId.trim());
  }

  public async findTrustedDeviceByFingerprint(query: TrustedDeviceLookupByFingerprintQuery): Promise<TrustedDevice | undefined> {
    return [...this.devices.values()].find((device) => (
      device.userIdentityId === query.userIdentityId
      && device.fingerprint.algorithm === query.fingerprint.algorithm
      && device.fingerprint.value === query.fingerprint.value
    ));
  }

  public async listTrustedDevices(query: TrustedDeviceListQuery): Promise<ReadonlyArray<TrustedDevice>> {
    return Object.freeze([...this.devices.values()].filter((device) => device.userIdentityId === query.userIdentityId));
  }

  public async updateTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    this.devices.set(device.id, device);
    return device;
  }

  public async revokeTrustedDevice(
    _request: TrustedDeviceRevocationRequest,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, "invalid-request" | "invalid-state" | "not-found">> {
    return identityFailure({
      code: IdentityErrorCodes.invalidRequest,
      message: "unused",
      boundary: "infrastructure",
      retryable: false,
    });
  }
}

function trustedDevice(userIdentityId: string, trustedDeviceId: string, trustStatus = DeviceTrustStatuses.trusted): TrustedDevice {
  return createTrustedDevice({
    id: trustedDeviceId,
    userIdentityId,
    displayName: "Trusted Device",
    fingerprint: createDeviceFingerprint({
      algorithm: DeviceFingerprintAlgorithms.sha256,
      value: `fp:${trustedDeviceId}`,
      capturedAt: "2026-04-04T17:59:00.000Z",
    }),
    pairingMethod: DevicePairingMethods.oneTimeCode,
    trustStatus,
    trustMaterialRef: trustStatus === DeviceTrustStatuses.trusted
      ? createDeviceTrustMaterialRef({
          materialId: `material:${trustedDeviceId}`,
          kind: DeviceTrustMaterialKinds.sessionSigningKey,
          issuedAt: "2026-04-04T17:59:00.000Z",
          expiresAt: "2026-04-05T17:59:00.000Z",
        })
      : undefined,
    registeredAt: "2026-04-04T17:58:00.000Z",
    pairedAt: trustStatus === DeviceTrustStatuses.trusted ? "2026-04-04T17:59:00.000Z" : undefined,
    updatedAt: "2026-04-04T18:00:00.000Z",
  });
}

describe("TrustedDeviceSessionTrustService", () => {
  it("binds issued sessions to trusted devices when trust validation succeeds", async () => {
    const repository = new InMemoryTrustedDeviceRepository();
    await repository.createTrustedDevice(trustedDevice("user:1", "trusted-device:alpha"));
    const service = new TrustedDeviceSessionTrustService({
      trustedDeviceRepository: repository,
      policies: {
        desktop: "allow-pairing",
        thinClient: "allow-untrusted",
      },
    });

    const resolved = await service.resolveSessionIssuanceTrust({
      userIdentityId: "user:1",
      accessChannel: IdentitySessionAccessChannels.thinClient,
      requestedTrustRequirement: "require-trusted",
      client: {
        trustedDeviceBindingId: "trusted-device:alpha",
      },
      evaluatedAt: "2026-04-04T18:00:00.000Z",
    });

    expect(resolved.allowed).toBeTrue();
    if (!resolved.allowed) {
      throw new Error("Expected trust binding to succeed.");
    }
    expect(resolved.trustedDeviceBindingId).toBe("trusted-device:alpha");
    expect(resolved.deviceTrustContext?.sessionAssuranceLevel).toBe("authenticated-trusted");
  });

  it("denies issuance when trusted sessions are required but device trust is missing", async () => {
    const repository = new InMemoryTrustedDeviceRepository();
    const service = new TrustedDeviceSessionTrustService({
      trustedDeviceRepository: repository,
      policies: {
        desktop: "allow-pairing",
        thinClient: "allow-untrusted",
      },
    });

    const resolved = await service.resolveSessionIssuanceTrust({
      userIdentityId: "user:1",
      accessChannel: IdentitySessionAccessChannels.thinClient,
      requestedTrustRequirement: "require-trusted",
      client: {
        trustedDeviceBindingId: "trusted-device:missing",
      },
      evaluatedAt: "2026-04-04T18:00:00.000Z",
    });

    expect(resolved.allowed).toBeFalse();
  });

  it("rejects active sessions when trusted device binding is revoked", async () => {
    const repository = new InMemoryTrustedDeviceRepository();
    await repository.createTrustedDevice(trustedDevice("user:1", "trusted-device:revoked", DeviceTrustStatuses.revoked));
    const service = new TrustedDeviceSessionTrustService({
      trustedDeviceRepository: repository,
      policies: {
        desktop: "allow-pairing",
        thinClient: "allow-untrusted",
      },
    });

    const session = createSession({
      id: "identity-session:1",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "user",
      issuedAt: new Date("2026-04-04T18:00:00.000Z"),
      expiresAt: new Date("2026-04-05T18:00:00.000Z"),
      client: {
        accessChannel: IdentitySessionAccessChannels.thinClient,
        trustedDeviceBindingId: "trusted-device:revoked",
      },
    });

    const evaluated = await service.evaluateSessionTrust({
      session,
      evaluatedAt: "2026-04-04T18:05:00.000Z",
    });

    expect(evaluated.allowed).toBeFalse();
    if (evaluated.allowed) {
      throw new Error("Expected trust evaluation to fail.");
    }
    expect(evaluated.invalidationReasons).toEqual(["trusted-device-revoked"]);
  });
});
