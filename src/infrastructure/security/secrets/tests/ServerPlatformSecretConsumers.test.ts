import { describe, expect, it } from "bun:test";
import { SecretScopes } from "@domain/security/SecretDomain";
import type { SecretServiceResult } from "@application/security/use-cases/SecretManagementServiceContracts";
import type { SecretRuntimeConsumptionAdapters } from "@application/security/services/SecretRuntimeConsumptionAdapters";
import {
  ServerPlatformProviderIds,
  ServerPlatformSecretConsumers,
} from "../ServerPlatformSecretConsumers";

class StubSecretRuntimeConsumptionAdapters {
  public readonly requests: Array<Record<string, unknown>> = [];

  public async resolveServerSigningCredential(
    request: Parameters<SecretRuntimeConsumptionAdapters["resolveServerSigningCredential"]>[0],
  ): Promise<Awaited<ReturnType<SecretRuntimeConsumptionAdapters["resolveServerSigningCredential"]>>> {
    this.requests.push(request as unknown as Record<string, unknown>);
    const secretId = request.secretId;
    if (secretId === "secret:missing") {
      return {
        ok: false,
        error: {
          code: "secret-not-found",
          message: "secret missing",
        },
      };
    }

    return {
      ok: true,
      value: {
        secretId,
        currentVersionId: `${secretId}:v1`,
        scope: {
          scope: SecretScopes.server,
        },
        plaintext: "credential-value",
        credential: "credential-value",
      },
    };
  }

  public async resolveWorkspaceProviderCredential(
    request: Parameters<SecretRuntimeConsumptionAdapters["resolveWorkspaceProviderCredential"]>[0],
  ): Promise<Awaited<ReturnType<SecretRuntimeConsumptionAdapters["resolveWorkspaceProviderCredential"]>>> {
    this.requests.push(request as unknown as Record<string, unknown>);
    return {
      ok: true,
      value: {
        secretId: request.secretId,
        currentVersionId: `${request.secretId}:v1`,
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: request.workspaceId,
        },
        plaintext: "workspace-credential",
        credential: "workspace-credential",
      },
    };
  }

  public async resolveUserPersonalApiKey(
    request: Parameters<SecretRuntimeConsumptionAdapters["resolveUserPersonalApiKey"]>[0],
  ): Promise<Awaited<ReturnType<SecretRuntimeConsumptionAdapters["resolveUserPersonalApiKey"]>>> {
    this.requests.push(request as unknown as Record<string, unknown>);
    return {
      ok: true,
      value: {
        secretId: request.secretId,
        currentVersionId: `${request.secretId}:v1`,
        scope: {
          scope: SecretScopes.user,
          userIdentityId: request.userIdentityId,
          workspaceId: request.workspaceId,
        },
        plaintext: "user-credential",
        credential: "user-credential",
      },
    };
  }
}

describe("ServerPlatformSecretConsumers", () => {
  it("resolves provider credentials via server signing runtime adapter semantics", async () => {
    const adapters = new StubSecretRuntimeConsumptionAdapters();
    const consumers = new ServerPlatformSecretConsumers(
      adapters as unknown as SecretRuntimeConsumptionAdapters,
    );

    const result = await consumers.resolveServerProviderCredential({
      providerId: ServerPlatformProviderIds.openAi,
      secretId: "secret:server:provider:openai",
      operationKey: "op:test:provider:openai",
      serviceIdentity: "runtime:server:provider-client",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        secretId: "secret:server:provider:openai",
        currentVersionId: "secret:server:provider:openai:v1",
        credential: "credential-value",
      },
    });
    expect(adapters.requests).toEqual([
      {
        secretId: "secret:server:provider:openai",
        operationKey: "op:test:provider:openai",
        serviceIdentity: "runtime:server:provider-client",
        signingPurpose: "provider-credential:openai",
        justification: "resolve server provider credential for 'openai'",
        occurredAt: undefined,
      },
    ]);
  });

  it("resolves identity-session signing material via runtime adapter", async () => {
    const adapters = new StubSecretRuntimeConsumptionAdapters();
    const consumers = new ServerPlatformSecretConsumers(
      adapters as unknown as SecretRuntimeConsumptionAdapters,
    );

    const result = await consumers.resolveIdentitySessionSigningMaterial({
      secretId: "secret:server:signing:identity-session",
      operationKey: "op:test:identity-session-signing",
      serviceIdentity: "runtime:server:identity-session-service",
      signingPurpose: "identity-session-token-signing",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        secretId: "secret:server:signing:identity-session",
        currentVersionId: "secret:server:signing:identity-session:v1",
        credential: "credential-value",
      },
    });
  });

  it("passes through runtime adapter failures", async () => {
    const adapters = new StubSecretRuntimeConsumptionAdapters();
    const consumers = new ServerPlatformSecretConsumers(
      adapters as unknown as SecretRuntimeConsumptionAdapters,
    );

    const result = await consumers.resolveIdentitySessionSigningMaterial({
      secretId: "secret:missing",
      operationKey: "op:test:identity-session-signing:missing",
      serviceIdentity: "runtime:server:identity-session-service",
      signingPurpose: "identity-session-token-signing",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "secret-not-found",
        message: "secret missing",
      },
    } satisfies SecretServiceResult<never>);
  });

  it("resolves workspace provider credentials via the shared material resolver interface", async () => {
    const adapters = new StubSecretRuntimeConsumptionAdapters();
    const consumers = new ServerPlatformSecretConsumers(
      adapters as unknown as SecretRuntimeConsumptionAdapters,
    );

    const result = await consumers.resolveWorkspaceProviderCredential({
      workspaceId: "workspace-alpha",
      providerId: "openai",
      secretId: "secret:workspace:provider:openai",
      operationKey: "op:test:workspace-provider-openai",
      serviceIdentity: "runtime:workspace:provider-client",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        secretId: "secret:workspace:provider:openai",
        currentVersionId: "secret:workspace:provider:openai:v1",
        credential: "workspace-credential",
      },
    });
  });

  it("resolves user provider credentials via the shared material resolver interface", async () => {
    const adapters = new StubSecretRuntimeConsumptionAdapters();
    const consumers = new ServerPlatformSecretConsumers(
      adapters as unknown as SecretRuntimeConsumptionAdapters,
    );

    const result = await consumers.resolveUserProviderCredential({
      userIdentityId: "user-alpha",
      workspaceId: "workspace-alpha",
      providerId: "openai",
      secretId: "secret:user:provider:openai",
      operationKey: "op:test:user-provider-openai",
      serviceIdentity: "runtime:user:provider-client",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        secretId: "secret:user:provider:openai",
        currentVersionId: "secret:user:provider:openai:v1",
        credential: "user-credential",
      },
    });
  });
});

