import { describe, expect, it } from "bun:test";
import { AddConfiguredMcpServerUseCase } from "../AddConfiguredMcpServerUseCase";
import type { IMcpConfiguredServerRepository } from "../../ports/interfaces/IMcpConfiguredServerRepository";

describe("AddConfiguredMcpServerUseCase", () => {
  it("normalizes and persists a selected server into configured state", async () => {
    const saved: unknown[] = [];
    const repository: IMcpConfiguredServerRepository = {
      listConfiguredServers: async () => [],
      saveConfiguredServer: async (server) => {
        saved.push(server);
        return server;
      },
    };

    const result = await new AddConfiguredMcpServerUseCase(repository).execute({
      server: {
        id: " remote-docs ",
        name: " Remote Docs ",
        transport: "http",
        url: " https://example.com/mcp ",
        enabled: undefined,
        status: "connected",
        toolCount: 4,
        resourceCount: 2,
        capabilities: { tools: true },
        metadata: { provider: "catalog" },
      },
    });

    expect(saved[0]).toMatchObject({
      id: "remote-docs",
      name: "Remote Docs",
      enabled: true,
      url: "https://example.com/mcp",
      connectOnStartup: false,
      status: "connected",
    });
    expect(result.id).toBe("remote-docs");
    expect(result.name).toBe("Remote Docs");
  });

  it("rejects empty ids", async () => {
    const repository: IMcpConfiguredServerRepository = {
      listConfiguredServers: async () => [],
      saveConfiguredServer: async (server) => server,
    };

    await expect(
      new AddConfiguredMcpServerUseCase(repository).execute({
        server: {
          id: "   ",
          name: "Nope",
          transport: "http",
          status: "disconnected",
          toolCount: 0,
          resourceCount: 0,
          capabilities: {},
        },
      }),
    ).rejects.toThrow("server id");
  });
});
