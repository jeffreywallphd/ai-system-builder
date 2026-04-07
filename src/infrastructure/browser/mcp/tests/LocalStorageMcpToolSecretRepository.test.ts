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
  it("stores encrypted secret values while returning non-secret reference metadata", async () => {
    const storage = createStorage();
    const repository = new LocalStorageMcpToolSecretRepository("test", storage as never);

    await repository.upsertSecret(
      "mcp:local:weather",
      { apiKey: "super-secret" },
      [{ key: "apiKey", label: "API Key", secret: true, required: true }],
    );

    const reference = await repository.getSecretReference("mcp:local:weather");
    const resolved = await repository.resolveSecret("mcp:local:weather");
    const rawStorage = storage.getItem("test");

    expect(reference?.toolId).toBe("mcp:local:weather");
    expect(reference?.scopeType).toBe("global");
    expect((reference as unknown as { values?: unknown }).values).toBeUndefined();
    expect(resolved?.values).toEqual({ apiKey: "super-secret" });
    expect(rawStorage).not.toContain("super-secret");
  });

  it("supports project-scoped secrets independently from global scope", async () => {
    const storage = createStorage();
    const repository = new LocalStorageMcpToolSecretRepository("test", storage as never);

    await repository.upsertSecret("mcp:local:weather", { apiKey: "global" }, []);
    await repository.upsertSecret("mcp:local:weather", { apiKey: "project-a" }, [], { scopeType: "project", scopeId: "project-a" });

    const globalSecret = await repository.resolveSecret("mcp:local:weather");
    const projectSecret = await repository.resolveSecret("mcp:local:weather", { scopeType: "project", scopeId: "project-a" });

    expect(globalSecret?.values.apiKey).toBe("global");
    expect(projectSecret?.values.apiKey).toBe("project-a");
  });
});
