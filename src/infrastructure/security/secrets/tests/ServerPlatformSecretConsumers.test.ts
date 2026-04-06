import { describe, expect, it } from "bun:test";
import { SecretScopes } from "../../../../domain/security/SecretDomain";
import type { SecretServiceResult } from "../../../../application/security/use-cases/SecretManagementServiceContracts";
import type { SecretRuntimeConsumptionAdapters } from "../../../../application/security/services/SecretRuntimeConsumptionAdapters";
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
});
