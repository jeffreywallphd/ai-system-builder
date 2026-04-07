import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUserIdentity } from "@domain/identity/IdentityDomain";
import {
  DevicePairingMethods,
  DeviceRevocationReasons,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
} from "@domain/identity/TrustedDeviceDomain";
import {
  PairingSessionStatuses,
  PairingTokenArtifactTypes,
  PairingTokenStatuses,
} from "@domain/identity/TrustedDevicePairingDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteIdentityPersistenceAdapter } from "../SqliteIdentityPersistenceAdapter";
import { SqliteTrustedDevicePersistenceAdapter } from "../SqliteTrustedDevicePersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteTrustedDevicePersistenceAdapter", () => {
  it("applies trusted-device migration artifacts", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-trusted-device-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");

    const trustedDeviceAdapter = new SqliteTrustedDevicePersistenceAdapter(databasePath);
    await trustedDeviceAdapter.listTrustedDevices({ userIdentityId: "user:none" });
    trustedDeviceAdapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM identity_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(6);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'identity_trusted_devices',
          'identity_trusted_device_pairing_sessions',
          'identity_trusted_device_pairing_tokens'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "identity_trusted_device_pairing_sessions",
      "identity_trusted_device_pairing_tokens",
      "identity_trusted_devices",
    ]);
    database.close();
  });

  it("supports trusted-device and pairing repository lifecycle operations", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-trusted-device-roundtrip-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");

    const identityAdapter = new SqliteIdentityPersistenceAdapter(databasePath);
    await identityAdapter.saveUserIdentity(createUserIdentity({
      id: "user:alice",
      username: "alice",
      status: "active",
      linkedProviders: [],
    }));
    identityAdapter.dispose();

    const adapter = new SqliteTrustedDevicePersistenceAdapter(databasePath);
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

    await adapter.createTrustedDevice(trustedDevice);
    expect((await adapter.getTrustedDeviceById(trustedDevice.id))?.displayName.value).toBe("Alice Laptop");
    expect((await adapter.findTrustedDeviceByFingerprint({
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      fingerprint: trustedDevice.fingerprint,
    }))?.id).toBe(trustedDevice.id);

    const pairedDevice = createTrustedDevice({
      ...trustedDevice,
      trustStatus: DeviceTrustStatuses.trusted,
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "material:alpha",
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
        issuedAt: "2026-04-04T12:10:00.000Z",
      }),
      pairedAt: "2026-04-04T12:10:00.000Z",
      updatedAt: "2026-04-04T12:10:00.000Z",
    });
    await adapter.updateTrustedDevice(pairedDevice);
    expect((await adapter.getTrustedDeviceById(trustedDevice.id))?.trustStatus).toBe(DeviceTrustStatuses.trusted);

    const revokeResult = await adapter.revokeTrustedDevice({
      trustedDeviceId: trustedDevice.id,
      reason: DeviceRevocationReasons.userRequest,
      revokedAt: "2026-04-04T12:20:00.000Z",
    });
    expect(revokeResult.ok).toBeTrue();
    if (revokeResult.ok) {
      expect(revokeResult.value.changed).toBeTrue();
    }
    const secondRevokeResult = await adapter.revokeTrustedDevice({
      trustedDeviceId: trustedDevice.id,
      reason: DeviceRevocationReasons.userRequest,
      revokedAt: "2026-04-04T12:21:00.000Z",
    });
    expect(secondRevokeResult.ok).toBeFalse();

    await adapter.createPairingSession({
      id: "pairing-session:1",
      trustedDeviceId: trustedDevice.id,
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      pairingTokenId: "pairing-token:1",
      status: PairingSessionStatuses.initiated,
      initiatedAt: "2026-04-04T12:30:00.000Z",
      updatedAt: "2026-04-04T12:30:00.000Z",
    });
    await adapter.createPairingToken({
      id: "pairing-token:1",
      pairingSessionId: "pairing-session:1",
      trustedDeviceId: trustedDevice.id,
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      tokenHash: "token-hash:1",
      hashAlgorithm: "sha256",
      actorBinding: {
        scope: "same-user",
        userIdentityId: "user:alice",
      },
      issuance: {
        issuedByUserIdentityId: "user:alice",
      },
      status: PairingTokenStatuses.issued,
      issuedAt: "2026-04-04T12:30:00.000Z",
      expiresAt: "2026-04-04T12:35:00.000Z",
      failedValidationAttempts: 0,
      maxValidationAttempts: 5,
      updatedAt: "2026-04-04T12:30:00.000Z",
    });

    expect((await adapter.getPairingSessionById("pairing-session:1"))?.status).toBe(PairingSessionStatuses.initiated);
    expect((await adapter.getPairingTokenBySessionId("pairing-session:1"))?.status).toBe(PairingTokenStatuses.issued);

    const invalidationResult = await adapter.invalidatePairingArtifacts({
      pairingSessionId: "pairing-session:1",
      pairingTokenId: "pairing-token:1",
      reason: "manual-cancel",
      invalidatedAt: "2026-04-04T12:31:00.000Z",
    });
    expect(invalidationResult.ok).toBeTrue();
    expect((await adapter.getPairingSessionById("pairing-session:1"))?.status).toBe(PairingSessionStatuses.invalidated);
    expect((await adapter.getPairingTokenById("pairing-token:1"))?.status).toBe(PairingTokenStatuses.invalidated);

    await adapter.createPairingSession({
      id: "pairing-session:completed",
      trustedDeviceId: trustedDevice.id,
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      pairingTokenId: "pairing-token:completed",
      status: PairingSessionStatuses.completed,
      initiatedAt: "2026-04-04T12:40:00.000Z",
      completedAt: "2026-04-04T12:45:00.000Z",
      updatedAt: "2026-04-04T12:45:00.000Z",
    });
    const completedInvalidation = await adapter.invalidatePairingArtifacts({
      pairingSessionId: "pairing-session:completed",
      reason: "manual-cancel",
      invalidatedAt: "2026-04-04T12:46:00.000Z",
    });
    expect(completedInvalidation.ok).toBeFalse();

    const listed = await adapter.listTrustedDevices({
      userIdentityId: "user:alice",
      workspaceId: "workspace:alpha",
      includeStatuses: [DeviceTrustStatuses.revoked],
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(trustedDevice.id);

    await expect(adapter.createTrustedDevice(createTrustedDevice({
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

    const database = openSqliteCompatDatabase(databasePath);
    const tokenExpiryIndex = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND name = 'identity_trusted_device_pairing_tokens_status_expiry_idx'
    `).get() as { name?: string };
    expect(tokenExpiryIndex.name).toBe("identity_trusted_device_pairing_tokens_status_expiry_idx");
    database.close();

    adapter.dispose();
  });
});

