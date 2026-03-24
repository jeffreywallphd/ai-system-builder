import { describe, expect, it } from "bun:test";
import { WorkflowMcpToolDependencyScanner } from "../WorkflowMcpToolDependencyScanner";

describe("WorkflowMcpToolDependencyScanner", () => {
  it("detects workflow references to MCP tool descriptors", async () => {
    const workflow = {
      id: "wf-1",
      metadata: { name: "Weather Flow" },
      nodes: [
        {
          definition: { type: "mcp.tool_call" },
          getProperty: (id: string) => {
            if (id === "toolDescriptor") {
              return { value: { id: "mcp:local:weather", serverId: "local", name: "weather", inputSchema: { type: "object" }, arguments: [], categories: [], tags: [] } };
            }
            return undefined;
          },
        },
      ],
    };

    const repository = {
      list: async () => [{ id: "wf-1", metadata: { name: "Weather Flow" } }],
      load: async () => workflow,
    };

    const scanner = new WorkflowMcpToolDependencyScanner(repository as never);
    const refs = await scanner.scanToolReferences("mcp:local:weather");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.id).toBe("wf-1");
  });

  it("detects workflow references from stable toolId property when descriptor snapshot is absent", async () => {
    const workflow = {
      id: "wf-2",
      metadata: { name: "Echo Flow" },
      nodes: [
        {
          definition: { type: "mcp.tool_call" },
          getProperty: (id: string) => {
            if (id === "toolId") {
              return { value: "mcp:local:echo" };
            }
            if (id === "serverId") {
              return { value: "local" };
            }
            if (id === "toolName") {
              return { value: "echo" };
            }
            return undefined;
          },
        },
      ],
    };

    const repository = {
      list: async () => [{ id: "wf-2", metadata: { name: "Echo Flow" } }],
      load: async () => workflow,
    };

    const scanner = new WorkflowMcpToolDependencyScanner(repository as never);
    const refs = await scanner.scanToolReferences("mcp:local:echo");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.id).toBe("wf-2");
  });
});
