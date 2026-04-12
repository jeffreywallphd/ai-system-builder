import { describe, expect, it } from "bun:test";
import { SecretKinds, SecretScopes, type SecretReference, type SecretScopeOwner } from "@domain/security/SecretDomain";
import type { SecretRuntimeConsumptionAdapters } from "@application/security/services/SecretRuntimeConsumptionAdapters";
import {
  SecretServiceErrorCodes,
  type CreateSecretRequest,
  type CreateSecretResult,
  type GetSecretMetadataRequest,
  type SecretServiceResult,
} from "@application/security/use-cases/SecretManagementServiceContracts";
import {
  SecretProviderMaterialBackendKinds,
  SecretProviderMaterialKinds,
  SecretProviderMaterialRotationStatuses,
} from "@application/security/ports/SecretProviderPorts";
import { DefaultSecretProviderResolutionService } from "@infrastructure/security/DefaultSecretProviderResolutionService";
import { LocalUserSecureSecretStoreBackend } from "@infrastructure/security/secrets/LocalUserSecureSecretStoreBackend";

class StubRuntimeSecretConsumptionAdapters {
  public readonly serverRequests: Array<Record<string, unknown>> = [];
  public readonly workspaceRequests: Array<Record<string, unknown>> = [];
  public readonly userRequests: Array<Record<string, unknown>> = [];

  public async resolveServerSigningCredential(
    request: Parameters<SecretRuntimeConsumptionAdapters["resolveServerSigningCredential"]>[0],
  ): Promise<Awaited<ReturnType<SecretRuntimeConsumptionAdapters["resolveServerSigningCredential"]>>> {
    this.serverRequests.push(request as unknown as Record<string, unknown>);
    return {
      ok: true,
      value: {
        secretId: request.secretId,
        currentVersionId: `${request.secretId}:v1`,
        scope: {
          scope: SecretScopes.server,
        },
        plaintext: "server-value",
        credential: "server-value",
      },
    };
  }

  public async resolveWorkspaceProviderCredential(
    request: Parameters<SecretRuntimeConsumptionAdapters["resolveWorkspaceProviderCredential"]>[0],
  ): Promise<Awaited<ReturnType<SecretRuntimeConsumptionAdapters["resolveWorkspaceProviderCredential"]>>> {
    this.workspaceRequests.push(request as unknown as Record<string, unknown>);
    return {
      ok: true,
      value: {
        secretId: request.secretId,
        currentVersionId: `${request.secretId}:v7`,
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: request.workspaceId,
        },
        plaintext: "workspace-value",
        credential: "workspace-value",
      },
    };
  }

  public async resolveUserPersonalApiKey(
    request: Parameters<SecretRuntimeConsumptionAdapters["resolveUserPersonalApiKey"]>[0],
  ): Promise<Awaited<ReturnType<SecretRuntimeConsumptionAdapters["resolveUserPersonalApiKey"]>>> {
    this.userRequests.push(request as unknown as Record<string, unknown>);
    return {
      ok: true,
      value: {
        secretId: request.secretId,
        currentVersionId: `${request.secretId}:v4`,
        scope: {
          scope: SecretScopes.user,
          workspaceId: request.workspaceId,
          userIdentityId: request.userIdentityId,
        },
        plaintext: "user-value",
        credential: "user-value",
      },
    };
  }
}

class StubProviderSecretRepository {
  public readonly metadataCalls: GetSecretMetadataRequest[] = [];
  public readonly createCalls: CreateSecretRequest[] = [];
  private readonly references = new Map<string, SecretReference>();

  public async getSecretMetadata(request: GetSecretMetadataRequest): Promise<SecretServiceResult<SecretReference>> {
    this.metadataCalls.push(request);
    const reference = this.references.get(request.secretId);
    if (!reference) {
      return {
        ok: false as const,
        error: {
          code: SecretServiceErrorCodes.notFound,
          message: "not found",
        },
      };
    }

    return {
      ok: true as const,
      value: reference,
    };
  }

  public async createSecret(request: CreateSecretRequest): Promise<SecretServiceResult<CreateSecretResult>> {
    this.createCalls.push(request);
    if (this.references.has(request.secretId)) {
      return {
        ok: false as const,
        error: {
          code: SecretServiceErrorCodes.conflict,
          message: "conflict",
        },
      };
    }

    const reference = createReference({
      secretId: request.secretId,
      name: request.name,
      kind: request.kind,
      owner: request.owner,
      updatedAt: request.createdAt ?? "2026-04-08T00:00:00.000Z",
    });
    this.references.set(request.secretId, reference);

    return {
      ok: true as const,
      value: {
        secret: reference,
      },
    };
  }

  public seed(reference: SecretReference): void {
    this.references.set(reference.secretId, reference);
  }
}

