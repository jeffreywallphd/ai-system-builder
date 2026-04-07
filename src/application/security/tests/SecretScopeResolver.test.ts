import { describe, expect, it } from "bun:test";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretScopes,
  createSecretRecord,
  evaluateSecretAccessDecision,
  type SecretAccessActor,
  type SecretRecord,
} from "@domain/security/SecretDomain";
import type {
  ISecretAccessPolicyPort,
  ISecretRecordPersistenceRepository,
  SecretCreatePersistenceInput,
  SecretListQuery,
  SecretMutationResult,
} from "../ports/SecretServicePorts";
import {
  SecretScopeDuplicateMatchPolicies,
  SecretScopeResolutionModes,
  SecretScopeResolutionOutcomes,
  SecretScopeResolver,
} from "../use-cases/SecretScopeResolver";

class InMemorySecretRecordRepository implements ISecretRecordPersistenceRepository {
  private readonly records = new Map<string, SecretRecord>();

  public async findSecretById(secretId: string): Promise<SecretRecord | undefined> {
    return this.records.get(secretId.trim());
  }

  public async findSecretByNameAndScope(input: {
    readonly name: string;
    readonly owner: SecretRecord["owner"];
  }): Promise<SecretRecord | undefined> {
    const normalizedName = input.name.trim().toLowerCase();
    for (const record of this.records.values()) {
      if (
        record.reference.name === normalizedName
        && record.owner.scope === input.owner.scope
        && record.owner.workspaceId === input.owner.workspaceId
        && record.owner.userIdentityId === input.owner.userIdentityId
      ) {
        return record;
      }
    }

    return undefined;
  }

  public async listSecrets(_query: SecretListQuery): Promise<readonly SecretRecord["reference"][]> {
    return [];
  }

  public async createSecret(
    input: SecretCreatePersistenceInput,
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    this.records.set(input.record.secretId, input.record);
    return {
      changed: true,
      wasReplay: false,
      record: input.record,
    };
  }

  public async saveSecret(
    record: SecretRecord,
    _mutation: SecretCreatePersistenceInput["mutation"],
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    this.records.set(record.secretId, record);
    return {
      changed: true,
      wasReplay: false,
      record,
    };
  }

  public async deleteSecret(
    _secretId: string,
    _mutation: SecretCreatePersistenceInput["mutation"],
  ): Promise<SecretMutationResult> {
    return {
      changed: true,
      wasReplay: false,
    };
  }

  public seed(record: SecretRecord): void {
    this.records.set(record.secretId, record);
  }
}

class DomainBackedSecretAccessPolicyPort implements ISecretAccessPolicyPort {
  public async evaluateSecretAccess(input: Parameters<ISecretAccessPolicyPort["evaluateSecretAccess"]>[0]) {
    return evaluateSecretAccessDecision(input);
  }
}

