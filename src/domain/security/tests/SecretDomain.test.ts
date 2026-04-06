import { describe, expect, it } from "bun:test";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretDomainError,
  SecretKinds,
  SecretRecordStates,
  SecretScopes,
  SecretVersionStates,
  createSecretRecord,
  createSecretScopeOwner,
  disableSecretRecord,
  evaluateSecretAccessDecision,
  revokeSecretRecord,
  rotateSecretRecord,
} from "../SecretDomain";

describe("SecretDomain", () => {
  it("enforces scope ownership combinations", () => {
    expect(() => createSecretScopeOwner({ scope: SecretScopes.server, workspaceId: "workspace:1" })).toThrow(
      SecretDomainError,
    );
    expect(() => createSecretScopeOwner({ scope: SecretScopes.workspace })).toThrow(SecretDomainError);
    expect(() => createSecretScopeOwner({ scope: SecretScopes.user })).toThrow(SecretDomainError);

    expect(createSecretScopeOwner({ scope: SecretScopes.server })).toEqual({
      scope: SecretScopes.server,
      workspaceId: undefined,
      userIdentityId: undefined,
    });

    expect(createSecretScopeOwner({ scope: SecretScopes.workspace, workspaceId: "workspace:1" })).toEqual({
      scope: SecretScopes.workspace,
      workspaceId: "workspace:1",
      userIdentityId: undefined,
    });

    expect(createSecretScopeOwner({ scope: SecretScopes.user, userIdentityId: "user:1" })).toEqual({
      scope: SecretScopes.user,
      workspaceId: undefined,
      userIdentityId: "user:1",
    });
  });

  it("enforces secret naming and redaction-safe metadata", () => {
    expect(() => createSecretRecord({
      secretId: "secret:invalid:name",
      name: "Invalid Name",
      owner: { scope: SecretScopes.server },
      kind: SecretKinds.apiKey,
      metadata: {
        labels: {
          safe: "ok",
        },
      },
      initialVersion: {
        versionId: "version:1",
        createdBy: "user:admin",
        encryptedPayloadRef: "enc:payload:1",
        payloadDigestSha256: "digest:1",
        payloadByteLength: 128,
        keyEncryptionContext: {
          keyId: "kek:server:1",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.server,
        },
      },
      createdBy: "user:admin",
      createdAt: "2026-04-05T12:00:00.000Z",
    })).toThrow(SecretDomainError);

    expect(() => createSecretRecord({
      secretId: "secret:metadata:key",
      name: "llm.openai.key",
      owner: { scope: SecretScopes.server },
      kind: SecretKinds.apiKey,
      metadata: {
        labels: {
          private_key: "abc",
        },
      },
      initialVersion: {
        versionId: "version:1",
        createdBy: "user:admin",
        encryptedPayloadRef: "enc:payload:1",
        payloadDigestSha256: "digest:1",
        payloadByteLength: 128,
        keyEncryptionContext: {
          keyId: "kek:server:1",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.server,
        },
      },
      createdBy: "user:admin",
      createdAt: "2026-04-05T12:00:00.000Z",
    })).toThrow(SecretDomainError);

    const valid = createSecretRecord({
      secretId: "secret:server:openai",
      name: "llm.openai.api_key",
      owner: { scope: SecretScopes.server },
      kind: SecretKinds.apiKey,
      metadata: {
        tags: ["OpenAI", "Production", "openai"],
        labels: {
          service: "openai",
          owner: "platform",
        },
      },
      initialVersion: {
        versionId: "version:1",
        createdBy: "user:admin",
        encryptedPayloadRef: "enc:payload:1",
        payloadDigestSha256: "digest:1",
        payloadByteLength: 128,
        keyEncryptionContext: {
          keyId: "kek:server:1",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.server,
        },
      },
      createdBy: "user:admin",
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    expect(valid.reference.name).toBe("llm.openai.api_key");
    expect(valid.reference.metadata.tags).toEqual(["openai", "production"]);
  });

  it("tracks version lineage and lifecycle state transitions", () => {
    const created = createSecretRecord({
      secretId: "secret:workspace:1",
      name: "workspace.database.connection",
      owner: { scope: SecretScopes.workspace, workspaceId: "workspace:1" },
      kind: SecretKinds.connectionString,
      initialVersion: {
        versionId: "version:1",
        createdBy: "user:owner",
        encryptedPayloadRef: "enc:payload:1",
        payloadDigestSha256: "digest:1",
        payloadByteLength: 321,
        keyEncryptionContext: {
          keyId: "kek:workspace:1",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.workspace,
          workspaceId: "workspace:1",
        },
      },
      createdBy: "user:owner",
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    const rotated = rotateSecretRecord({
      record: created,
      rotatedBy: "user:owner",
      rotatedAt: "2026-05-05T12:00:00.000Z",
      nextVersion: {
        versionId: "version:2",
        createdBy: "user:owner",
        encryptedPayloadRef: "enc:payload:2",
        payloadDigestSha256: "digest:2",
        payloadByteLength: 456,
        keyEncryptionContext: {
          keyId: "kek:workspace:2",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.workspace,
          workspaceId: "workspace:1",
        },
      },
    });

    expect(rotated.versions).toHaveLength(2);
    expect(rotated.currentVersionId).toBe("version:2");
    expect(rotated.versions[0]?.state).toBe(SecretVersionStates.superseded);
    expect(rotated.versions[0]?.supersededByVersionId).toBe("version:2");
    expect(rotated.versions[1]?.previousVersionId).toBe("version:1");

    const revoked = revokeSecretRecord({
      record: rotated,
      revokedBy: "user:owner",
      revokedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(revoked.state).toBe(SecretRecordStates.revoked);
    expect(revoked.versions[1]?.state).toBe(SecretVersionStates.revoked);

    const disabled = disableSecretRecord({
      record: rotated,
      disabledBy: "user:owner",
      disabledAt: "2026-06-01T01:00:00.000Z",
    });
    expect(disabled.state).toBe(SecretRecordStates.disabled);
  });

  it("produces permission and state-aware secret access decisions", () => {
    const record = createSecretRecord({
      secretId: "secret:user:1",
      name: "user.github.token",
      owner: { scope: SecretScopes.user, userIdentityId: "user:1" },
      kind: SecretKinds.accessToken,
      protectionPolicy: {
        allowRuntimePlaintextRetrieval: false,
      },
      initialVersion: {
        versionId: "version:1",
        createdBy: "user:1",
        encryptedPayloadRef: "enc:payload:user:1",
        payloadDigestSha256: "digest:user:1",
        payloadByteLength: 64,
        keyEncryptionContext: {
          keyId: "kek:user:1",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.user,
          userIdentityId: "user:1",
        },
      },
      createdBy: "user:1",
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    const deniedPermission = evaluateSecretAccessDecision({
      action: SecretAccessActions.retrievePlaintext,
      actor: {
        actorId: "user:1",
        actorType: SecretActorTypes.user,
        userIdentityId: "user:1",
        grantedActions: [SecretAccessActions.readMetadata],
      },
      owner: record.owner,
      record,
      occurredAt: "2026-04-05T12:10:00.000Z",
    });
    expect(deniedPermission.allowed).toBeFalse();
    expect(deniedPermission.reason).toBe("missing-permission");

    const deniedPolicy = evaluateSecretAccessDecision({
      action: SecretAccessActions.retrievePlaintext,
      actor: {
        actorId: "user:1",
        actorType: SecretActorTypes.user,
        userIdentityId: "user:1",
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      owner: record.owner,
      record,
      occurredAt: "2026-04-05T12:12:00.000Z",
    });
    expect(deniedPolicy.allowed).toBeFalse();
    expect(deniedPolicy.reason).toBe("plaintext-retrieval-disabled");

    const allowedMetadata = evaluateSecretAccessDecision({
      action: SecretAccessActions.readMetadata,
      actor: {
        actorId: "user:1",
        actorType: SecretActorTypes.user,
        userIdentityId: "user:1",
        grantedActions: [SecretAccessActions.readMetadata],
      },
      owner: record.owner,
      record,
      occurredAt: "2026-04-05T12:15:00.000Z",
    });
    expect(allowedMetadata.allowed).toBeTrue();
    expect(allowedMetadata.reason).toBe("allowed");
  });
});
