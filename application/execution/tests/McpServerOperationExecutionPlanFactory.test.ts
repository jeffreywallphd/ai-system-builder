import { describe, expect, it } from "bun:test";
import {
  createMcpServerOperationExecutionPlan,
  createMcpServerProvisionAndConnectExecutionPlan,
} from "../McpServerOperationExecutionPlanFactory";

describe("McpServerOperationExecutionPlanFactory", () => {
  it("creates a dependency-aware create+connect multi-unit plan", () => {
    const plan = createMcpServerProvisionAndConnectExecutionPlan({
      serverId: "local-server",
      serverName: "Local Server",
      toolName: "tool",
      code: "def run(): pass",
      connectOnStartup: true,
    });

    expect(plan.plan.units.map((unit) => unit.id)).toEqual([
      "mcp-server-operation:create-local-server:local-server",
      "mcp-server-operation:connect:local-server",
    ]);
    expect(plan.plan.getUnit("mcp-server-operation:connect:local-server")?.dependsOn).toEqual([
      "mcp-server-operation:create-local-server:local-server",
    ]);
    expect(plan.metadata.supportsMultiUnitComposition).toBe(true);
    expect(plan.metadata.supportsReconnectOrResume).toBe(true);
    expect(plan.unitId).toBe("mcp-server-operation:create-local-server:local-server");
    expect(plan.terminalUnitId).toBe("mcp-server-operation:connect:local-server");
  });

  it("keeps single-unit operation plans unchanged", () => {
    const plan = createMcpServerOperationExecutionPlan({ action: "connect", serverId: "server-1" });
    expect(plan.plan.units).toHaveLength(1);
    expect(plan.metadata.supportsMultiUnitComposition).toBe(false);
  });
});
