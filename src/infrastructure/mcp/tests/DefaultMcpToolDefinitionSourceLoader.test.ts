import { describe, expect, it } from "bun:test";
import { DefaultMcpToolDefinitionSourceLoader } from "../DefaultMcpToolDefinitionSourceLoader";

describe("DefaultMcpToolDefinitionSourceLoader", () => {
  it("loads a raw local MCP tool definition", async () => {
    const loader = new DefaultMcpToolDefinitionSourceLoader({
      readText: async () => JSON.stringify({
        id: "mcp:local:weather",
        version: "1.0.0",
        displayName: "Weather",
        sideEffects: "read",
        auth: { kind: "none" },
        tags: [],
        categories: ["lookup"],
        inputSchema: { type: "object" },
      }),
    });

    const definition = await loader.load({ kind: "local", location: "./weather.json" });
    expect(definition.id).toBe("mcp:local:weather");
  });

  it("loads the first shareable definition from tool-definition export envelopes", async () => {
    const loader = new DefaultMcpToolDefinitionSourceLoader({
      readText: async () => JSON.stringify({
        format: "ai-loom.mcp-tool-definitions.v1",
        exportedAt: "2026-03-24T00:00:00.000Z",
        tools: [
          {
            toolId: "mcp:local:weather",
            source: { kind: "inline", location: "inline:test" },
            definition: {
              id: "mcp:local:weather",
              version: "1.0.0",
              displayName: "Weather",
              sideEffects: "read",
              auth: { kind: "none" },
              tags: [],
              categories: ["lookup"],
              inputSchema: { type: "object" },
            },
          },
        ],
      }),
    });

    const definition = await loader.load({ kind: "local", location: "./weather-share.json" });
    expect(definition.id).toBe("mcp:local:weather");
    expect(definition.displayName).toBe("Weather");
  });

  it("rejects shareable envelopes with no tool definitions", async () => {
    const loader = new DefaultMcpToolDefinitionSourceLoader({
      readText: async () => JSON.stringify({
        format: "ai-loom.mcp-tool-definitions.v1",
        exportedAt: "2026-03-24T00:00:00.000Z",
        tools: [],
      }),
    });

    await expect(loader.load({ kind: "local", location: "./empty-share.json" })).rejects.toThrow(
      "did not include any shareable tool definitions",
    );
  });
});
