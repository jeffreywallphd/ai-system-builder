import { describe, expect, it } from "bun:test";
import {
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
  type TrustedDevice,
} from "@domain/identity/TrustedDeviceDomain";
import {
  PairingSessionStatuses,
  PairingTokenActorScopes,
  PairingTokenArtifactTypes,
  PairingTokenStatuses,
  createPairingSession,
  createPairingToken,
  type PairingSession,
  type PairingToken,
} from "@domain/identity/TrustedDevicePairingDomain";
import {
  IdentityIdNamespaces,
  type IdentityMutationOutcome,
  type IdentityOperationResult,
  type TrustedDevicePairingInvalidationRequest,
  type TrustedDevicePairingSessionRecord,
  type TrustedDevicePairingTokenRecord,
  type TrustedDeviceListQuery,
  type TrustedDeviceLookupByFingerprintQuery,
  type TrustedDeviceRevocationRequest,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityErrorCodes, identityFailure, identitySuccess } from "../../contracts/IdentityApplicationContracts";
import { IdentityLifecycleEventTypes, type IdentityLifecycleEvent } from "../../contracts/IdentityLifecycleEventContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { ITrustedDevicePairingRepository } from "../ports/ITrustedDevicePairingRepository";
import type { ITrustedDeviceRepository } from "../ports/ITrustedDeviceRepository";
import { TrustedDevicePairingService } from "../services/TrustedDevicePairingService";
import {
  mapPairingSessionRecord,
  mapPairingTokenRecord,
  mapSessionRecordToDomain,
  mapTokenRecordToDomain,
} from "../services/TrustedDeviceServiceMappers";

class FixedClock implements IIdentityClock {
  private current = new Date("2026-04-04T12:00:00.000Z");

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public setNow(value: string): void {
    this.current = new Date(value);
  }
}

class SequentialIdGenerator implements IIdentityIdGenerator {
  private sequence = 0;

  public nextId(namespace: (typeof IdentityIdNamespaces)[keyof typeof IdentityIdNamespaces]): string {
    this.sequence += 1;
    return `${namespace}:${this.sequence}`;
  }
}

class InMemoryTrustedDeviceAdapter implements ITrustedDeviceRepository, ITrustedDevicePairingRepository {
  private readonly trustedDevices = new Map<string, TrustedDevice>();
  private readonly pairingSessions = new Map<string, PairingSession>();
  private readonly pairingTokens = new Map<string, PairingToken>();

  public async createTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    this.trustedDevices.set(device.id, device);
    return device;
  }

  public async getTrustedDeviceById(trustedDeviceId: string): Promise<TrustedDevice | undefined> {
    return this.trustedDevices.get(trustedDeviceId.trim());
  }

  public async findTrustedDeviceByFingerprint(
    query: TrustedDeviceLookupByFingerprintQuery,
  ): Promise<TrustedDevice | undefined> {
    return [...this.trustedDevices.values()].find((device) => (
      device.userIdentityId === query.userIdentityId
      && device.workspaceId === query.workspaceId
      && device.fingerprint.algorithm === query.fingerprint.algorithm
      && device.fingerprint.value === query.fingerprint.value
    ));
  }

  public async listTrustedDevices(query: TrustedDeviceListQuery): Promise<ReadonlyArray<TrustedDevice>> {
    return Object.freeze([...this.trustedDevices.values()].filter((device) => (
      device.userIdentityId === query.userIdentityId
    )));
  }

  public async updateTrustedDevice(device: TrustedDevice): Promise<TrustedDevice> {
    this.trustedDevices.set(device.id, device);
    return device;
  }

  public async revokeTrustedDevice(
    _request: TrustedDeviceRevocationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    return identityFailure({
      code: IdentityErrorCodes.invalidState,
      message: "not implemented",
      boundary: "infrastructure",
      retryable: false,
    });
  }

  public async createPairingSession(session: TrustedDevicePairingSessionRecord): Promise<TrustedDevicePairingSessionRecord> {
    const domain = mapSessionRecordToDomain(session);
    this.pairingSessions.set(domain.id, domain);
    return mapPairingSessionRecord(domain);
  }

  public async createPairingToken(token: TrustedDevicePairingTokenRecord): Promise<TrustedDevicePairingTokenRecord> {
    const domain = mapTokenRecordToDomain(token);
    this.pairingTokens.set(domain.id, domain);
    return mapPairingTokenRecord(domain);
  }

  public async getPairingSessionById(pairingSessionId: string): Promise<TrustedDevicePairingSessionRecord | undefined> {
    const domain = this.pairingSessions.get(pairingSessionId.trim());
    return domain ? mapPairingSessionRecord(domain) : undefined;
  }

  public async getPairingTokenById(pairingTokenId: string): Promise<TrustedDevicePairingTokenRecord | undefined> {
    const domain = this.pairingTokens.get(pairingTokenId.trim());
    return domain ? mapPairingTokenRecord(domain) : undefined;
  }

  public async getPairingTokenBySessionId(pairingSessionId: string): Promise<TrustedDevicePairingTokenRecord | undefined> {
    const domain = [...this.pairingTokens.values()].find((token) => token.pairingSessionId === pairingSessionId.trim());
    return domain ? mapPairingTokenRecord(domain) : undefined;
  }

  public async updatePairingSession(session: TrustedDevicePairingSessionRecord): Promise<TrustedDevicePairingSessionRecord> {
    return this.createPairingSession(session);
  }

  public async updatePairingToken(token: TrustedDevicePairingTokenRecord): Promise<TrustedDevicePairingTokenRecord> {
    return this.createPairingToken(token);
  }

  public async invalidatePairingArtifacts(
    _request: TrustedDevicePairingInvalidationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    return identitySuccess({ changed: true });
  }
}