describe("SecretScopeResolver", () => {
  it("resolves a secret for an explicit workspace scope owner", async () => {
    const repository = new InMemorySecretRecordRepository();
    repository.seed(createWorkspaceSecretRecord({
      secretId: "secret:workspace:1:openai",
      workspaceId: "workspace:1",
      name: "provider.openai.api_key",
    }));

    const resolver = new SecretScopeResolver({
      secretRecordRepository: repository,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
    });

    const result = await resolver.resolveSecretByScope({
      actor: createWorkspaceActor("workspace:1", [SecretAccessActions.readMetadata]),
      name: "provider.openai.api_key",
      policy: {
        mode: SecretScopeResolutionModes.exactScope,
        owners: [{
          scope: SecretScopes.workspace,
          workspaceId: "workspace:1",
        }],
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      outcome: SecretScopeResolutionOutcomes.resolved,
      secret: {
        secretId: "secret:workspace:1:openai",
        name: "provider.openai.api_key",
        scope: SecretScopes.workspace,
        workspaceId: "workspace:1",
        userIdentityId: undefined,
      },
      matchedOwner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:1",
      },
      attemptedOwners: [{
        scope: SecretScopes.workspace,
        workspaceId: "workspace:1",
      }],
    });
  });

  it("denies resolution for cross-workspace owner requests before lookup", async () => {
    const repository = new InMemorySecretRecordRepository();
    repository.seed(createWorkspaceSecretRecord({
      secretId: "secret:workspace:2:openai",
      workspaceId: "workspace:2",
      name: "provider.openai.api_key",
    }));

    const resolver = new SecretScopeResolver({
      secretRecordRepository: repository,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
    });

    const result = await resolver.resolveSecretByScope({
      actor: createWorkspaceActor("workspace:1", [SecretAccessActions.readMetadata]),
      name: "provider.openai.api_key",
      policy: {
        mode: SecretScopeResolutionModes.exactScope,
        owners: [{
          scope: SecretScopes.workspace,
          workspaceId: "workspace:2",
        }],
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "secret-access-denied",
        message: "Actor 'user:workspace:workspace:1' is not allowed to resolve secrets for the requested scope owner.",
        details: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:2",
          userIdentityId: undefined,
          reason: "scope-mismatch",
        },
      },
    });
  });

  it("validates server/workspace/user owner references and rejects invalid combinations", async () => {
    const repository = new InMemorySecretRecordRepository();
    const resolver = new SecretScopeResolver({
      secretRecordRepository: repository,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
    });

    const invalidUserOwner = await resolver.resolveSecretByScope({
      actor: createUserActor("workspace:1", "user:1", [SecretAccessActions.readMetadata]),
      name: "provider.openai.api_key",
      policy: {
        mode: SecretScopeResolutionModes.exactScope,
        owners: [{
          scope: SecretScopes.user,
          workspaceId: "workspace:1",
        }],
      },
    });

    expect(invalidUserOwner).toEqual({
      ok: false,
      error: {
        code: "secret-invalid-request",
        message: "User-scoped secrets require userIdentityId.",
      },
    });

    const serverLookup = await resolver.resolveSecretByScope({
      actor: {
        actorId: "runtime:server",
        actorType: SecretActorTypes.serverRuntime,
        grantedActions: [SecretAccessActions.readMetadata],
      },
      name: "provider.openai.api_key",
      policy: {
        mode: SecretScopeResolutionModes.exactScope,
        owners: [{
          scope: SecretScopes.server,
        }],
      },
    });

    expect(serverLookup).toEqual({
      ok: true,
      value: {
        outcome: SecretScopeResolutionOutcomes.notFound,
        attemptedOwners: [{
          scope: SecretScopes.server,
        }],
      },
    });
  });

  it("returns ambiguous outcome for duplicate secret names across explicit fallback scopes", async () => {
    const repository = new InMemorySecretRecordRepository();
    repository.seed(createWorkspaceSecretRecord({
      secretId: "secret:workspace:1:openai",
      workspaceId: "workspace:1",
      name: "provider.openai.api_key",
    }));
    repository.seed(createUserSecretRecord({
      secretId: "secret:user:workspace:1:openai",
      workspaceId: "workspace:1",
      userIdentityId: "user:1",
      name: "provider.openai.api_key",
    }));

    const resolver = new SecretScopeResolver({
      secretRecordRepository: repository,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
    });

    const result = await resolver.resolveSecretByScope({
      actor: createUserActor("workspace:1", "user:1", [SecretAccessActions.readMetadata]),
      name: "provider.openai.api_key",
      policy: {
        mode: SecretScopeResolutionModes.explicitFallbackChain,
        duplicateMatchPolicy: SecretScopeDuplicateMatchPolicies.fail,
        owners: [{
          scope: SecretScopes.user,
          workspaceId: "workspace:1",
          userIdentityId: "user:1",
        }, {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:1",
        }],
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      outcome: SecretScopeResolutionOutcomes.ambiguous,
      attemptedOwners: [{
        scope: SecretScopes.user,
        workspaceId: "workspace:1",
        userIdentityId: "user:1",
      }, {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:1",
      }],
      matchedSecretIds: [
        "secret:user:workspace:1:openai",
        "secret:workspace:1:openai",
      ],
    });
  });

  it("supports explicit first-match fallback policy when duplicate names exist", async () => {
    const repository = new InMemorySecretRecordRepository();
    repository.seed(createWorkspaceSecretRecord({
      secretId: "secret:workspace:1:openai",
      workspaceId: "workspace:1",
      name: "provider.openai.api_key",
    }));
    repository.seed(createUserSecretRecord({
      secretId: "secret:user:workspace:1:openai",
      workspaceId: "workspace:1",
      userIdentityId: "user:1",
      name: "provider.openai.api_key",
    }));

    const resolver = new SecretScopeResolver({
      secretRecordRepository: repository,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
    });

    const result = await resolver.resolveSecretByScope({
      actor: createUserActor("workspace:1", "user:1", [SecretAccessActions.readMetadata]),
      name: "provider.openai.api_key",
      policy: {
        mode: SecretScopeResolutionModes.explicitFallbackChain,
        duplicateMatchPolicy: SecretScopeDuplicateMatchPolicies.firstMatch,
        owners: [{
          scope: SecretScopes.user,
          workspaceId: "workspace:1",
          userIdentityId: "user:1",
        }, {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:1",
        }],
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      outcome: SecretScopeResolutionOutcomes.resolved,
      secret: {
        secretId: "secret:user:workspace:1:openai",
        name: "provider.openai.api_key",
        scope: SecretScopes.user,
        workspaceId: "workspace:1",
        userIdentityId: "user:1",
      },
      matchedOwner: {
        scope: SecretScopes.user,
        workspaceId: "workspace:1",
        userIdentityId: "user:1",
      },
      attemptedOwners: [{
        scope: SecretScopes.user,
        workspaceId: "workspace:1",
        userIdentityId: "user:1",
      }, {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:1",
      }],
    });
  });
});

function createWorkspaceActor(
  workspaceId: string,
  actions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>,
): SecretAccessActor {
  return {
    actorId: `user:workspace:${workspaceId}`,
    actorType: SecretActorTypes.workspaceMember,
    workspaceId,
    grantedActions: actions,
  };
}

function createUserActor(
  workspaceId: string,
  userIdentityId: string,
  actions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>,
): SecretAccessActor {
  return {
    actorId: userIdentityId,
    actorType: SecretActorTypes.user,
    workspaceId,
    userIdentityId,
    grantedActions: actions,
  };
}

function createWorkspaceSecretRecord(input: {
  readonly secretId: string;
  readonly workspaceId: string;
  readonly name: string;
}): SecretRecord {
  return createSecretRecord({
    secretId: input.secretId,
    name: input.name,
    owner: {
      scope: SecretScopes.workspace,
      workspaceId: input.workspaceId,
    },
    kind: SecretKinds.apiKey,
    createdBy: "user:workspace-admin",
    createdAt: "2026-04-06T10:00:00.000Z",
    initialVersion: {
      versionId: `${input.secretId}:v1`,
      createdBy: "user:workspace-admin",
      encryptedPayloadRef: `enc:${input.secretId}:v1`,
      payloadDigestSha256: `sha256:${input.secretId}:v1`,
      payloadByteLength: 12,
      keyEncryptionContext: {
        keyId: `kek:workspace:${input.workspaceId}`,
        algorithm: "aes-256-gcm",
        scope: SecretScopes.workspace,
        workspaceId: input.workspaceId,
      },
    },
  });
}

function createUserSecretRecord(input: {
  readonly secretId: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly name: string;
}): SecretRecord {
  return createSecretRecord({
    secretId: input.secretId,
    name: input.name,
    owner: {
      scope: SecretScopes.user,
      workspaceId: input.workspaceId,
      userIdentityId: input.userIdentityId,
    },
    kind: SecretKinds.apiKey,
    createdBy: input.userIdentityId,
    createdAt: "2026-04-06T10:00:00.000Z",
    initialVersion: {
      versionId: `${input.secretId}:v1`,
      createdBy: input.userIdentityId,
      encryptedPayloadRef: `enc:${input.secretId}:v1`,
      payloadDigestSha256: `sha256:${input.secretId}:v1`,
      payloadByteLength: 12,
      keyEncryptionContext: {
        keyId: `kek:user:${input.userIdentityId}`,
        algorithm: "aes-256-gcm",
        scope: SecretScopes.user,
        workspaceId: input.workspaceId,
        userIdentityId: input.userIdentityId,
      },
    },
  });
}

