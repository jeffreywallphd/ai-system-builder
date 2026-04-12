import { describe, expect, it } from "bun:test";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretScopes,
  evaluateSecretAccessDecision,
  type SecretAccessActor,
} from "@domain/security/SecretDomain";
import type { ISecretAccessPolicyPort } from "../ports/SecretServicePorts";
import {
  SecretProviderMaterialKinds,
  type ISecretProviderMaterialResolutionPort,
  type ResolveSecretProviderMaterialExistenceInput,
  type ResolveSecretProviderMaterialInput,
  type ResolveSecretProviderMaterialMetadataInput,
  type SecretProviderMaterialBootstrapInput,
} from "../ports/SecretProviderPorts";
import { ScopedSecretProviderMaterialRetrievalUseCase } from "../use-cases/ScopedSecretProviderMaterialRetrievalUseCase";

class DomainBackedSecretAccessPolicyPort implements ISecretAccessPolicyPort {
  public async evaluateSecretAccess(input: Parameters<ISecretAccessPolicyPort["evaluateSecretAccess"]>[0]) {
    return evaluateSecretAccessDecision(input);
  }
}

class StubSecretProviderResolutionPort implements ISecretProviderMaterialResolutionPort {
  public readonly resolveCalls: ResolveSecretProviderMaterialInput[] = [];
  public readonly metadataCalls: ResolveSecretProviderMaterialMetadataInput[] = [];
  public readonly existsCalls: ResolveSecretProviderMaterialExistenceInput[] = [];

  public async resolveSecretProviderMaterial(
    input: ResolveSecretProviderMaterialInput,
  ): Promise<Awaited<ReturnType<ISecretProviderMaterialResolutionPort["resolveSecretProviderMaterial"]>>> {
    this.resolveCalls.push(input);
    return {
      ok: true,
      value: {
        providerId: input.selector.providerId,
        secretId: input.selector.secretId,
        currentVersionId: `${input.selector.secretId}:v1`,
        scope: input.selector.scope,
        materialKind: input.selector.materialKind,
        rawValue: "resolved-secret-value",
      },
    };
  }

