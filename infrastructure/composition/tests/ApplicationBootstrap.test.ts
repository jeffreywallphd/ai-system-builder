import { describe, expect, it } from "bun:test";
import { ApplicationBootstrap, APPLICATION_TOKENS } from "../ApplicationBootstrap";
import { TOKENS } from "../InfrastructureRegistry";

describe("ApplicationBootstrap", () => {
  it("creates a container with infrastructure and application registrations", () => {
    const c = ApplicationBootstrap.createContainer({
      paths: {
        assetsDirectory: "/tmp/assets",
        modelsDirectory: "/tmp/models",
        workflowsDirectory: "/tmp/workflows",
      },
    });

    expect(c.isRegistered(TOKENS.FileStorage)).toBe(true);
    expect(c.isRegistered(TOKENS.McpToolCatalog)).toBe(true);
    expect(c.isRegistered(TOKENS.ToolCapabilityCatalog)).toBe(true);
    expect(c.isRegistered(TOKENS.ToolCapabilityExecutor)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.WorkflowValidator)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.InstallModelUseCase)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.ListMcpToolsUseCase)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.SearchMcpServersUseCase)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.GetMcpServerStatusUseCase)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.ConnectMcpServerUseCase)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.DisconnectMcpServerUseCase)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.ExecuteMcpToolUseCase)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.ListToolCapabilitiesUseCase)).toBe(true);
    expect(c.isRegistered(APPLICATION_TOKENS.InvokeToolCapabilityUseCase)).toBe(true);
  });
});
