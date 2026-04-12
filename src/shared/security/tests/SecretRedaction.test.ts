import { describe, expect, it } from "bun:test";
import { toCreateSecretRequestDiagnosticDto } from "../../dto/security/SecretServiceDtos";
import { SECRET_REDACTED_VALUE, redactSecretMaterial } from "../SecretRedaction";

describe("Secret redaction safeguards", () => {
  it("redacts sensitive keys recursively", () => {
    const redacted = redactSecretMaterial({
      secretId: "secret:server:openai",
      details: {
        plaintext: "sk-live-123",
        apiKey: "abc123",
        nested: {
          tokenValue: "token-456",
          safe: "ok",
        },
      },
      items: [
        {
          password: "pw-1",
        },
      ],
    });

    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("sk-live-123");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("token-456");
    expect(serialized).not.toContain("pw-1");
    expect(serialized).toContain(SECRET_REDACTED_VALUE);
    expect(serialized).toContain("secret:server:openai");
  });

  it("omits plaintext from create-secret diagnostic dto serialization by default", () => {
    const dto = toCreateSecretRequestDiagnosticDto({
      actor: {
        actorId: "user:admin",
        actorType: "server-admin",
      },
      operationKey: "op:create",
      secretId: "secret:server:openai",
      name: "llm.openai.api_key",
      kind: "api-key",
      owner: {
        scope: "server",
      },
      plaintext: "sk-live-123",
    });

    const serialized = JSON.stringify(dto);
    expect(serialized).toContain("\"plaintextProvided\":true");
    expect(serialized).not.toContain("\"plaintext\":");
    expect(serialized).not.toContain("sk-live-123");
  });
});
