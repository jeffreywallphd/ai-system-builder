import { describe, expect, it } from "bun:test";
import {
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceRevocationReasons,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createTrustedDevice,
  revokeTrustedDevice as revokeTrustedDeviceDomain,
  type TrustedDevice,
} from "../../../domain/identity/TrustedDeviceDomain";
import {
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityIdNamespace,
  type IdentityMutationOutcome,
  type IdentityOperationResult,
  type TrustedDeviceListQuery,
  type TrustedDeviceLookupByFingerprintQuery,
  type TrustedDeviceRevocationRequest,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityLifecycleEventTypes, type IdentityLifecycleEvent } from "../../contracts/IdentityLifecycleEventContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { ITrustedDeviceRepository } from "../ports/ITrustedDeviceRepository";
import { TrustedDeviceManagementService } from "../services/TrustedDeviceManagementService";

class FixedClock implements IIdentityClock {
  public now(): Date {
    return new Date("2026-04-04T12:00:00.000Z");
  }
}

class SequentialIdGenerator implements IIdentityIdGenerator {
  private sequence = 0;

  public nextId(namespace: IdentityIdNamespace): string {
    this.sequence += 1;
    return `${namespace}:${this.sequence}`;
  }
}

class InMemoryTrustedDeviceRepository implements ITrustedDeviceRepository {
  private readonly devices = new Map<string, TrustedDevice>();

  public async createTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    this.devices.set(device.id, device);
    return device;
  }

  public async getTrustedDeviceById(trustedDeviceId: string): Promise<TrustedDevice | undefined> {
    return this.devices.get(trustedDeviceId.trim());
  }

  public async findTrustedDeviceByFingerprint(
    query: TrustedDeviceLookupByFingerprintQuery,
  ): Promise<TrustedDevice | undefined> {
    return [...this.devices.values()].find((device) => (
      device.userIdentityId === query.userIdentityId
      && device.fingerprint.algorithm === query.fingerprint.algorithm
      && device.fingerprint.value === query.fingerprint.value
    ));
  }

  public async listTrustedDevices(query: TrustedDeviceListQuery): Promise<ReadonlyArray<TrustedDevice>> {
    return Object.freeze(
      [...this.devices.values()].filter((device) => device.userIdentityId === query.userIdentityId),
    );
  }

  public async updateTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    this.devices.set(device.id, device);
    return device;
  }

  public async revokeTrustedDevice(
    request: TrustedDeviceRevocationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    const existing = this.devices.get(request.trustedDeviceId);
    if (!existing) {
      return identityFailure({
        code: IdentityErrorCodes.notFound,
        message: "not found",
        boundary: "infrastructure",
        retryable: false,
      });
    }

    const revoked = revokeTrustedDeviceDomain(existing, {
      reason: request.reason,
      revokedByUserIdentityId: request.revokedByUserIdentityId,
      note: request.note,
      revokedAt: request.revokedAt ?? "2026-04-04T12:00:00.000Z",
      now: new Date(request.revokedAt ?? "2026-04-04T12:00:00.000Z"),
    });
    this.devices.set(existing.id, revoked);
    return identitySuccess({ changed: true });
  }
}

describe("TrustedDeviceManagementService audit events", () => {
  it("emits revocation and trust-status-change events on successful revocation", async () => {
    const repository = new InMemoryTrustedDeviceRepository();
    const events: IdentityLifecycleEvent[] = [];
    const service = new TrustedDeviceManagementService(
      repository,
      new SequentialIdGenerator(),
      new FixedClock(),
      {
        publish: async (event) => {
          events.push(event);
        },
      },
    );

    await repository.createTrustedDevice(createTrustedDevice({
      id: "trusted-device:revoke",
      userIdentityId: "user:revoke",
      displayName: "Revoked Device",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fingerprint:revoke",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.trusted,
      registeredAt: "2026-04-04T11:58:00.000Z",
      pairedAt: "2026-04-04T11:59:00.000Z",
      updatedAt: "2026-04-04T11:59:00.000Z",
    }));

    const result = await service.revokeTrustedDevice({
      trustedDeviceId: "trusted-device:revoke",
      reason: DeviceRevocationReasons.userRequest,
      revokedByUserIdentityId: "user:revoke",
      revokedAt: "2026-04-04T12:00:00.000Z",
    });
    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful revocation.");
    }

    expect(events.some((event) => event.eventType === IdentityLifecycleEventTypes.trustedDeviceRevoked)).toBeTrue();
    expect(events.some((event) => event.eventType === IdentityLifecycleEventTypes.trustedDeviceTrustStatusChanged)).toBeTrue();
  });
});
