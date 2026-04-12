import { describe, expect, it } from "bun:test";
import { sanitizePersistenceDiagnostics } from "../PersistenceRedaction";

describe("PersistenceRedaction", () => {
  it("redacts prompts, tokens, secrets, and paths from nested diagnostics", () => {
    const sanitized = sanitizePersistenceDiagnostics({
      actorId: "user-admin",
      prompt: "Generate a private portrait from this text prompt.",
      authToken: "Bearer very-secret-token",
      workspacePath: "C:\\Users\\jeffr\\workspace\\project",
      nested: {
        apiKey: "sk-live-abc123secret",
        plain: "safe-value",
      },
      values: [
        "safe-entry",
        "/var/lib/ai-loom/private.sqlite",
      ],
    });

    const serialized = JSON.stringify(sanitized);
    expect(serialized).toContain("user-admin");
    expect(serialized).toContain("safe-value");
    expect(serialized).toContain("safe-entry");
    expect(serialized).not.toContain("Generate a private portrait");
    expect(serialized).not.toContain("very-secret-token");
    expect(serialized).not.toContain("sk-live-abc123secret");
    expect(serialized).not.toContain("C:\\\\Users\\\\jeffr\\\\workspace\\\\project");
    expect(serialized).not.toContain("/var/lib/ai-loom/private.sqlite");
    expect(serialized).toContain("[REDACTED]");
  });
});
