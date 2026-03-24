import { describe, expect, it } from "bun:test";
import type { IMcpToolDependencyScanner } from "../../../ports/interfaces/IMcpToolDependencyScanner";
import type { IMcpToolRegistryRepository } from "../../../ports/interfaces/IMcpToolRegistryRepository";
import type { InstalledMcpToolRecord } from "../../../../domain/mcp/InstalledMcpTool";
import {
  GetInstalledMcpToolUseCase,
  InstallMcpToolUseCase,
  ListInstalledMcpToolsUseCase,
  QueryMcpToolCapabilitiesUseCase,
  RemoveMcpToolUseCase,
  SetMcpToolStatusUseCase,
} from "../McpToolRegistryUseCases";
import { McpToolRegistryError } from "../McpToolRegistryErrors";

function makeRepository(seed: ReadonlyArray<InstalledMcpToolRecord> = []): IMcpToolRegistryRepository {
  const records = new Map(seed.map((record) => [record.toolId, record]));

  return {
    listInstalledTools: async () => Object.freeze([...records.values()]),
    getInstalledTool: async (toolId) => records.get(toolId),
    findInstalledToolByBinding: async (serverId, toolName) =>
      [...records.values()].find(
        (record) => record.definition.binding?.serverId === serverId && record.definition.binding?.toolName === toolName,
      ),
    saveInstalledTool: async (record) => {
      records.set(record.toolId, record);
      return record;
    },
    removeInstalledTool: async (toolId) => records.delete(toolId),
  };
}

function toolRecord(toolId: string, status: InstalledMcpToolRecord["status"] = "enabled"): InstalledMcpToolRecord {
  return Object.freeze({
    toolId,
    status,
    installedAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    source: Object.freeze({ kind: "inline", location: "inline:test" }),
    definition: Object.freeze({
      id: toolId,
      version: "1.0.0",
      displayName: "Weather",
      sideEffects: "read",
      auth: Object.freeze({ kind: "none" }),
      tags: Object.freeze(["weather", "geo"]),
      categories: Object.freeze(["lookup"]),
      inputSchema: Object.freeze({ type: "object", properties: { city: { type: "string" } } }),
      outputSchema: Object.freeze({ type: "object", properties: { temperature: { type: "number" } } }),
      binding: Object.freeze({ serverId: "local", toolName: "weather" }),
    }),
  });
}

describe("McpToolRegistryUseCases", () => {
  it("installs and lists MCP tools", async () => {
    const repository = makeRepository();
    const install = new InstallMcpToolUseCase(repository);

    await install.execute({
      definition: toolRecord("mcp:local:weather").definition,
    });

    const list = await new ListInstalledMcpToolsUseCase(repository).execute();
    expect(list).toHaveLength(1);
    expect(list[0]?.toolId).toBe("mcp:local:weather");
  });

  it("rejects duplicate installs without overwrite", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);

    await expect(
      new InstallMcpToolUseCase(repository).execute({ definition: toolRecord("mcp:local:weather").definition }),
    ).rejects.toMatchObject({ code: "duplicate-install" } satisfies Partial<McpToolRegistryError>);
  });

  it("supports status transitions", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const useCase = new SetMcpToolStatusUseCase(repository);

    const disabled = await useCase.disable("mcp:local:weather");
    const enabled = await useCase.enable("mcp:local:weather");

    expect(disabled.status).toBe("disabled");
    expect(enabled.status).toBe("enabled");
  });

  it("blocks safe removal when references exist", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const scanner: IMcpToolDependencyScanner = {
      scanToolReferences: async () => [
        Object.freeze({ kind: "workflow", id: "wf-1", label: "Weather Workflow", detail: "Referenced by 1 node." }),
      ],
    };

    await expect(new RemoveMcpToolUseCase(repository, scanner).execute("mcp:local:weather")).rejects.toMatchObject({
      code: "unsafe-removal",
    } satisfies Partial<McpToolRegistryError>);
  });

  it("queries capabilities by auth, side effects, and schema type", async () => {
    const repository = makeRepository([
      toolRecord("mcp:local:weather"),
      Object.freeze({
        ...toolRecord("mcp:local:charge"),
        definition: Object.freeze({
          ...toolRecord("mcp:local:charge").definition,
          sideEffects: "write" as const,
          auth: Object.freeze({ kind: "required" as const }),
        }),
      }),
    ]);

    const useCase = new QueryMcpToolCapabilitiesUseCase(repository);
    const results = await useCase.execute({
      inputType: "string",
      requiresAuth: true,
      sideEffects: ["write"],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.toolId).toBe("mcp:local:charge");
  });

  it("gets details for a single installed tool", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const record = await new GetInstalledMcpToolUseCase(repository).execute("mcp:local:weather");
    expect(record.definition.displayName).toBe("Weather");
  });
});
