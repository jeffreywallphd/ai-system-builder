import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUserIdentity } from "../../../../src/domain/identity/IdentityDomain";
import {
  DevicePairingMethods,
  DeviceRevocationReasons,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
} from "../../../../src/domain/identity/TrustedDeviceDomain";
import {
  PairingSessionStatuses,
  PairingTokenArtifactTypes,
  PairingTokenStatuses,
} from "../../../../src/domain/identity/TrustedDevicePairingDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteIdentityRepository } from "../SqliteIdentityRepository";
import { SqliteTrustedDeviceRepository } from "../SqliteTrustedDeviceRepository";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteTrustedDeviceRepository", () => {
  it("persists trusted-device and pairing artifacts with revocation and invalidation flows", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-trusted-device-roundtrip-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");

    const identityRepository = new SqliteIdentityRepository(databasePath);
    await identityRepository.saveUserIdentity(createUserIdentity({
      id: "user:alice",
      username: "alice",
      status: "active",
      linkedProviders: [],
    }));
    identityRepository.dispose();

    const repository = new SqliteTrustedDeviceRepository(databasePath);
    const trustedDevice = createTrustedDevice({
      id: "trusted-device:alpha",
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      displayName: "Alice Laptop",
      fingerprint: createDeviceFingerprint({
        algorithm: "sha256",
        value: "fingerprint:alpha",
        capturedAt: "2026-04-04T12:00:00.000Z",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      registeredAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    await repository.createTrustedDevice(trustedDevice);
    expect((await repository.getTrustedDeviceById(trustedDevice.id))?.id).toBe(trustedDevice.id);

    await repository.updateTrustedDevice(createTrustedDevice({
      ...trustedDevice,
      trustStatus: DeviceTrustStatuses.trusted,
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "material:alpha",
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
        issuedAt: "2026-04-04T12:10:00.000Z",
      }),
      pairedAt: "2026-04-04T12:10:00.000Z",
      updatedAt: "2026-04-04T12:10:00.000Z",
    }));
    expect((await repository.getTrustedDeviceById(trustedDevice.id))?.trustStatus).toBe(DeviceTrustStatuses.trusted);

    const revokeResult = await repository.revokeTrustedDevice({
      trustedDeviceId: trustedDevice.id,
      reason: DeviceRevocationReasons.userRequest,
      revokedAt: "2026-04-04T12:20:00.000Z",
    });
    expect(revokeResult.ok).toBeTrue();
    expect((await repository.getTrustedDeviceById(trustedDevice.id))?.trustStatus).toBe(DeviceTrustStatuses.revoked);

    await repository.createPairingSession({
      id: "pairing-session:1",
      trustedDeviceId: trustedDevice.id,
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      pairingTokenId: "pairing-token:1",
      status: PairingSessionStatuses.initiated,
      initiatedAt: "2026-04-04T12:30:00.000Z",
      updatedAt: "2026-04-04T12:30:00.000Z",
    });
    await repository.createPairingToken({
      id: "pairing-token:1",
      pairingSessionId: "pairing-session:1",
      trustedDeviceId: trustedDevice.id,
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: "token-hash:1",
      hashAlgorithm: "sha256",
      actorBinding: { scope: "same-user", userIdentityId: "user:alice" },
      issuance: { issuedByUserIdentityId: "user:alice" },
      status: PairingTokenStatuses.issued,
      issuedAt: "2026-04-04T12:30:00.000Z",
      expiresAt: "2026-04-04T12:35:00.000Z",
      failedValidationAttempts: 0,
      maxValidationAttempts: 5,
      updatedAt: "2026-04-04T12:30:00.000Z",
    });

    const invalidationResult = await repository.invalidatePairingArtifacts({
      pairingSessionId: "pairing-session:1",
      pairingTokenId: "pairing-token:1",
      reason: "manual-cancel",
      invalidatedAt: "2026-04-04T12:31:00.000Z",
    });
    expect(invalidationResult.ok).toBeTrue();
    expect((await repository.getPairingSessionById("pairing-session:1"))?.status).toBe(PairingSessionStatuses.invalidated);
    expect((await repository.getPairingTokenById("pairing-token:1"))?.status).toBe(PairingTokenStatuses.invalidated);

    await expect(repository.createTrustedDevice(createTrustedDevice({
      id: "trusted-device:duplicate-fingerprint",
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      displayName: "Duplicate",
      fingerprint: trustedDevice.fingerprint,
      pairingMethod: DevicePairingMethods.oneTimeCode,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      registeredAt: "2026-04-04T13:00:00.000Z",
      updatedAt: "2026-04-04T13:00:00.000Z",
    }))).rejects.toThrow();

    repository.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM identity_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(5);
    database.close();
  });
});
