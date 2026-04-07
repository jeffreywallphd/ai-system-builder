import { describe, expect, it } from "bun:test";
import { DependencyContainer } from "../DependencyContainer";
import { InfrastructureRegistry, TOKENS } from "../InfrastructureRegistry";
import { SqliteExecutionRunRepository } from "../../filesystem/execution/SqliteExecutionRunRepository";
import type { IMcpRuntimeClient } from "@application/ports/interfaces/IMcpRuntimeClient";

describe("InfrastructureRegistry", () => {
  it("registers default infrastructure services", async () => {
    const c = new DependencyContainer();
    InfrastructureRegistry.register(c, {
      paths: {
        assetsDirectory: "/tmp/assets",
        modelsDirectory: "/tmp/models",
        workflowsDirectory: "/tmp/workflows",
      },
      env: { APP_NAME: "loom" },
    });

    expect(c.isRegistered(TOKENS.FileStorage)).toBe(true);
    expect(c.isRegistered(TOKENS.AssetCatalog)).toBe(true);
    expect(c.isRegistered(TOKENS.WorkflowRepository)).toBe(true);
    expect(c.isRegistered(TOKENS.ExecutionRunRepository)).toBe(true);
    expect(c.isRegistered(TOKENS.UnifiedExecutionEngine)).toBe(true);
    expect(c.isRegistered(TOKENS.NodeImplementationRegistry)).toBe(true);
    expect(c.isRegistered(TOKENS.McpRuntimeConfig)).toBe(true);
    expect(c.isRegistered(TOKENS.McpServerCatalog)).toBe(true);
    expect(c.isRegistered(TOKENS.McpServerManager)).toBe(true);
    expect(c.isRegistered(TOKENS.McpToolExecutor)).toBe(true);
    expect(c.isRegistered(TOKENS.ToolCapabilityCatalog)).toBe(true);
    expect(c.isRegistered(TOKENS.ToolCapabilityExecutor)).toBe(true);

    const mcpClient = c.resolve<IMcpRuntimeClient>(TOKENS.McpRuntimeClient);
    expect((await mcpClient.getConnectionStatus()).state).toBe("disabled");
    expect((await mcpClient.listServers()).totalCount).toBe(0);
  });

  it("uses the shared SQLite execution-run repository when a database path is configured", () => {
    const databasePath = "/tmp/loom-execution-runs.sqlite";
    const c = new DependencyContainer();
    InfrastructureRegistry.register(c, {
      paths: {
        assetsDirectory: "/tmp/assets",
        modelsDirectory: "/tmp/models",
        workflowsDirectory: "/tmp/workflows",
        executionRunDatabasePath: databasePath,
      },
      env: { APP_NAME: "loom" },
    });

    const repository = c.resolve(TOKENS.ExecutionRunRepository);
    expect(repository).toBeInstanceOf(SqliteExecutionRunRepository);
    (repository as SqliteExecutionRunRepository).dispose();
  });
});