class StubLocalUserSecureSecretStoreBackend {
  public readonly resolveCalls: Array<Record<string, unknown>> = [];
  public readonly metadataCalls: Array<Record<string, unknown>> = [];
  public readonly bootstrapCalls: Array<Record<string, unknown>> = [];

  public resolveResult:
    | Awaited<ReturnType<LocalUserSecureSecretStoreBackend["resolveUserMaterial"]>>
    | undefined;
  public metadataResult:
    | Awaited<ReturnType<LocalUserSecureSecretStoreBackend["resolveUserMaterialMetadata"]>>
    | undefined;
  public bootstrapResult:
    | Awaited<ReturnType<LocalUserSecureSecretStoreBackend["bootstrapUserMaterial"]>>
    | undefined;

  public async resolveUserMaterial(
    input: Parameters<LocalUserSecureSecretStoreBackend["resolveUserMaterial"]>[0],
  ): Promise<Awaited<ReturnType<LocalUserSecureSecretStoreBackend["resolveUserMaterial"]>>> {
    this.resolveCalls.push(input as unknown as Record<string, unknown>);
    return this.resolveResult ?? {
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: "not found",
      },
    };
  }

  public async resolveUserMaterialMetadata(
    input: Parameters<LocalUserSecureSecretStoreBackend["resolveUserMaterialMetadata"]>[0],
  ): Promise<Awaited<ReturnType<LocalUserSecureSecretStoreBackend["resolveUserMaterialMetadata"]>>> {
    this.metadataCalls.push(input as unknown as Record<string, unknown>);
    return this.metadataResult ?? {
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: "not found",
      },
    };
  }

  public async bootstrapUserMaterial(
    input: Parameters<LocalUserSecureSecretStoreBackend["bootstrapUserMaterial"]>[0],
  ): Promise<Awaited<ReturnType<LocalUserSecureSecretStoreBackend["bootstrapUserMaterial"]>>> {
    this.bootstrapCalls.push(input as unknown as Record<string, unknown>);
    return this.bootstrapResult ?? {
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: "not found",
      },
    };
  }
}

