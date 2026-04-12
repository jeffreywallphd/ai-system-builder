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
import { SecretProviderMaterialKinds } from "@application/security/ports/SecretProviderPorts";
import { DefaultSecretProviderResolutionService } from "@infrastructure/security/DefaultSecretProviderResolutionService";

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
