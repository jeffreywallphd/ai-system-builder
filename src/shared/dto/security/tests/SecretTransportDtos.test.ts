import { describe, expect, it } from "bun:test";
import { SecretKinds, SecretRecordStates, SecretScopes, type SecretReference } from "@domain/security/SecretDomain";
import { toSecretMetadataQueryDto } from "../SecretTransportDtos";

describe("SecretTransportDtos", () => {
  it("maps secret references to metadata-only query DTOs", () => {
    const reference: SecretReference = Object.freeze({
      secretId: "secret:user:openai",
      name: "personal.openai.api-key",
      scope: SecretScopes.user,
      userIdentityId: "user:alpha",
      kind: SecretKinds.apiKey,
      state: SecretRecordStates.active,
      currentVersionId: "secret:user:openai:v1",
      metadata: Object.freeze({
        tags: Object.freeze(["openai"]),
        labels: Object.freeze({
          provider: "openai",
        }),
      }),
      updatedAt: "2026-04-06T10:00:00.000Z",
    });

    const dto = toSecretMetadataQueryDto(reference);
    expect(dto.secretId).toBe("secret:user:openai");
    expect((dto as Record<string, unknown>).plaintext).toBeUndefined();
    expect((dto as Record<string, unknown>).encryptedPayloadRef).toBeUndefined();
  });
});

