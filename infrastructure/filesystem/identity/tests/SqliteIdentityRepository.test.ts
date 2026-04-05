import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  CredentialStatuses,
  IdentitySessionStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createSession,
  createUserIdentity,
  revokeSession,
} from "../../../../src/domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityPrincipalLookupKinds,
} from "../../../../application/contracts/IdentityApplicationContracts";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteIdentityRepository } from "../SqliteIdentityRepository";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteIdentityRepository", () => {
  it("applies identity migrations and creates production tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-identity-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");

    const repository = new SqliteIdentityRepository(databasePath);
    await repository.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));
    repository.dispose();

    const db = openSqliteCompatDatabase(databasePath);
    const migrationVersion = db.prepare("SELECT MAX(version) AS version FROM identity_repository_migrations")
      .get() as { version?: number };
    expect(migrationVersion.version).toBe(3);

    const tableRows = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'identity_auth_providers',
          'identity_credential_policies',
          'identity_user_identities',
          'identity_user_provider_links',
          'identity_credential_material_records',
          'identity_sessions',
          'identity_session_token_material'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;
    expect(tableRows.map((row) => row.name)).toEqual([
      "identity_auth_providers",
      "identity_credential_material_records",
      "identity_credential_policies",
      "identity_session_token_material",
      "identity_sessions",
      "identity_user_identities",
      "identity_user_provider_links",
    ]);

    db.close();
  });

  it("round-trips provider, policy, user, credential material, and session contracts", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-identity-roundtrip-"));
    createdRoots.push(root);
    const repository = new SqliteIdentityRepository(path.join(root, "identity.sqlite"));

    const provider = await repository.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));

    const policy = await repository.saveCredentialPolicy(createCredentialPolicy({
      id: "policy:local-password",
      blockedSubstrings: ["loom", "loom"],
    }));

    const user = await repository.saveUserIdentity(createUserIdentity({
      id: "user:alice",
      username: "Alice",
      email: "Alice@example.com",
      displayName: "Alice",
      status: "active",
      linkedProviders: [{
        providerId: provider.id,
        providerSubject: "alice-local",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
        credentialState: {
          status: CredentialStatuses.active,
          policyId: policy.id,
          failedAttempts: 0,
        },
      }],
    }));

    expect((await repository.findUserIdentityById(user.id))?.id).toBe(user.id);
    expect(await repository.countUserIdentities()).toBe(1);
    expect((await repository.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.username,
      value: "alice",
    }))?.id).toBe(user.id);
    expect((await repository.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.email,
      value: "ALICE@EXAMPLE.COM",
    }))?.id).toBe(user.id);
    expect((await repository.findUserIdentityByProviderSubject({
      providerId: provider.id,
      providerSubject: "alice-local",
    }))?.id).toBe(user.id);

    expect((await repository.findAuthProviderById(provider.id))?.kind).toBe(AuthProviderKinds.localPassword);
    expect((await repository.findCredentialPolicyById(policy.id))?.blockedSubstrings).toEqual(["loom"]);

    const materialId = "credential:1";
    await repository.saveCredentialMaterial({
      id: materialId,
      userIdentityId: user.id,
      providerId: provider.id,
      providerSubject: "alice-local",
      hashAlgorithm: "argon2id",
      hashValue: "hash:v1",
      salt: "salt:v1",
      pepperVersion: "pepper:v1",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    expect((await repository.getActiveCredentialMaterial({
      providerId: provider.id,
      providerSubject: "alice-local",
    }))?.id).toBe(materialId);

    const supersedeResult = await repository.markCredentialMaterialSuperseded(materialId, "2026-04-04T13:00:00.000Z");
    expect(supersedeResult.ok).toBeTrue();
    if (supersedeResult.ok) {
      expect(supersedeResult.value.changed).toBeTrue();
    }
    expect(await repository.getActiveCredentialMaterial({
      providerId: provider.id,
      providerSubject: "alice-local",
    })).toBeUndefined();

    const history = await repository.listCredentialMaterialHistory({
      reference: { providerId: provider.id, providerSubject: "alice-local" },
      includeInactive: true,
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe(IdentityCredentialMaterialStatuses.superseded);

    const activeSession = await repository.saveSession(createSession({
      id: "session:active",
      userIdentityId: user.id,
      providerId: provider.id,
      providerSubject: "alice-local",
      issuedAt: new Date("2026-04-04T12:00:00.000Z"),
      expiresAt: new Date("2026-04-04T16:00:00.000Z"),
      client: {
        accessChannel: "thin-client",
        userAgent: "loom-test",
        ipAddress: "127.0.0.1",
        deviceId: "device-1",
      },
    }));
    await repository.saveSession(revokeSession(createSession({
      id: "session:revoked",
      userIdentityId: user.id,
      providerId: provider.id,
      providerSubject: "alice-local",
      issuedAt: new Date("2026-04-04T11:00:00.000Z"),
      expiresAt: new Date("2026-04-04T15:00:00.000Z"),
    }), "logout", new Date("2026-04-04T11:30:00.000Z")));

    expect((await repository.getSessionById(activeSession.id))?.status).toBe(IdentitySessionStatuses.active);
    expect((await repository.getSessionById(activeSession.id))?.client?.accessChannel).toBe("thin-client");
    await repository.saveSessionTokenMaterial({
      sessionId: activeSession.id,
      tokenHash: "hash:session:active",
      hashAlgorithm: "sha256",
      tokenType: "opaque-bearer",
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
      expiresAt: "2026-04-04T16:00:00.000Z",
    });
    expect((await repository.getSessionTokenMaterialBySessionId(activeSession.id))?.tokenHash).toBe("hash:session:active");
    expect((await repository.getSessionTokenMaterialByTokenHash("hash:session:active"))?.sessionId).toBe(activeSession.id);
    const invalidatedToken = await repository.invalidateSessionTokenMaterial(activeSession.id, "2026-04-04T12:30:00.000Z");
    expect(invalidatedToken?.invalidatedAt).toBe("2026-04-04T12:30:00.000Z");

    const activeOnly = await repository.listSessionsByUserIdentityId({
      userIdentityId: user.id,
      includeStatuses: [IdentitySessionStatuses.active],
    });
    expect(activeOnly.map((session) => session.id)).toEqual(["session:active"]);

    const removeResult = await repository.removeSession("session:revoked");
    expect(removeResult.ok).toBeTrue();
    if (removeResult.ok) {
      expect(removeResult.value.changed).toBeTrue();
    }
    expect(await repository.getSessionById("session:revoked")).toBeUndefined();

    repository.dispose();
  });

  it("enforces uniqueness and integrity constraints for identity records", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-identity-constraints-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");
    const repository = new SqliteIdentityRepository(databasePath);

    await repository.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));

    await repository.saveCredentialPolicy(createCredentialPolicy({ id: "policy:local-password" }));

    await repository.saveUserIdentity(createUserIdentity({
      id: "user:one",
      username: "same",
      email: "same@example.com",
      linkedProviders: [{
        providerId: "provider:local-password",
        providerSubject: "subject:one",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
        credentialState: {
          status: CredentialStatuses.active,
          policyId: "policy:local-password",
          failedAttempts: 0,
        },
      }],
    }));

    await expect(repository.saveUserIdentity(createUserIdentity({
      id: "user:two",
      username: "same",
      email: "other@example.com",
      linkedProviders: [{
        providerId: "provider:local-password",
        providerSubject: "subject:two",
        isPrimary: true,
        linkedAt: "2026-04-04T12:05:00.000Z",
      }],
    }))).rejects.toThrow();

    await expect(repository.saveUserIdentity(createUserIdentity({
      id: "user:missing-provider",
      username: "missing-provider",
      linkedProviders: [{
        providerId: "provider:does-not-exist",
        providerSubject: "subject:three",
        isPrimary: true,
        linkedAt: "2026-04-04T12:05:00.000Z",
      }],
    }))).rejects.toThrow();

    await repository.saveCredentialMaterial({
      id: "credential:active:one",
      userIdentityId: "user:one",
      providerId: "provider:local-password",
      providerSubject: "subject:one",
      hashAlgorithm: "argon2id",
      hashValue: "hash:v1",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    await expect(repository.saveCredentialMaterial({
      id: "credential:active:two",
      userIdentityId: "user:one",
      providerId: "provider:local-password",
      providerSubject: "subject:one",
      hashAlgorithm: "argon2id",
      hashValue: "hash:v2",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:10:00.000Z",
      updatedAt: "2026-04-04T12:10:00.000Z",
    })).rejects.toThrow();

    repository.dispose();

    const db = openSqliteCompatDatabase(databasePath);
    const uniqueIndex = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND name = 'identity_credential_material_active_unique'
    `).get() as { name?: string };
    expect(uniqueIndex.name).toBe("identity_credential_material_active_unique");
    db.close();
  });
});
