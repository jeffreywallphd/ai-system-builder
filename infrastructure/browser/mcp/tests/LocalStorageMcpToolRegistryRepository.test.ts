import { describe, expect, it } from "bun:test";
import { LocalStorageMcpToolRegistryRepository } from "../LocalStorageMcpToolRegistryRepository";

class MemoryStorage {
  private readonly data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  public unsafeWrite(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("LocalStorageMcpToolRegistryRepository", () => {
  it("stores and fetches installed MCP tools", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageMcpToolRegistryRepository("test", storage as never);

    await repository.saveInstalledTool(
      Object.freeze({
        toolId: "mcp:local:echo",
        status: "enabled" as const,
        installedAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
        source: Object.freeze({ kind: "inline" as const, location: "inline:test" }),
        definition: Object.freeze({
          id: "mcp:local:echo",
          version: "1.0.0",
          displayName: "Echo",
          sideEffects: "none" as const,
          auth: Object.freeze({ kind: "none" as const }),
          tags: Object.freeze([]),
          categories: Object.freeze([]),
          inputSchema: Object.freeze({ type: "object" }),
          binding: Object.freeze({ serverId: "local", toolName: "echo" }),
        }),
      }),
    );

    const loaded = await repository.findInstalledToolByBinding("local", "echo");
    expect(loaded?.toolId).toBe("mcp:local:echo");

    const removed = await repository.removeInstalledTool("mcp:local:echo");
    expect(removed).toBe(true);
    expect(await repository.listInstalledTools()).toHaveLength(0);
  });

  it("returns an empty list when persisted JSON is invalid", async () => {
    const storage = new MemoryStorage();
    storage.unsafeWrite("test", "{not-json");
    const repository = new LocalStorageMcpToolRegistryRepository("test", storage as never);
    expect(await repository.listInstalledTools()).toEqual([]);
  });
});
