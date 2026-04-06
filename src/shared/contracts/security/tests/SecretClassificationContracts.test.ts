import { describe, expect, it } from "bun:test";
import { SecretKinds, SecretScopes } from "../../../../domain/security/SecretDomain";
import {
  SecretClassificationContractError,
  SecretClassificationIds,
  assertSecretClassificationSupport,
  findSecretClassificationByName,
  listSecretClassifications,
  serializeSecretClassificationRegistry,
} from "../SecretClassificationContracts";

describe("SecretClassificationContracts", () => {
  it("seeds baseline secret classifications for provider, personal, storage, signing, and integration secrets", () => {
    const seededIds = listSecretClassifications().map((classification) => classification.classificationId);
    expect(seededIds).toEqual([
      SecretClassificationIds.providerCredential,
      SecretClassificationIds.personalApiKey,
      SecretClassificationIds.storageCredential,
      SecretClassificationIds.signingMaterial,
      SecretClassificationIds.integrationToken,
    ]);
  });

  it("resolves classifications by canonical naming prefix", () => {
    const provider = findSecretClassificationByName("provider.openai.primary");
    const personal = findSecretClassificationByName("personal.github.default");
    const storage = findSecretClassificationByName("storage.s3.assets");
    const signing = findSecretClassificationByName("signing.ca.root");
    const integration = findSecretClassificationByName("integration.discord.workspace-alpha");

    expect(provider?.classificationId).toBe(SecretClassificationIds.providerCredential);
    expect(personal?.classificationId).toBe(SecretClassificationIds.personalApiKey);
    expect(storage?.classificationId).toBe(SecretClassificationIds.storageCredential);
    expect(signing?.classificationId).toBe(SecretClassificationIds.signingMaterial);
    expect(integration?.classificationId).toBe(SecretClassificationIds.integrationToken);
  });

  it("enforces classification kind, scope, and required metadata label conventions", () => {
    expect(() => assertSecretClassificationSupport({
      name: "provider.openai.production",
      kind: SecretKinds.apiKey,
      owner: {
        scope: SecretScopes.server,
      },
      metadata: {
        tags: [],
        labels: {
          provider: "openai",
          usage: "model-inference",
        },
      },
    })).not.toThrow();

    expect(() => assertSecretClassificationSupport({
      name: "provider.openai.production",
      kind: SecretKinds.privateKey,
      owner: {
        scope: SecretScopes.server,
      },
      metadata: {
        tags: [],
        labels: {
          provider: "openai",
          usage: "model-inference",
        },
      },
    })).toThrow(SecretClassificationContractError);

    expect(() => assertSecretClassificationSupport({
      name: "personal.openai.jeff",
      kind: SecretKinds.apiKey,
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
      metadata: {
        tags: [],
        labels: {
          provider: "openai",
          owner: "user:jeff",
        },
      },
    })).toThrow(SecretClassificationContractError);

    expect(() => assertSecretClassificationSupport({
      name: "integration.discord.workspace-alpha",
      kind: SecretKinds.accessToken,
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
      metadata: {
        tags: [],
        labels: {
          integration: "discord",
        },
      },
    })).toThrow(SecretClassificationContractError);
  });

  it("keeps registry serialization stable for contract snapshots", () => {
    const left = serializeSecretClassificationRegistry();
    const right = serializeSecretClassificationRegistry();
    expect(left).toBe(right);
    expect(JSON.parse(left)).toMatchObject({
      version: 1,
      classifications: [
        {
          classificationId: SecretClassificationIds.providerCredential,
          namePrefix: "provider.",
        },
        {
          classificationId: SecretClassificationIds.personalApiKey,
          namePrefix: "personal.",
        },
        {
          classificationId: SecretClassificationIds.storageCredential,
          namePrefix: "storage.",
        },
        {
          classificationId: SecretClassificationIds.signingMaterial,
          namePrefix: "signing.",
        },
        {
          classificationId: SecretClassificationIds.integrationToken,
          namePrefix: "integration.",
        },
      ],
    });
  });
});