  public async resolveSecretProviderMaterialMetadata(
    input: ResolveSecretProviderMaterialMetadataInput,
  ): Promise<Awaited<ReturnType<ISecretProviderMaterialResolutionPort["resolveSecretProviderMaterialMetadata"]>>> {
    this.metadataCalls.push(input);
    return {
      ok: true,
      value: {
        providerId: input.selector.providerId,
        secretId: input.selector.secretId,
        scope: input.selector.scope,
        materialKind: input.selector.materialKind,
        reference: {
          secretId: input.selector.secretId,
          name: "provider.openai.api-key",
          scope: input.selector.scope.scope,
          workspaceId: input.selector.scope.workspaceId,
          userIdentityId: input.selector.scope.userIdentityId,
          kind: SecretKinds.apiKey,
          state: "active",
          currentVersionId: `${input.selector.secretId}:v1`,
          metadata: {
            tags: [],
            labels: {},
          },
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      },
    };
  }

  public async secretProviderMaterialExists(
    input: ResolveSecretProviderMaterialExistenceInput,
  ): Promise<Awaited<ReturnType<ISecretProviderMaterialResolutionPort["secretProviderMaterialExists"]>>> {
    this.existsCalls.push(input);
    return {
      ok: true,
      value: {
        exists: true,
      },
    };
  }

  public async bootstrapSecretProviderMaterial(
    _input: SecretProviderMaterialBootstrapInput,
  ): Promise<Awaited<ReturnType<ISecretProviderMaterialResolutionPort["bootstrapSecretProviderMaterial"]>>> {
    throw new Error("not implemented");
  }
}

describe("ScopedSecretProviderMaterialRetrievalUseCase", () => {
  it("retrieves server-scoped provider material when caller has retrieve permission", async () => {
    const resolutionPort = new StubSecretProviderResolutionPort();
    const useCase = new ScopedSecretProviderMaterialRetrievalUseCase({
      secretProviderResolutionPort: resolutionPort,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      now: () => new Date("2026-04-10T12:00:00.000Z"),
    });

    const result = await useCase.retrieveServerScopedSecretProviderMaterial({
      caller: createActor({
        actorId: "runtime:server:bootstrap",
        actorType: SecretActorTypes.serverRuntime,
        actions: [SecretAccessActions.retrievePlaintext],
      }),
      providerId: "openai",
      secretId: "secret:server:provider:openai",
      materialKind: SecretProviderMaterialKinds.providerCredential,
      access: {
        operationKey: "op:bootstrap:runtime-check",
        serviceIdentity: "runtime:server:bootstrap",
        usage: "system-secret-bootstrap-runtime-check",
      },
    });

    expect(result.ok).toBeTrue();
    expect(resolutionPort.resolveCalls).toHaveLength(1);
    expect(resolutionPort.resolveCalls[0]?.selector.scope).toEqual({
      scope: SecretScopes.server,
    });
  });

  it("denies workspace-scoped retrieval when caller context does not match workspace scope", async () => {
    const resolutionPort = new StubSecretProviderResolutionPort();
    const useCase = new ScopedSecretProviderMaterialRetrievalUseCase({
      secretProviderResolutionPort: resolutionPort,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
    });

    const result = await useCase.retrieveWorkspaceScopedSecretProviderMaterial({
      caller: createActor({
        actorId: "runtime:workspace:alpha",
        actorType: SecretActorTypes.workspaceService,
        workspaceId: "workspace:alpha",
        actions: [SecretAccessActions.retrievePlaintext],
      }),
      workspaceId: "workspace:beta",
      providerId: "openai",
      secretId: "secret:workspace:beta:provider:openai",
      materialKind: SecretProviderMaterialKinds.providerCredential,
      access: {
        operationKey: "op:workspace:mismatch",
        serviceIdentity: "runtime:workspace:alpha",
        usage: "workspace-provider-runtime",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "secret-access-denied",
        message: "Scoped secret provider material access denied (scope-mismatch).",
        details: {
          action: SecretAccessActions.retrievePlaintext,
          scope: SecretScopes.workspace,
          workspaceId: "workspace:beta",
          userIdentityId: undefined,
        },
      },
    });
    expect(resolutionPort.resolveCalls).toHaveLength(0);
  });

  it("allows metadata/existence flows for user scope with read-metadata permission only", async () => {
    const resolutionPort = new StubSecretProviderResolutionPort();
    const useCase = new ScopedSecretProviderMaterialRetrievalUseCase({
      secretProviderResolutionPort: resolutionPort,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
    });

    const request = {
      caller: createActor({
        actorId: "user:alice",
        actorType: SecretActorTypes.user,
        workspaceId: "workspace:alpha",
        userIdentityId: "user:alice",
        actions: [SecretAccessActions.readMetadata],
      }),
      workspaceId: "workspace:alpha",
      userIdentityId: "user:alice",
      providerId: "openai",
      secretId: "secret:user:workspace:alpha:user:alice:provider:openai",
      materialKind: SecretProviderMaterialKinds.providerCredential,
      access: {
        operationKey: "op:user:metadata",
        serviceIdentity: "api:user-portal",
        usage: "user-provider-metadata",
      },
    } as const;

    const metadata = await useCase.getUserScopedSecretProviderMaterialMetadata(request);
    const exists = await useCase.userScopedSecretProviderMaterialExists(request);

    expect(metadata.ok).toBeTrue();
    expect(exists).toEqual({
      ok: true,
      value: {
        exists: true,
      },
    });
    expect(resolutionPort.metadataCalls).toHaveLength(1);
    expect(resolutionPort.existsCalls).toHaveLength(1);
    expect(resolutionPort.resolveCalls).toHaveLength(0);
  });

  it("denies server-scoped retrieval when caller does not hold retrieve-plaintext permission", async () => {
    const resolutionPort = new StubSecretProviderResolutionPort();
    const useCase = new ScopedSecretProviderMaterialRetrievalUseCase({
      secretProviderResolutionPort: resolutionPort,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
    });

    const result = await useCase.retrieveServerScopedSecretProviderMaterial({
      caller: createActor({
        actorId: "runtime:server:bootstrap",
        actorType: SecretActorTypes.serverRuntime,
        actions: [SecretAccessActions.readMetadata],
      }),
      providerId: "openai",
      secretId: "secret:server:provider:openai",
      materialKind: SecretProviderMaterialKinds.providerCredential,
      access: {
        operationKey: "op:bootstrap:runtime-check",
        serviceIdentity: "runtime:server:bootstrap",
        usage: "system-secret-bootstrap-runtime-check",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "secret-access-denied",
        message: "Scoped secret provider material access denied (missing-permission).",
        details: {
          action: SecretAccessActions.retrievePlaintext,
          scope: SecretScopes.server,
          workspaceId: undefined,
          userIdentityId: undefined,
        },
      },
    });
    expect(resolutionPort.resolveCalls).toHaveLength(0);
  });
});

function createActor(input: {
  readonly actorId: string;
  readonly actorType: SecretAccessActor["actorType"];
  readonly actions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}): SecretAccessActor {
  return {
    actorId: input.actorId,
    actorType: input.actorType,
    workspaceId: input.workspaceId,
    userIdentityId: input.userIdentityId,
    grantedActions: input.actions,
  };
}
