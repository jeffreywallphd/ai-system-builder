import { describe, expect, it } from "bun:test";
import type { IMcpToolDependencyScanner } from "../../../ports/interfaces/IMcpToolDependencyScanner";
import type { IMcpToolRegistryRepository } from "../../../ports/interfaces/IMcpToolRegistryRepository";
import type { InstalledMcpToolRecord } from "../../../../domain/mcp/InstalledMcpTool";
import {
  ApplyMcpToolUpdateUseCase,
  GetMcpToolLifecycleSummaryUseCase,
  GetInstalledMcpToolUseCase,
  InstallMcpToolUseCase,
  ListInstalledMcpToolsUseCase,
  PreviewMcpToolUpdateUseCase,
  QueryMcpToolCapabilitiesUseCase,
  RemoveMcpToolUseCase,
  SetMcpToolStatusUseCase,
  ListMcpToolLifecycleHistoryUseCase,
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

function toolRecord(toolId: string, version = "1.0.0", status: InstalledMcpToolRecord["status"] = "enabled"): InstalledMcpToolRecord {
  return Object.freeze({
    toolId,
    status,
    installedAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    source: Object.freeze({ kind: "inline", location: "inline:test" }),
    lifecycle: Object.freeze({
      versionPolicy: "pinned",
      lastAction: "install",
      lastTransition: "initial-install",
      installCount: 1,
      reinstallCount: 0,
      updateCount: 0,
      downgradeCount: 0,
      replaceCount: 0,
      lastResolvedVersion: version,
      history: Object.freeze([
        Object.freeze({
          occurredAt: "2026-03-24T00:00:00.000Z",
          action: "install",
          transition: "initial-install",
          toVersion: version,
          reason: "seed-install",
        }),
      ]),
    }),
    definition: Object.freeze({
      id: toolId,
      version,
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
    expect(list[0]?.lifecycle?.lastAction).toBe("install");
  });

  it("rejects duplicate installs without overwrite", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);

    await expect(
      new InstallMcpToolUseCase(repository).execute({ definition: toolRecord("mcp:local:weather").definition }),
    ).rejects.toMatchObject({ code: "duplicate-install" } satisfies Partial<McpToolRegistryError>);
  });

  it("requires explicit update lifecycle for new versions", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);

    await expect(
      new InstallMcpToolUseCase(repository).execute({ definition: toolRecord("mcp:local:weather", "1.1.0").definition }),
    ).rejects.toMatchObject({ code: "invalid-transition" } satisfies Partial<McpToolRegistryError>);
  });

  it("supports explicit overwrite/replace semantics for install", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const updated = await new InstallMcpToolUseCase(repository).execute({
      definition: toolRecord("mcp:local:weather", "2.0.0").definition,
      overwrite: true,
      versionPolicy: "floating",
    });

    expect(updated.definition.version).toBe("2.0.0");
    expect(updated.lifecycle?.lastAction).toBe("replace");
    expect(updated.lifecycle?.versionPolicy).toBe("floating");
  });

  it("supports status transitions", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const useCase = new SetMcpToolStatusUseCase(repository);

    const disabled = await useCase.disable("mcp:local:weather");
    const enabled = await useCase.enable("mcp:local:weather");

    expect(disabled.status).toBe("disabled");
    expect(enabled.status).toBe("enabled");
  });

  it("previews update transition and change summary", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const scanner: IMcpToolDependencyScanner = { scanToolReferences: async () => [] };

    const preview = await new PreviewMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      definition: {
        ...toolRecord("mcp:local:weather", "1.2.0").definition,
        tags: ["weather", "geo", "forecast"],
      },
    });

    expect(preview.transition).toBe("upgrade");
    expect(preview.action).toBe("update");
    expect(preview.changeSummary.version.changed).toBe(true);
    expect(preview.changeSummary.tags.added).toEqual(["forecast"]);
    expect(preview.remediationSuggestions.length).toBeGreaterThan(0);
  });

  it("classifies same-version update as reinstall", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const scanner: IMcpToolDependencyScanner = { scanToolReferences: async () => [] };

    const result = await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      force: true,
      definition: toolRecord("mcp:local:weather", "1.0.0").definition,
    });

    expect(result.status).toBe("updated");
    expect(result.action).toBe("reinstall");
    expect(result.transition).toBe("same-version");
    expect(result.record?.lifecycle?.reinstallCount).toBe(1);
  });

  it("blocks risky update with dependencies unless forced", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const scanner: IMcpToolDependencyScanner = {
      scanToolReferences: async () => [
        Object.freeze({ kind: "workflow", id: "wf-1", label: "Weather Workflow", detail: "Referenced by 1 node." }),
      ],
    };

    const result = await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      approval: { acknowledgedBreaking: true },
      definition: {
        ...toolRecord("mcp:local:weather", "2.0.0").definition,
        inputSchema: { type: "object", properties: { zip: { type: "string" } } },
      },
    });

    expect(result.status).toBe("blocked");
    expect(result.compatibility).toBe("breaking");
    expect(result.remediationSuggestions.length).toBeGreaterThan(0);
    expect(await repository.getInstalledTool("mcp:local:weather"))?.toMatchObject({ definition: { version: "1.0.0" } });
  });

  it("allows forced risky update and preserves enabled status", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0", "enabled")]);
    const scanner: IMcpToolDependencyScanner = {
      scanToolReferences: async () => [Object.freeze({ kind: "workflow", id: "wf-1", label: "Weather Workflow" })],
    };

    const result = await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      force: true,
      definition: {
        ...toolRecord("mcp:local:weather", "1.1.0").definition,
        sideEffects: "network",
      },
    });

    expect(result.status).toBe("updated");
    expect(result.record?.status).toBe("enabled");
    expect(result.record?.lifecycle?.updateCount).toBe(1);
  });

  it("blocks downgrade unless explicitly allowed", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "2.0.0")]);
    const scanner: IMcpToolDependencyScanner = { scanToolReferences: async () => [] };

    const blocked = await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      definition: toolRecord("mcp:local:weather", "1.0.0").definition,
    });

    expect(blocked.status).toBe("blocked");
    expect(blocked.transition).toBe("downgrade");

    const allowed = await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      allowDowngrade: true,
      approval: { acknowledgedBreaking: true },
      definition: toolRecord("mcp:local:weather", "1.0.0").definition,
    });

    expect(allowed.status).toBe("updated");
    expect(allowed.record?.lifecycle?.lastAction).toBe("downgrade");
  });

  it("requires explicit approval for risky updates", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const scanner: IMcpToolDependencyScanner = { scanToolReferences: async () => [] };

    const blocked = await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      definition: {
        ...toolRecord("mcp:local:weather", "1.1.0").definition,
        tags: ["weather", "forecast"],
      },
    });
    expect(blocked.status).toBe("blocked");

    const allowed = await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      approval: { acknowledgedRisk: true, acknowledgedBreaking: true },
      definition: {
        ...toolRecord("mcp:local:weather", "1.1.0").definition,
        tags: ["weather", "forecast"],
      },
    });
    expect(allowed.status).toBe("updated");
  });

  it("supports strict policy profile for schema additions", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const scanner: IMcpToolDependencyScanner = { scanToolReferences: async () => [] };
    const result = await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      policyProfile: "strict",
      approval: { acknowledgedBreaking: true },
      definition: {
        ...toolRecord("mcp:local:weather", "1.1.0").definition,
        outputSchema: {
          type: "object",
          properties: { temperature: { type: "number" }, city: { type: "string" } },
        },
      },
    });
    expect(result.status).toBe("updated");
    expect(result.compatibility).toBe("breaking");
  });

  it("exposes lifecycle history and summary read models", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const scanner: IMcpToolDependencyScanner = { scanToolReferences: async () => [] };
    await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      force: true,
      approval: { acknowledgedRisk: true },
      definition: {
        ...toolRecord("mcp:local:weather", "1.1.0").definition,
        tags: ["weather", "forecast"],
      },
    });

    const history = await new ListMcpToolLifecycleHistoryUseCase(repository).execute("mcp:local:weather");
    const summary = await new GetMcpToolLifecycleSummaryUseCase(repository).execute("mcp:local:weather");
    expect(history.length).toBeGreaterThan(1);
    expect(summary.counters.updateCount).toBe(1);
    expect(summary.lastEvent?.action).toBe("update");
  });

  it("returns blocked safe-removal status when references exist", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const scanner: IMcpToolDependencyScanner = {
      scanToolReferences: async () => [
        Object.freeze({ kind: "workflow", id: "wf-1", label: "Weather Workflow", detail: "Referenced by 1 node." }),
      ],
    };

    const result = await new RemoveMcpToolUseCase(repository, scanner).execute("mcp:local:weather");
    expect(result.status).toBe("blocked");
    expect(result.references).toHaveLength(1);
    expect(await repository.getInstalledTool("mcp:local:weather")).toBeDefined();
  });

  it("removes a tool when no references are found", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const scanner: IMcpToolDependencyScanner = { scanToolReferences: async () => [] };
    const result = await new RemoveMcpToolUseCase(repository, scanner).execute("mcp:local:weather");
    expect(result).toEqual({ status: "removed", toolId: "mcp:local:weather", references: [] });
    expect(await repository.getInstalledTool("mcp:local:weather")).toBeUndefined();
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

  it("supports deeper capability filtering semantics", async () => {
    const repository = makeRepository([
      Object.freeze({
        ...toolRecord("mcp:local:json-array"),
        definition: Object.freeze({
          ...toolRecord("mcp:local:json-array").definition,
          tags: Object.freeze(["json", "transform"]),
          categories: Object.freeze(["utility", "conversion"]),
          auth: Object.freeze({ kind: "optional" as const }),
          sideEffects: "read" as const,
          inputSchema: Object.freeze({
            type: "object",
            properties: {
              records: {
                type: "array",
                items: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" } } },
              },
            },
          }),
        }),
      }),
    ]);
    const useCase = new QueryMcpToolCapabilitiesUseCase(repository);

    const results = await useCase.execute({
      inputType: "number",
      inputPath: "records.*.id",
      ioMatchMode: "assignable",
      tagMatchMode: "any",
      tags: ["nonexistent", "json"],
      categoryMatchMode: "all",
      categories: ["utility", "conversion"],
      authKinds: ["optional"],
      maxSideEffectClass: "read",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.toolId).toBe("mcp:local:json-array");
  });

  it("supports asset-level capability introspection filters", async () => {
    const repository = makeRepository([
      Object.freeze({
        ...toolRecord("mcp:local:asset-transform"),
        definition: Object.freeze({
          ...toolRecord("mcp:local:asset-transform").definition,
          assetIo: Object.freeze({
            inputs: Object.freeze([
              Object.freeze({
                path: "source",
                valueKind: "asset-reference" as const,
                resolution: "asset-record" as const,
                assetKinds: Object.freeze(["json"] as const),
              }),
            ]),
            outputs: Object.freeze([
              Object.freeze({
                path: "result",
                mode: "asset-transform" as const,
                assetKind: "json" as const,
                targetInputPath: "source",
              }),
            ]),
          }),
        }),
      }),
    ]);

    const useCase = new QueryMcpToolCapabilitiesUseCase(repository);
    const results = await useCase.execute({
      acceptsAssetKind: "json",
      producesAssetKind: "json",
      assetOutputMode: "asset-transform",
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.toolId).toBe("mcp:local:asset-transform");
  });

  it("gets details for a single installed tool", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const record = await new GetInstalledMcpToolUseCase(repository).execute("mcp:local:weather");
    expect(record.definition.displayName).toBe("Weather");
  });
});
