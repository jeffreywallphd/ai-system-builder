import { describe, expect, it } from "bun:test";
import { LocalStorageMcpToolSecretRepository } from "../LocalStorageMcpToolSecretRepository";

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("LocalStorageMcpToolSecretRepository", () => {
  it("stores and resolves secret values while returning non-secret reference metadata", async () => {
    const storage = createStorage();
    const repository = new LocalStorageMcpToolSecretRepository("test", storage as never);

    await repository.upsertSecret(
      "mcp:local:weather",
      { apiKey: "super-secret" },
      [{ key: "apiKey", label: "API Key", secret: true, required: true }],
    );

    const reference = await repository.getSecretReference("mcp:local:weather");
    const resolved = await repository.resolveSecret("mcp:local:weather");

    expect(reference?.toolId).toBe("mcp:local:weather");
    expect((reference as unknown as { values?: unknown }).values).toBeUndefined();
    expect(resolved?.values).toEqual({ apiKey: "super-secret" });
  });
});
