import { describe, expect, it } from "bun:test";
import { SecretKinds, SecretScopes } from "@domain/security/SecretDomain";
import {
  SecretProviderBootstrapOutcomes,
  SecretProviderMaterialKinds,
  type ISecretProviderMaterialResolutionPort,
} from "../ports/SecretProviderPorts";

class StubSecretProviderResolutionPort implements ISecretProviderMaterialResolutionPort {
  public async resolveSecretProviderMaterial(
    _input: Parameters<ISecretProviderMaterialResolutionPort["resolveSecretProviderMaterial"]>[0],
  ) {
    return {
      ok: true as const,
      value: {
        providerId: "openai",
        secretId: "secret:server:provider:openai",
        currentVersionId: "secret:server:provider:openai:v1",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
        rawValue: "sk-value",
      },
    };
  }

  public async resolveSecretProviderMaterialMetadata(
    _input: Parameters<ISecretProviderMaterialResolutionPort["resolveSecretProviderMaterialMetadata"]>[0],
  ) {
    return {
      ok: true as const,
      value: {
        providerId: "openai",
        secretId: "secret:server:provider:openai",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
        reference: {
          secretId: "secret:server:provider:openai",
          name: "provider.openai.api-key",
          scope: SecretScopes.server,
          kind: SecretKinds.apiKey,
          state: "active",
          currentVersionId: "secret:server:provider:openai:v1",
          metadata: {
            tags: [],
            labels: {},
          },
          updatedAt: "2026-04-08T00:00:00.000Z",
        },
      },
    };
  }

  public async secretProviderMaterialExists(
    _input: Parameters<ISecretProviderMaterialResolutionPort["secretProviderMaterialExists"]>[0],
  ) {
    return {
      ok: true as const,
      value: {
        exists: true,
      },
    };
  }

  public async bootstrapSecretProviderMaterial(
    _input: Parameters<ISecretProviderMaterialResolutionPort["bootstrapSecretProviderMaterial"]>[0],
  ) {
    return {
      ok: true as const,
      value: {
        outcome: SecretProviderBootstrapOutcomes.existing,
        reference: {
          providerId: "openai",
          secretId: "secret:server:provider:openai",
          scope: {
            scope: SecretScopes.server,
          },
          materialKind: SecretProviderMaterialKinds.providerCredential,
          reference: {
            secretId: "secret:server:provider:openai",
            name: "provider.openai.api-key",
            scope: SecretScopes.server,
            kind: SecretKinds.apiKey,
            state: "active",
            currentVersionId: "secret:server:provider:openai:v1",
            metadata: {
              tags: [],
              labels: {},
            },
            updatedAt: "2026-04-08T00:00:00.000Z",
          },
        },
      },
    };
  }
}

describe("SecretProviderPorts", () => {
  it("defines typed provider material kinds and bootstrap outcomes", () => {
    expect(SecretProviderMaterialKinds.providerCredential).toBe("provider-credential");
    expect(SecretProviderMaterialKinds.signingMaterial).toBe("signing-material");
    expect(SecretProviderBootstrapOutcomes.created).toBe("created");
    expect(SecretProviderBootstrapOutcomes.existing).toBe("existing");
  });

  it("supports a unified provider resolution surface across scope-aware read and bootstrap operations", async () => {
    const port = new StubSecretProviderResolutionPort();
    const exists = await port.secretProviderMaterialExists({
      selector: {
        providerId: "openai",
        secretId: "secret:server:provider:openai",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:provider:exists",
        serviceIdentity: "runtime:server:test",
        usage: "metadata-check",
      },
    });

    expect(exists).toEqual({
      ok: true,
      value: {
        exists: true,
      },
    });
  });
});