describe("DefaultSecretProviderResolutionService", () => {
  it("resolves provider material for server, workspace, and user scopes", async () => {
    const runtimeAdapters = new StubRuntimeSecretConsumptionAdapters();
    const repository = new StubProviderSecretRepository();
    const service = new DefaultSecretProviderResolutionService({
      runtimeSecretConsumptionAdapters: runtimeAdapters as unknown as SecretRuntimeConsumptionAdapters,
      getSecretMetadata: (request) => repository.getSecretMetadata(request),
      createSecret: (request) => repository.createSecret(request),
    });

    const server = await service.resolveSecretProviderMaterial({
      selector: {
        providerId: "openai",
        secretId: "secret:server:provider:openai",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:server",
        serviceIdentity: "runtime:server:test",
        usage: "provider-runtime",
      },
    });
    const workspace = await service.resolveSecretProviderMaterial({
      selector: {
        providerId: "openai",
        secretId: "secret:workspace:provider:openai",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:workspace",
        serviceIdentity: "runtime:workspace:test",
        usage: "provider-runtime",
      },
    });
    const user = await service.resolveSecretProviderMaterial({
      selector: {
        providerId: "openai",
        secretId: "secret:user:provider:openai",
        scope: {
          scope: SecretScopes.user,
          workspaceId: "workspace:alpha",
          userIdentityId: "user:alpha",
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:user",
        serviceIdentity: "runtime:user:test",
        usage: "provider-runtime",
      },
    });

    expect(server.ok).toBeTrue();
    expect(workspace.ok).toBeTrue();
    expect(user.ok).toBeTrue();
    expect(runtimeAdapters.serverRequests).toHaveLength(1);
    expect(runtimeAdapters.workspaceRequests).toHaveLength(1);
    expect(runtimeAdapters.userRequests).toHaveLength(1);
  });

  it("returns existence false for not-found material and true when metadata exists", async () => {
    const runtimeAdapters = new StubRuntimeSecretConsumptionAdapters();
    const repository = new StubProviderSecretRepository();
    repository.seed(createReference({
      secretId: "secret:server:provider:openai",
      name: "provider.openai.api-key",
      kind: SecretKinds.apiKey,
      owner: {
        scope: SecretScopes.server,
      },
      updatedAt: "2026-04-08T01:00:00.000Z",
    }));
    const service = new DefaultSecretProviderResolutionService({
      runtimeSecretConsumptionAdapters: runtimeAdapters as unknown as SecretRuntimeConsumptionAdapters,
      getSecretMetadata: (request) => repository.getSecretMetadata(request),
      createSecret: (request) => repository.createSecret(request),
    });

    const missing = await service.secretProviderMaterialExists({
      selector: {
        providerId: "openai",
        secretId: "secret:server:provider:missing",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:exists:missing",
        serviceIdentity: "runtime:server:test",
        usage: "metadata-check",
      },
    });
    const existing = await service.secretProviderMaterialExists({
      selector: {
        providerId: "openai",
        secretId: "secret:server:provider:openai",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:exists:present",
        serviceIdentity: "runtime:server:test",
        usage: "metadata-check",
      },
    });

    expect(missing).toEqual({
      ok: true,
      value: {
        exists: false,
      },
    });
    expect(existing).toEqual({
      ok: true,
      value: {
        exists: true,
      },
    });
  });

  it("bootstraps new provider material and returns existing when already present", async () => {
    const runtimeAdapters = new StubRuntimeSecretConsumptionAdapters();
    const repository = new StubProviderSecretRepository();
    const service = new DefaultSecretProviderResolutionService({
      runtimeSecretConsumptionAdapters: runtimeAdapters as unknown as SecretRuntimeConsumptionAdapters,
      getSecretMetadata: (request) => repository.getSecretMetadata(request),
      createSecret: (request) => repository.createSecret(request),
    });

    const created = await service.bootstrapSecretProviderMaterial({
      selector: {
        providerId: "openai",
        secretId: "secret:server:provider:openai",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:bootstrap:create",
        serviceIdentity: "runtime:server:bootstrap",
        usage: "bootstrap",
        occurredAt: "2026-04-08T02:00:00.000Z",
      },
      name: "provider.openai.api-key",
      kind: SecretKinds.apiKey,
      plaintext: "sk-created",
      metadata: {
        tags: ["server", "provider", "openai"],
        labels: {
          provider: "openai",
          usage: "model-inference",
        },
      },
    });

    const existing = await service.bootstrapSecretProviderMaterial({
      selector: {
        providerId: "openai",
        secretId: "secret:server:provider:openai",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:bootstrap:existing",
        serviceIdentity: "runtime:server:bootstrap",
        usage: "bootstrap",
      },
      name: "provider.openai.api-key",
      kind: SecretKinds.apiKey,
      plaintext: "sk-created",
    });

    expect(created.ok).toBeTrue();
    if (created.ok) {
      expect(created.value.outcome).toBe("created");
    }
    expect(existing.ok).toBeTrue();
    if (existing.ok) {
      expect(existing.value.outcome).toBe("existing");
    }
    expect(repository.createCalls).toHaveLength(1);
  });

  it("prefers optional local user secure store backend for user-scoped provider resolution", async () => {
    const runtimeAdapters = new StubRuntimeSecretConsumptionAdapters();
    const repository = new StubProviderSecretRepository();
    const localBackend = new StubLocalUserSecureSecretStoreBackend();
    localBackend.resolveResult = {
      ok: true,
      value: {
        providerId: "openai",
        secretId: "secret:user:provider:openai",
        currentVersionId: "secret:user:provider:openai:local-v1",
        scope: {
          scope: SecretScopes.user,
          workspaceId: "workspace:alpha",
          userIdentityId: "user:alpha",
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
        rawValue: "sk-local-user",
      },
    };
    localBackend.metadataResult = {
      ok: true,
      value: {
        providerId: "openai",
        secretId: "secret:user:provider:openai",
        scope: {
          scope: SecretScopes.user,
          workspaceId: "workspace:alpha",
          userIdentityId: "user:alpha",
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
        backend: {
          backendId: SecretProviderMaterialBackendKinds.localUserSecureSecretStore,
          backendKind: SecretProviderMaterialBackendKinds.localUserSecureSecretStore,
        },
        reference: createReference({
          secretId: "secret:user:provider:openai",
          name: "provider.openai.local-user-key",
          kind: SecretKinds.apiKey,
          owner: {
            scope: SecretScopes.user,
            workspaceId: "workspace:alpha",
            userIdentityId: "user:alpha",
          },
          updatedAt: "2026-04-09T00:00:00.000Z",
        }),
        timestamps: {
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
        rotation: {
          status: SecretProviderMaterialRotationStatuses.active,
          currentVersionId: "secret:user:provider:openai:v1",
        },
        policyFlags: {
          metadataSafeForDiagnostics: true,
          plaintextAccessRequiresDedicatedRetrievalFlow: true,
        },
      },
    };
    localBackend.bootstrapResult = {
      ok: true,
      value: {
        outcome: "created",
        reference: {
          providerId: "openai",
          secretId: "secret:user:provider:openai",
          scope: {
            scope: SecretScopes.user,
            workspaceId: "workspace:alpha",
            userIdentityId: "user:alpha",
          },
          materialKind: SecretProviderMaterialKinds.providerCredential,
          backend: {
            backendId: SecretProviderMaterialBackendKinds.localUserSecureSecretStore,
            backendKind: SecretProviderMaterialBackendKinds.localUserSecureSecretStore,
          },
          reference: createReference({
            secretId: "secret:user:provider:openai",
            name: "provider.openai.local-user-key",
            kind: SecretKinds.apiKey,
            owner: {
              scope: SecretScopes.user,
              workspaceId: "workspace:alpha",
              userIdentityId: "user:alpha",
            },
            updatedAt: "2026-04-09T00:00:00.000Z",
          }),
          timestamps: {
            updatedAt: "2026-04-09T00:00:00.000Z",
          },
          rotation: {
            status: SecretProviderMaterialRotationStatuses.active,
            currentVersionId: "secret:user:provider:openai:v1",
          },
          policyFlags: {
            metadataSafeForDiagnostics: true,
            plaintextAccessRequiresDedicatedRetrievalFlow: true,
          },
        },
      },
    };
    const service = new DefaultSecretProviderResolutionService({
      runtimeSecretConsumptionAdapters: runtimeAdapters as unknown as SecretRuntimeConsumptionAdapters,
      getSecretMetadata: (request) => repository.getSecretMetadata(request),
      createSecret: (request) => repository.createSecret(request),
      localUserSecureSecretStoreBackend: localBackend as unknown as LocalUserSecureSecretStoreBackend,
    });

    const selector = {
      providerId: "openai",
      secretId: "secret:user:provider:openai",
      scope: {
        scope: SecretScopes.user,
        workspaceId: "workspace:alpha",
        userIdentityId: "user:alpha",
      },
      materialKind: SecretProviderMaterialKinds.providerCredential,
    } as const;
    const access = {
      operationKey: "op:test:user:local-store",
      serviceIdentity: "runtime:user:test",
      usage: "provider-runtime",
    } as const;

    const resolved = await service.resolveSecretProviderMaterial({
      selector,
      access,
    });
    const metadata = await service.resolveSecretProviderMaterialMetadata({
      selector,
      access,
    });
    const bootstrapped = await service.bootstrapSecretProviderMaterial({
      selector,
      access,
      name: "provider.openai.local-user-key",
      kind: SecretKinds.apiKey,
      plaintext: "sk-local-user",
    });

    expect(resolved.ok).toBeTrue();
    if (resolved.ok) {
      expect(resolved.value.rawValue).toBe("sk-local-user");
    }
    expect(metadata.ok).toBeTrue();
    if (metadata.ok) {
      expect((metadata.value as Record<string, unknown>).rawValue).toBeUndefined();
    }
    expect(bootstrapped.ok).toBeTrue();
    expect(localBackend.resolveCalls).toHaveLength(1);
    expect(localBackend.metadataCalls).toHaveLength(1);
    expect(localBackend.bootstrapCalls).toHaveLength(1);
    expect(runtimeAdapters.userRequests).toHaveLength(0);
  });

  it("falls back to managed user secret resolution when local backend is configured but missing material", async () => {
    const runtimeAdapters = new StubRuntimeSecretConsumptionAdapters();
    const repository = new StubProviderSecretRepository();
    const localBackend = new StubLocalUserSecureSecretStoreBackend();
    const service = new DefaultSecretProviderResolutionService({
      runtimeSecretConsumptionAdapters: runtimeAdapters as unknown as SecretRuntimeConsumptionAdapters,
      getSecretMetadata: (request) => repository.getSecretMetadata(request),
      createSecret: (request) => repository.createSecret(request),
      localUserSecureSecretStoreBackend: localBackend as unknown as LocalUserSecureSecretStoreBackend,
    });

    const resolved = await service.resolveSecretProviderMaterial({
      selector: {
        providerId: "openai",
        secretId: "secret:user:provider:openai",
        scope: {
          scope: SecretScopes.user,
          workspaceId: "workspace:alpha",
          userIdentityId: "user:alpha",
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:user:fallback",
        serviceIdentity: "runtime:user:test",
        usage: "provider-runtime",
      },
    });

    expect(resolved.ok).toBeTrue();
    if (resolved.ok) {
      expect(resolved.value.rawValue).toBe("user-value");
    }
    expect(localBackend.resolveCalls).toHaveLength(1);
    expect(runtimeAdapters.userRequests).toHaveLength(1);
  });
});

function createReference(input: {
  readonly secretId: string;
  readonly name: string;
  readonly kind: SecretReference["kind"];
  readonly owner: SecretScopeOwner;
  readonly updatedAt: string;
}): SecretReference {
  return Object.freeze({
    secretId: input.secretId,
    name: input.name,
    scope: input.owner.scope,
    workspaceId: input.owner.workspaceId,
    userIdentityId: input.owner.userIdentityId,
    kind: input.kind,
    state: "active",
    currentVersionId: `${input.secretId}:v1`,
    metadata: Object.freeze({
      tags: Object.freeze([]),
      labels: Object.freeze({}),
    }),
    updatedAt: input.updatedAt,
  });
}
