import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createUserIdentity } from "../../../../src/domain/identity/IdentityDomain";
import {
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
} from "../../../../src/domain/identity/TrustedDeviceDomain";
import {
  PairingSessionStatuses,
  PairingTokenActorScopes,
  PairingTokenArtifactTypes,
  PairingTokenStatuses,
} from "../../../../src/domain/identity/TrustedDevicePairingDomain";
import { IdentityIdNamespaces, type IdentityIdNamespace } from "../../../../application/contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../../../../application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../../../../application/identity/ports/IIdentityIdGenerator";
import { TrustedDevicePairingService } from "../../../../application/identity/services/TrustedDevicePairingService";
import { SqliteIdentityRepository } from "../SqliteIdentityRepository";
import { SqliteTrustedDeviceRepository } from "../SqliteTrustedDeviceRepository";

class FixedClock implements IIdentityClock {
  public constructor(private readonly iso: string) {}

  public now(): Date {
    return new Date(this.iso);
  }
}

class StaticIdGenerator implements IIdentityIdGenerator {
  private sequence = 0;

  public nextId(namespace: IdentityIdNamespace): string {
    this.sequence += 1;
    return `${namespace}:${this.sequence}`;
  }
}

function hashPairingToken(value: string): string {
  return createHash("sha256").update(value.trim(), "utf8").digest("hex");
}

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("TrustedDevicePairingService sqlite completion integration", () => {
  it("completes pairing and persists token/session/device trust state", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-pairing-complete-success-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");

    const identityRepository = new SqliteIdentityRepository(databasePath);
    await identityRepository.saveUserIdentity(createUserIdentity({
      id: "user:sqlite:alpha",
      username: "sqlite-alpha",
      status: "active",
      linkedProviders: [],
    }));
    identityRepository.dispose();

    const repository = new SqliteTrustedDeviceRepository(databasePath);
    await repository.createTrustedDevice(createTrustedDevice({
      id: "trusted-device:sqlite:alpha",
      userIdentityId: "user:sqlite:alpha",
      workspaceId: "workspace:sqlite:alpha",
      displayName: "SQLite Alpha",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fingerprint:sqlite:alpha",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      registeredAt: "2026-04-04T11:58:00.000Z",
      updatedAt: "2026-04-04T11:58:00.000Z",
    }));

    await repository.createPairingSession({
      id: "pairing-session:sqlite:alpha",
      trustedDeviceId: "trusted-device:sqlite:alpha",
      userIdentityId: "user:sqlite:alpha",
      workspaceId: "workspace:sqlite:alpha",
      pairingTokenId: "pairing-token:sqlite:alpha",
      status: PairingSessionStatuses.validated,
      initiatedAt: "2026-04-04T11:59:00.000Z",
      validatedAt: "2026-04-04T11:59:30.000Z",
      updatedAt: "2026-04-04T11:59:30.000Z",
    });

    await repository.createPairingToken({
      id: "pairing-token:sqlite:alpha",
      pairingSessionId: "pairing-session:sqlite:alpha",
      trustedDeviceId: "trusted-device:sqlite:alpha",
      userIdentityId: "user:sqlite:alpha",
      workspaceId: "workspace:sqlite:alpha",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: hashPairingToken("SQLITE-PAIR-ALPHA"),
      hashAlgorithm: "sha256",
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:sqlite:alpha",
      },
      issuance: {
        issuedByUserIdentityId: "user:sqlite:alpha",
      },
      status: PairingTokenStatuses.issued,
      issuedAt: "2026-04-04T11:59:00.000Z",
      expiresAt: "2026-04-04T12:30:00.000Z",
      failedValidationAttempts: 0,
      maxValidationAttempts: 5,
      updatedAt: "2026-04-04T11:59:00.000Z",
    });

    const service = new TrustedDevicePairingService({
      trustedDeviceRepository: repository,
      pairingRepository: repository,
      idGenerator: new StaticIdGenerator(),
      clock: new FixedClock("2026-04-04T12:00:00.000Z"),
      pairingTokenHasher: hashPairingToken,
    });

    const completed = await service.completePairing({
      pairingSessionId: "pairing-session:sqlite:alpha",
      pairingTokenId: "pairing-token:sqlite:alpha",
      trustedDeviceId: "trusted-device:sqlite:alpha",
      userIdentityId: "user:sqlite:alpha",
      workspaceId: "workspace:sqlite:alpha",
      presentedToken: "SQLITE-PAIR-ALPHA",
      completedAt: "2026-04-04T12:00:00.000Z",
      trustMaterialRegistration: {
        materialKind: DeviceTrustMaterialKinds.sessionSigningKey,
        pinReference: "pin:sqlite:alpha",
      },
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "material:sqlite:alpha",
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
        issuedAt: "2026-04-04T12:00:00.000Z",
      }),
    });

    expect(completed.pairingToken.status).toBe(PairingTokenStatuses.consumed);
    expect(completed.pairingSession.status).toBe(PairingSessionStatuses.completed);
    expect(completed.trustedDevice.trustStatus).toBe(DeviceTrustStatuses.trusted);

    const persistedDevice = await repository.getTrustedDeviceById("trusted-device:sqlite:alpha");
    expect(persistedDevice?.trustStatus).toBe(DeviceTrustStatuses.trusted);
    expect(persistedDevice?.trustMaterialRef?.materialId).toBe("material:sqlite:alpha");

    const persistedSession = await repository.getPairingSessionById("pairing-session:sqlite:alpha");
    expect(persistedSession?.status).toBe(PairingSessionStatuses.completed);
    expect(persistedSession?.trustMaterialRegistration?.pinReference).toBe("pin:sqlite:alpha");

    const persistedToken = await repository.getPairingTokenById("pairing-token:sqlite:alpha");
    expect(persistedToken?.status).toBe(PairingTokenStatuses.consumed);

    repository.dispose();
  });

  it("rejects completion for expired pairing token and keeps device untrusted", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-pairing-complete-expired-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");

    const identityRepository = new SqliteIdentityRepository(databasePath);
    await identityRepository.saveUserIdentity(createUserIdentity({
      id: "user:sqlite:expired",
      username: "sqlite-expired",
      status: "active",
      linkedProviders: [],
    }));
    identityRepository.dispose();

    const repository = new SqliteTrustedDeviceRepository(databasePath);
    await repository.createTrustedDevice(createTrustedDevice({
      id: "trusted-device:sqlite:expired",
      userIdentityId: "user:sqlite:expired",
      displayName: "SQLite Expired",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "fingerprint:sqlite:expired",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      registeredAt: "2026-04-04T11:58:00.000Z",
      updatedAt: "2026-04-04T11:58:00.000Z",
    }));

    await repository.createPairingSession({
      id: "pairing-session:sqlite:expired",
      trustedDeviceId: "trusted-device:sqlite:expired",
      userIdentityId: "user:sqlite:expired",
      pairingTokenId: "pairing-token:sqlite:expired",
      status: PairingSessionStatuses.initiated,
      initiatedAt: "2026-04-04T11:59:00.000Z",
      updatedAt: "2026-04-04T11:59:00.000Z",
    });

    await repository.createPairingToken({
      id: "pairing-token:sqlite:expired",
      pairingSessionId: "pairing-session:sqlite:expired",
      trustedDeviceId: "trusted-device:sqlite:expired",
      userIdentityId: "user:sqlite:expired",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: hashPairingToken("SQLITE-PAIR-EXPIRED"),
      hashAlgorithm: "sha256",
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:sqlite:expired",
      },
      issuance: {
        issuedByUserIdentityId: "user:sqlite:expired",
      },
      status: PairingTokenStatuses.issued,
      issuedAt: "2026-04-04T11:59:00.000Z",
      expiresAt: "2026-04-04T12:00:00.000Z",
      failedValidationAttempts: 0,
      maxValidationAttempts: 5,
      updatedAt: "2026-04-04T11:59:00.000Z",
    });

    const service = new TrustedDevicePairingService({
      trustedDeviceRepository: repository,
      pairingRepository: repository,
      idGenerator: new StaticIdGenerator(),
      clock: new FixedClock("2026-04-04T12:30:00.000Z"),
      pairingTokenHasher: hashPairingToken,
    });

    await expect(service.completePairing({
      pairingSessionId: "pairing-session:sqlite:expired",
      pairingTokenId: "pairing-token:sqlite:expired",
      trustedDeviceId: "trusted-device:sqlite:expired",
      userIdentityId: "user:sqlite:expired",
      presentedToken: "SQLITE-PAIR-EXPIRED",
    })).rejects.toThrow("expired");

    expect((await repository.getTrustedDeviceById("trusted-device:sqlite:expired"))?.trustStatus).toBe(DeviceTrustStatuses.pendingPairing);
    expect((await repository.getPairingSessionById("pairing-session:sqlite:expired"))?.status).toBe(PairingSessionStatuses.expired);

    repository.dispose();
  });
});
