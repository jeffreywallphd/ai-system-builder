import { describe, expect, it } from "bun:test";
import { SecretKinds, SecretScopes } from "../../../../domain/security/SecretDomain";
import {
  SecretApiSchemaValidationError,
  parseCreateSecretMetadataCommand,
  parseDisableSecretMetadataCommand,
  parseGetSecretMetadataQuery,
  parseListSecretMetadataQuery,
} from "../SecretApiSchemaContracts";

describe("SecretApiSchemaContracts", () => {
  it("parses valid create command payloads", () => {
    const parsed = parseCreateSecretMetadataCommand({
      operationKey: "op:secret:create:1",
      secretId: "secret:user:openai",
      name: "personal.openai.api-key",
      owner: {
        scope: SecretScopes.user,
        userIdentityId: "user:alpha",
      },
      kind: SecretKinds.apiKey,
      plaintext: "sk-live-value",
      classificationId: "personal-api-key",
      rotationInstruction: {
        mode: "scheduled",
        rotateEveryDays: 30,
      },
      metadata: {
        displayName: "OpenAI Personal Key",
        tags: ["OpenAI", "Inference"],
        labels: {
          provider: "openai",
          owner: "user:alpha",
        },
      },
      createdAt: "2026-04-06T10:00:00.000Z",
    });

    expect(parsed.name).toBe("personal.openai.api-key");
    expect(parsed.rotationInstruction?.mode).toBe("scheduled");
    expect(parsed.metadata?.tags).toEqual(["openai", "inference"]);
  });

  it("rejects classification mismatches with stable issues", () => {
    expect(() => parseCreateSecretMetadataCommand({
      secretId: "secret:server:token",
      name: "personal.openai.api-key",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.apiKey,
      plaintext: "x",
      classificationId: "provider-credential",
    })).toThrow(SecretApiSchemaValidationError);

    try {
      parseCreateSecretMetadataCommand({
        secretId: "secret:server:token",
        name: "personal.openai.api-key",
        owner: {
          scope: SecretScopes.server,
        },
        kind: SecretKinds.apiKey,
        plaintext: "x",
        classificationId: "provider-credential",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SecretApiSchemaValidationError);
      const validationError = error as SecretApiSchemaValidationError;
      expect(validationError.schemaName).toBe("CreateSecretMetadataCommand");
      expect(validationError.issues.some((issue) => issue.path === "name")).toBeTrue();
    }
  });

  it("parses list/get/disable query and command payloads", () => {
    const listParsed = parseListSecretMetadataQuery({
      owner: {
        scope: SecretScopes.user,
        userIdentityId: "user:alpha",
      },
      actorWorkspaceId: "workspace:alpha",
      kinds: [SecretKinds.apiKey],
      includeDisabled: false,
      includeArchived: true,
      includeSoftDeleted: false,
      limit: 25,
      offset: 0,
    });
    expect(listParsed.owner.scope).toBe(SecretScopes.user);
    expect(listParsed.includeArchived).toBeTrue();

    const getParsed = parseGetSecretMetadataQuery({
      secretId: "secret:user:openai",
      occurredAt: "2026-04-06T10:00:00.000Z",
    });
    expect(getParsed.secretId).toBe("secret:user:openai");

    const disableParsed = parseDisableSecretMetadataCommand({
      secretId: "secret:user:openai",
      operationKey: "op:disable:1",
    });
    expect(disableParsed.operationKey).toBe("op:disable:1");
  });

  it("rejects unsafe metadata label keys", () => {
    expect(() => parseCreateSecretMetadataCommand({
      secretId: "secret:user:openai",
      name: "personal.openai.api-key",
      owner: {
        scope: SecretScopes.user,
        userIdentityId: "user:alpha",
      },
      kind: SecretKinds.apiKey,
      plaintext: "sk-live",
      metadata: {
        labels: {
          api_key: "visible",
        },
      },
    })).toThrow(SecretApiSchemaValidationError);
  });
});
