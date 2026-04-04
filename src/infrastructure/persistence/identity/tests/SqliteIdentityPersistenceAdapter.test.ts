import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
} from "../../../../domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityPrincipalLookupKinds,
} from "../../../../../application/contracts/IdentityApplicationContracts";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteIdentityPersistenceAdapter } from "../SqliteIdentityPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteIdentityPersistenceAdapter", () => {
  it("applies migrations and creates all identity persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-identity-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "identity.sqlite");

    const adapter = new SqliteIdentityPersistenceAdapter(databasePath);
    await adapter.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM identity_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'identity_auth_providers',
          'identity_credential_policies',
          'identity_user_identities',
          'identity_user_provider_links',
          'identity_credential_material_records',
          'identity_sessions'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "identity_auth_providers",
      "identity_credential_material_records",
      "identity_credential_policies",
      "identity_sessions",
      "identity_user_identities",
      "identity_user_provider_links",
    ]);

    database.close();
  });

  it("supports identity CRUD and query workflows across user, provider, credential material, and sessions", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-identity-roundtrip-"));
    createdRoots.push(root);

    const adapter = new SqliteIdentityPersistenceAdapter(path.join(root, "identity.sqlite"));
    const provider = await adapter.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));

    const policy = await adapter.saveCredentialPolicy(createCredentialPolicy({
      id: "policy:local",
      blockedSubstrings: ["loom", "loom"],
    }));

    const user = await adapter.saveUserIdentity(createUserIdentity({
      id: "user:alice",
      username: "Alice",
      email: "Alice@example.com",
      displayName: "Alice",
      status: "active",
      linkedProviders: [
        {
          providerId: provider.id,
          providerSubject: "alice-local",
          isPrimary: true,
          linkedAt: "2026-04-04T12:00:00.000Z",
          credentialState: {
            status: CredentialStatuses.active,
            policyId: policy.id,
            failedAttempts: 0,
          },
        },
      ],
    }));

    expect((await adapter.findUserIdentityById(user.id))?.id).toBe(user.id);
    expect(await adapter.countUserIdentities()).toBe(1);
    expect((await adapter.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.username,
      value: "alice",
    }))?.id).toBe(user.id);
    expect((await adapter.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.email,
      value: "ALICE@EXAMPLE.COM",
    }))?.id).toBe(user.id);
    expect((await adapter.findUserIdentityByProviderSubject({
      providerId: provider.id,
      providerSubject: "alice-local",
    }))?.id).toBe(user.id);

    expect((await adapter.findAuthProviderById(provider.id))?.kind).toBe(AuthProviderKinds.localPassword);
    expect((await adapter.findCredentialPolicyById(policy.id))?.blockedSubstrings).toEqual(["loom"]);

    await adapter.saveCredentialMaterial({
      id: "credential:1",
      userIdentityId: user.id,
      providerId: provider.id,
      providerSubject: "alice-local",
      hashAlgorithm: "argon2id",
      hashValue: "hash:v1",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    expect((await adapter.getActiveCredentialMaterial({
      providerId: provider.id,
      providerSubject: "alice-local",
    }))?.id).toBe("credential:1");

    const supersedeResult = await adapter.markCredentialMaterialSuperseded("credential:1", "2026-04-04T13:00:00.000Z");
    expect(supersedeResult.ok).toBeTrue();
    if (supersedeResult.ok) {
      expect(supersedeResult.value.changed).toBeTrue();
    }
    expect(await adapter.getActiveCredentialMaterial({
      providerId: provider.id,
      providerSubject: "alice-local",
    })).toBeUndefined();

    const history = await adapter.listCredentialMaterialHistory({
      reference: { providerId: provider.id, providerSubject: "alice-local" },
      includeInactive: true,
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe(IdentityCredentialMaterialStatuses.superseded);

    const activeSession = await adapter.saveSession(createSession({
      id: "session:active",
      userIdentityId: user.id,
      providerId: provider.id,
      providerSubject: "alice-local",
      issuedAt: new Date("2026-04-04T12:00:00.000Z"),
      expiresAt: new Date("2026-04-04T14:00:00.000Z"),
    }));

    await adapter.saveSession(revokeSession(createSession({
      id: "session:revoked",
      userIdentityId: user.id,
      providerId: provider.id,
      providerSubject: "alice-local",
      issuedAt: new Date("2026-04-04T11:00:00.000Z"),
      expiresAt: new Date("2026-04-04T13:00:00.000Z"),
    }), "logout", new Date("2026-04-04T11:30:00.000Z")));

    expect((await adapter.getSessionById(activeSession.id))?.status).toBe(IdentitySessionStatuses.active);

    const activeOnly = await adapter.listSessionsByUserIdentityId({
      userIdentityId: user.id,
      includeStatuses: [IdentitySessionStatuses.active],
    });
    expect(activeOnly.map((session) => session.id)).toEqual(["session:active"]);

    const removeResult = await adapter.removeSession("session:revoked");
    expect(removeResult.ok).toBeTrue();
    if (removeResult.ok) {
      expect(removeResult.value.changed).toBeTrue();
    }
    expect(await adapter.getSessionById("session:revoked")).toBeUndefined();

    adapter.dispose();
  });
});
