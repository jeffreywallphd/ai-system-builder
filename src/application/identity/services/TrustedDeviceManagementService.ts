import type {
  IdentityMutationOutcome,
  IdentityOperationResult,
  TrustedDeviceDisplayNameUpdate,
  TrustedDeviceLastSeenUpdate,
  TrustedDeviceListQuery,
  TrustedDevicePairingRequest,
  TrustedDeviceRecord,
  TrustedDeviceRegistrationRequest,
  TrustedDeviceRevocationRequest,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityIdNamespaces, IdentityErrorCodes } from "../../contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLifecycleEventPublisher } from "../ports/IIdentityLifecycleEventPublisher";
import type { ITrustedDeviceManagementService } from "../ports/ITrustedDeviceManagementService";
import type { ITrustedDeviceRepository } from "../ports/ITrustedDeviceRepository";
import {
  IdentityLifecycleEventContractVersions,
  IdentityLifecycleEventTypes,
  createIdentityLifecycleEvent,
} from "../../contracts/IdentityLifecycleEventContracts";
import {
  createTrustedDevice,
  pairTrustedDevice,
  touchTrustedDevice,
  updateTrustedDeviceDisplayName,
} from "../../../domain/identity/TrustedDeviceDomain";
import { mapTrustedDeviceRecord } from "./TrustedDeviceServiceMappers";
import { publishIdentityLifecycleEventBestEffort } from "./IdentityLifecycleEventPublishing";

export class TrustedDeviceManagementService implements ITrustedDeviceManagementService {
  public constructor(
    private readonly repository: ITrustedDeviceRepository,
    private readonly idGenerator: IIdentityIdGenerator,
    private readonly clock: IIdentityClock,
    private readonly eventPublisher?: IIdentityLifecycleEventPublisher,
  ) {}

  public async registerTrustedDevice(request: TrustedDeviceRegistrationRequest): Promise<TrustedDeviceRecord> {
    const trustedDevice = createTrustedDevice({
      id: this.idGenerator.nextId(IdentityIdNamespaces.trustedDevice),
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      displayName: request.displayName,
      fingerprint: request.fingerprint,
      pairingMethod: request.pairingMethod,
      registeredAt: request.registeredAt ?? this.clock.now(),
      metadata: request.metadata,
    });

    const created = await this.repository.createTrustedDevice(trustedDevice);
    return mapTrustedDeviceRecord(created);
  }

  public async getTrustedDeviceById(trustedDeviceId: string): Promise<TrustedDeviceRecord | undefined> {
    const trustedDevice = await this.repository.getTrustedDeviceById(trustedDeviceId);
    return trustedDevice ? mapTrustedDeviceRecord(trustedDevice) : undefined;
  }

  public async listTrustedDevices(query: TrustedDeviceListQuery): Promise<ReadonlyArray<TrustedDeviceRecord>> {
    const devices = await this.repository.listTrustedDevices(query);
    return Object.freeze(devices.map((trustedDevice) => mapTrustedDeviceRecord(trustedDevice)));
  }

  public async pairTrustedDevice(request: TrustedDevicePairingRequest): Promise<TrustedDeviceRecord> {
    const trustedDevice = await this.repository.getTrustedDeviceById(request.trustedDeviceId);
    if (!trustedDevice) {
      throw new Error(`Trusted device '${request.trustedDeviceId}' was not found.`);
    }

    const paired = pairTrustedDevice(trustedDevice, {
      trustMaterialRef: request.trustMaterialRef,
      pairedAt: request.pairedAt ?? this.clock.now(),
      now: this.clock.now(),
    });
    const updated = await this.repository.updateTrustedDevice(paired);
    return mapTrustedDeviceRecord(updated);
  }

  public async updateTrustedDeviceDisplayName(request: TrustedDeviceDisplayNameUpdate): Promise<TrustedDeviceRecord> {
    const trustedDevice = await this.repository.getTrustedDeviceById(request.trustedDeviceId);
    if (!trustedDevice) {
      throw new Error(`Trusted device '${request.trustedDeviceId}' was not found.`);
    }

    const updated = updateTrustedDeviceDisplayName(
      trustedDevice,
      request.displayName,
      request.updatedAt ? new Date(request.updatedAt) : this.clock.now(),
    );
    const persisted = await this.repository.updateTrustedDevice(updated);
    return mapTrustedDeviceRecord(persisted);
  }

  public async recordTrustedDeviceLastSeen(request: TrustedDeviceLastSeenUpdate): Promise<TrustedDeviceRecord> {
    const trustedDevice = await this.repository.getTrustedDeviceById(request.trustedDeviceId);
    if (!trustedDevice) {
      throw new Error(`Trusted device '${request.trustedDeviceId}' was not found.`);
    }

    const updated = touchTrustedDevice(trustedDevice, {
      seenAt: request.seenAt,
      metadataPatch: request.metadataPatch,
    });
    const persisted = await this.repository.updateTrustedDevice(updated);
    return mapTrustedDeviceRecord(persisted);
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
    const existing = await this.repository.getTrustedDeviceById(request.trustedDeviceId);
    const result = await this.repository.revokeTrustedDevice(request);
    if (!result.ok || !result.value.changed) {
      return result;
    }

    const revokedDevice = await this.repository.getTrustedDeviceById(request.trustedDeviceId);
    if (!revokedDevice) {
      return result;
    }

    await publishIdentityLifecycleEventBestEffort(
      this.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.trustedDeviceRevoked,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: revokedDevice.revocation?.revokedAt ?? request.revokedAt ?? revokedDevice.updatedAt,
        payload: {
          trustedDeviceId: revokedDevice.id,
          userIdentityId: revokedDevice.userIdentityId,
          workspaceId: revokedDevice.workspaceId,
          revokedByUserIdentityId: revokedDevice.revocation?.revokedByUserIdentityId ?? request.revokedByUserIdentityId,
          revocationReason: revokedDevice.revocation?.reason ?? request.reason,
          revokedAt: revokedDevice.revocation?.revokedAt ?? request.revokedAt ?? revokedDevice.updatedAt,
        },
      }),
    );
    await publishIdentityLifecycleEventBestEffort(
      this.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.trustedDeviceTrustStatusChanged,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: revokedDevice.updatedAt,
        payload: {
          trustedDeviceId: revokedDevice.id,
          userIdentityId: revokedDevice.userIdentityId,
          workspaceId: revokedDevice.workspaceId,
          previousStatus: existing?.trustStatus ?? revokedDevice.trustStatus,
          nextStatus: revokedDevice.trustStatus,
          changedAt: revokedDevice.updatedAt,
          changedByUserIdentityId: revokedDevice.revocation?.revokedByUserIdentityId ?? request.revokedByUserIdentityId,
          reason: "device-revoked",
        },
      }),
    );

    return result;
  }
}