function hashPairingToken(value: string): string {
  return `hash:${value.trim()}`;
}

describe("TrustedDevicePairingService completion", () => {
  it("emits audit event on pairing initiation", async () => {
    const adapter = new InMemoryTrustedDeviceAdapter();
    const clock = new FixedClock();
    const events: IdentityLifecycleEvent[] = [];
    const service = new TrustedDevicePairingService({
      trustedDeviceRepository: adapter,
      pairingRepository: adapter,
      idGenerator: new SequentialIdGenerator(),
      clock,
      pairingTokenHasher: hashPairingToken,
      eventPublisher: {
        publish: async (event) => {
          events.push(event);
        },
      },
    });

    await adapter.createTrustedDevice(createTrustedDevice({
      id: "trusted-device:initiate",
      userIdentityId: "user:initiate",
      displayName: "Initiate Device",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fingerprint:initiate",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      registeredAt: "2026-04-04T11:58:00.000Z",
      updatedAt: "2026-04-04T11:58:00.000Z",
    }));

    const initiated = await service.initiatePairing({
      trustedDeviceId: "trusted-device:initiate",
      userIdentityId: "user:initiate",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:initiate",
      },
      issuance: {},
      maxValidationAttempts: 3,
      expiresAt: "2026-04-04T12:30:00.000Z",
    });

    expect(initiated.pairingToken.pairingTokenId).toBeDefined();
    expect(events.some((event) => event.eventType === IdentityLifecycleEventTypes.trustedDevicePairingInitiated)).toBeTrue();
  });

  it("completes pairing and persists trusted-device trust material", async () => {
    const adapter = new InMemoryTrustedDeviceAdapter();
    const clock = new FixedClock();
    const events: IdentityLifecycleEvent[] = [];
    const service = new TrustedDevicePairingService({
      trustedDeviceRepository: adapter,
      pairingRepository: adapter,
      idGenerator: new SequentialIdGenerator(),
      clock,
      pairingTokenHasher: hashPairingToken,
      eventPublisher: {
        publish: async (event) => {
          events.push(event);
        },
      },
    });

    const trustedDevice = createTrustedDevice({
      id: "trusted-device:alpha",
      userIdentityId: "user:alpha",
      workspaceId: "workspace:alpha",
      displayName: "Alpha Laptop",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fingerprint:alpha",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      registeredAt: "2026-04-04T11:58:00.000Z",
      updatedAt: "2026-04-04T11:58:00.000Z",
    });
    await adapter.createTrustedDevice(trustedDevice);

    await adapter.createPairingSession(mapPairingSessionRecord(createPairingSession({
      id: "pairing-session:alpha",
      trustedDeviceId: "trusted-device:alpha",
      userIdentityId: "user:alpha",
      workspaceId: "workspace:alpha",
      pairingTokenId: "pairing-token:alpha",
      status: PairingSessionStatuses.validated,
      initiatedAt: "2026-04-04T11:59:00.000Z",
      validatedAt: "2026-04-04T11:59:30.000Z",
      updatedAt: "2026-04-04T11:59:30.000Z",
    })));

    await adapter.createPairingToken(mapPairingTokenRecord(createPairingToken({
      id: "pairing-token:alpha",
      pairingSessionId: "pairing-session:alpha",
      trustedDeviceId: "trusted-device:alpha",
      userIdentityId: "user:alpha",
      workspaceId: "workspace:alpha",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: hashPairingToken("PAIR-SECRET"),
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:alpha",
      },
      status: PairingTokenStatuses.issued,
      issuedAt: "2026-04-04T11:59:00.000Z",
      expiresAt: "2026-04-04T12:30:00.000Z",
      updatedAt: "2026-04-04T11:59:00.000Z",
    })));

    const completed = await service.completePairing({
      pairingSessionId: "pairing-session:alpha",
      pairingTokenId: "pairing-token:alpha",
      trustedDeviceId: "trusted-device:alpha",
      userIdentityId: "user:alpha",
      workspaceId: "workspace:alpha",
      presentedToken: "PAIR-SECRET",
      trustMaterialRegistration: {
        materialKind: DeviceTrustMaterialKinds.sessionSigningKey,
        pinReference: "pin:alpha",
      },
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "material:alpha",
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
        issuedAt: "2026-04-04T12:00:00.000Z",
      }),
      completedAt: "2026-04-04T12:00:00.000Z",
    });

    expect(completed.pairingToken.status).toBe(PairingTokenStatuses.consumed);
    expect(completed.pairingSession.status).toBe(PairingSessionStatuses.completed);
    expect(completed.trustedDevice.trustStatus).toBe(DeviceTrustStatuses.trusted);
    expect(completed.trustedDevice.trustMaterialRef?.materialId).toBe("material:alpha");
    expect(completed.pairingSession.trustMaterialRegistration?.pinReference).toBe("pin:alpha");
    expect(events.some((event) => event.eventType === IdentityLifecycleEventTypes.trustedDevicePairingCompleted)).toBeTrue();
    expect(events.some((event) => event.eventType === IdentityLifecycleEventTypes.trustedDeviceTrustStatusChanged)).toBeTrue();
  });

  it("rejects expired pairing artifacts and does not trust the device", async () => {
    const adapter = new InMemoryTrustedDeviceAdapter();
    const clock = new FixedClock();
    clock.setNow("2026-04-04T12:45:00.000Z");
    const events: IdentityLifecycleEvent[] = [];
    const service = new TrustedDevicePairingService({
      trustedDeviceRepository: adapter,
      pairingRepository: adapter,
      idGenerator: new SequentialIdGenerator(),
      clock,
      pairingTokenHasher: hashPairingToken,
      eventPublisher: {
        publish: async (event) => {
          events.push(event);
        },
      },
    });

    await adapter.createTrustedDevice(createTrustedDevice({
      id: "trusted-device:expired",
      userIdentityId: "user:expired",
      displayName: "Expired Device",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fingerprint:expired",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      registeredAt: "2026-04-04T11:58:00.000Z",
      updatedAt: "2026-04-04T11:58:00.000Z",
    }));

    await adapter.createPairingSession(mapPairingSessionRecord(createPairingSession({
      id: "pairing-session:expired",
      trustedDeviceId: "trusted-device:expired",
      userIdentityId: "user:expired",
      pairingTokenId: "pairing-token:expired",
      status: PairingSessionStatuses.initiated,
      initiatedAt: "2026-04-04T11:59:00.000Z",
      updatedAt: "2026-04-04T11:59:00.000Z",
    })));

    await adapter.createPairingToken(mapPairingTokenRecord(createPairingToken({
      id: "pairing-token:expired",
      pairingSessionId: "pairing-session:expired",
      trustedDeviceId: "trusted-device:expired",
      userIdentityId: "user:expired",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: hashPairingToken("PAIR-EXPIRED"),
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:expired",
      },
      status: PairingTokenStatuses.issued,
      issuedAt: "2026-04-04T11:59:00.000Z",
      expiresAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T11:59:00.000Z",
    })));

    await expect(service.completePairing({
      pairingSessionId: "pairing-session:expired",
      pairingTokenId: "pairing-token:expired",
      trustedDeviceId: "trusted-device:expired",
      userIdentityId: "user:expired",
      presentedToken: "PAIR-EXPIRED",
    })).rejects.toThrow("expired");

    const persistedDevice = await adapter.getTrustedDeviceById("trusted-device:expired");
    expect(persistedDevice?.trustStatus).toBe(DeviceTrustStatuses.pendingPairing);

    const persistedSession = await adapter.getPairingSessionById("pairing-session:expired");
    expect(persistedSession?.status).toBe(PairingSessionStatuses.expired);
    expect(events.some((event) => (
      event.eventType === IdentityLifecycleEventTypes.trustedDevicePairingFailed
      && (event.payload as { failureReason?: string }).failureReason === "expired"
    ))).toBeTrue();
  });

  it("treats repeated completion as idempotent and does not duplicate state", async () => {
    const adapter = new InMemoryTrustedDeviceAdapter();
    const clock = new FixedClock();
    const service = new TrustedDevicePairingService({
      trustedDeviceRepository: adapter,
      pairingRepository: adapter,
      idGenerator: new SequentialIdGenerator(),
      clock,
      pairingTokenHasher: hashPairingToken,
    });

    await adapter.createTrustedDevice(createTrustedDevice({
      id: "trusted-device:idempotent",
      userIdentityId: "user:idempotent",
      displayName: "Idempotent Device",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fingerprint:idempotent",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.trusted,
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "material:idempotent",
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
        issuedAt: "2026-04-04T12:00:00.000Z",
      }),
      registeredAt: "2026-04-04T11:58:00.000Z",
      pairedAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    }));

    await adapter.createPairingSession(mapPairingSessionRecord(createPairingSession({
      id: "pairing-session:idempotent",
      trustedDeviceId: "trusted-device:idempotent",
      userIdentityId: "user:idempotent",
      pairingTokenId: "pairing-token:idempotent",
      status: PairingSessionStatuses.completed,
      initiatedAt: "2026-04-04T11:59:00.000Z",
      completion: {
        completedAt: "2026-04-04T12:00:00.000Z",
        completedByUserIdentityId: "user:idempotent",
      },
      updatedAt: "2026-04-04T12:00:00.000Z",
    })));

    await adapter.createPairingToken(mapPairingTokenRecord(createPairingToken({
      id: "pairing-token:idempotent",
      pairingSessionId: "pairing-session:idempotent",
      trustedDeviceId: "trusted-device:idempotent",
      userIdentityId: "user:idempotent",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: hashPairingToken("PAIR-IDEMPOTENT"),
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:idempotent",
      },
      status: PairingTokenStatuses.consumed,
      issuedAt: "2026-04-04T11:59:00.000Z",
      expiresAt: "2026-04-04T12:30:00.000Z",
      consumed: {
        consumedAt: "2026-04-04T12:00:00.000Z",
        consumedByUserIdentityId: "user:idempotent",
      },
      updatedAt: "2026-04-04T12:00:00.000Z",
    })));

    const completed = await service.completePairing({
      pairingSessionId: "pairing-session:idempotent",
      pairingTokenId: "pairing-token:idempotent",
      trustedDeviceId: "trusted-device:idempotent",
      userIdentityId: "user:idempotent",
      presentedToken: "PAIR-IDEMPOTENT",
    });

    expect(completed.pairingSession.status).toBe(PairingSessionStatuses.completed);
    expect(completed.pairingToken.status).toBe(PairingTokenStatuses.consumed);
    expect(completed.trustedDevice.trustStatus).toBe(DeviceTrustStatuses.trusted);
  });
});

