import { describe, expect, it } from "bun:test";
import { SecretScopes } from "../../../domain/security/SecretDomain";
import {
  SecretServiceErrorCodes,
  type RetrieveSecretPlaintextRequest,
  type RetrieveSecretPlaintextResult,
  type SecretServiceResult,
} from "../use-cases/SecretManagementServiceContracts";
import { SecretRuntimeConsumptionAdapters } from "../services/SecretRuntimeConsumptionAdapters";

class StubRuntimeResolutionUseCase {
  public calls: RetrieveSecretPlaintextRequest[] = [];
  private nextResult: SecretServiceResult<RetrieveSecretPlaintextResult> = {
    ok: true,
    value: Object.freeze({
      secretId: "secret:default",
      currentVersionId: "secret:default:v1",
      scope: Object.freeze({
        scope: SecretScopes.server,
      }),
      plaintext: "default-plaintext",
    }),
  };

  public queueResult(result: SecretServiceResult<RetrieveSecretPlaintextResult>): void {
    this.nextResult = result;
  }

  public async retrieveSecretPlaintextForRuntime(
    request: RetrieveSecretPlaintextRequest,
  ): Promise<SecretServiceResult<RetrieveSecretPlaintextResult>> {
    this.calls.push(request);
    return this.nextResult;
  }
}

describe("SecretRuntimeConsumptionAdapters", () => {
  it("routes workspace provider credential resolution through runtime retrieval use case", async () => {
    const runtimeUseCase = new StubRuntimeResolutionUseCase();
    runtimeUseCase.queueResult({
      ok: true,
      value: {
        secretId: "secret:workspace:provider:openai",
        currentVersionId: "secret:workspace:provider:openai:v3",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        plaintext: "sk-workspace-provider",
      },
    });

    const adapters = new SecretRuntimeConsumptionAdapters(runtimeUseCase);
    const result = await adapters.resolveWorkspaceProviderCredential({
      workspaceId: "workspace:alpha",
      providerId: "openai",
      secretId: "secret:workspace:provider:openai",
      operationKey: "op:runtime:provider:openai",
      serviceIdentity: "runtime:workspace-alpha:provider-gateway",
      occurredAt: "2026-04-05T12:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        secretId: "secret:workspace:provider:openai",
        currentVersionId: "secret:workspace:provider:openai:v3",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        plaintext: "sk-workspace-provider",
        credential: "sk-workspace-provider",
      },
    });
    expect(runtimeUseCase.calls).toHaveLength(1);
    expect(runtimeUseCase.calls[0]).toEqual({
      actor: {
        actorId: "runtime:workspace-alpha:provider-gateway",
        actorType: "workspace-service",
        workspaceId: "workspace:alpha",
        userIdentityId: undefined,
        grantedActions: ["retrieve-plaintext"],
      },
      secretId: "secret:workspace:provider:openai",
      operationKey: "op:runtime:provider:openai",
      runtimeContext: {
        serviceIdentity: "runtime:workspace-alpha:provider-gateway",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        justification: "resolve workspace provider credential for 'openai'",
      },
      occurredAt: "2026-04-05T12:00:00.000Z",
    });
  });

  it("routes user personal API key resolution through runtime retrieval use case", async () => {
    const runtimeUseCase = new StubRuntimeResolutionUseCase();
    runtimeUseCase.queueResult({
      ok: true,
      value: {
        secretId: "secret:user:alice:openai",
        currentVersionId: "secret:user:alice:openai:v2",
        scope: {
          scope: SecretScopes.user,
          workspaceId: "workspace:alpha",
          userIdentityId: "user:alice",
        },
        plaintext: "sk-user-personal",
      },
    });

    const adapters = new SecretRuntimeConsumptionAdapters(runtimeUseCase);
    const result = await adapters.resolveUserPersonalApiKey({
      workspaceId: "workspace:alpha",
      userIdentityId: "user:alice",
      providerId: "openai",
      secretId: "secret:user:alice:openai",
      operationKey: "op:runtime:user-personal-key",
      serviceIdentity: "runtime:workspace-alpha:execution",
      justification: "user-requested provider execution",
    });

    expect(result.ok).toBeTrue();
    expect(runtimeUseCase.calls).toHaveLength(1);
    expect(runtimeUseCase.calls[0]?.actor).toEqual({
      actorId: "runtime:workspace-alpha:execution",
      actorType: "workspace-service",
      workspaceId: "workspace:alpha",
      userIdentityId: "user:alice",
      grantedActions: ["retrieve-plaintext"],
    });
    expect(runtimeUseCase.calls[0]?.runtimeContext.scope).toEqual({
      scope: SecretScopes.user,
      workspaceId: "workspace:alpha",
      userIdentityId: "user:alice",
    });
    expect(runtimeUseCase.calls[0]?.runtimeContext.justification).toBe("user-requested provider execution");
  });

  it("routes server signing credential resolution through runtime retrieval use case", async () => {
    const runtimeUseCase = new StubRuntimeResolutionUseCase();
    const adapters = new SecretRuntimeConsumptionAdapters(runtimeUseCase);

    await adapters.resolveServerSigningCredential({
      secretId: "secret:server:jwt-signing-key",
      operationKey: "op:runtime:server-signing",
      serviceIdentity: "runtime:server:identity-token-service",
      signingPurpose: "identity-session-token-signature",
      occurredAt: "2026-04-05T12:01:00.000Z",
    });

    expect(runtimeUseCase.calls).toHaveLength(1);
    expect(runtimeUseCase.calls[0]).toEqual({
      actor: {
        actorId: "runtime:server:identity-token-service",
        actorType: "server-runtime",
        workspaceId: undefined,
        userIdentityId: undefined,
        grantedActions: ["retrieve-plaintext"],
      },
      secretId: "secret:server:jwt-signing-key",
      operationKey: "op:runtime:server-signing",
      runtimeContext: {
        serviceIdentity: "runtime:server:identity-token-service",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "resolve server signing credential for 'identity-session-token-signature'",
      },
      occurredAt: "2026-04-05T12:01:00.000Z",
    });
  });

  it("returns retrieval errors without bypassing the formal runtime retrieval path", async () => {
    const runtimeUseCase = new StubRuntimeResolutionUseCase();
    runtimeUseCase.queueResult({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: "Secret 'secret:workspace:provider:missing' was not found.",
      },
    });

    const adapters = new SecretRuntimeConsumptionAdapters(runtimeUseCase);
    const result = await adapters.resolveWorkspaceProviderCredential({
      workspaceId: "workspace:alpha",
      providerId: "openai",
      secretId: "secret:workspace:provider:missing",
      operationKey: "op:runtime:provider:missing",
      serviceIdentity: "runtime:workspace-alpha:provider-gateway",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: "Secret 'secret:workspace:provider:missing' was not found.",
      },
    });
    expect(runtimeUseCase.calls).toHaveLength(1);
  });
});
