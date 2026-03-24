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
  ListMcpToolLifecycleHistoryUseCase,
  PreviewMcpToolUpdateUseCase,
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
    await new InstallMcpToolUseCase(repository).execute({ definition: toolRecord("mcp:local:weather").definition });

    const list = await new ListInstalledMcpToolsUseCase(repository).execute();
    expect(list).toHaveLength(1);
    expect(list[0]?.toolId).toBe("mcp:local:weather");
    expect(list[0]?.version).toBe("1.0.0");
    expect(list[0]?.lifecycle.lastAction).toBe("install");
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
    expect(preview.changeSummary.classification.informational).toContain("version");
    expect(preview.changeSummary.tags.added).toEqual(["forecast"]);
  });

  it("blocks risky update with dependencies unless forced", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const scanner: IMcpToolDependencyScanner = {
      scanToolReferences: async () => [Object.freeze({ kind: "workflow", id: "wf-1", label: "Weather Workflow" })],
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
    expect(result.dependencySafety.status).toBe("blocked");
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
    expect(result.dependencySafety.status).toBe("ack-required");
    expect(result.record?.status).toBe("enabled");
  });

  it("supports status transitions", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const useCase = new SetMcpToolStatusUseCase(repository);
    expect((await useCase.disable("mcp:local:weather")).status).toBe("disabled");
    expect((await useCase.enable("mcp:local:weather")).status).toBe("enabled");
  });

  it("exposes lifecycle history and summary read models", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather", "1.0.0")]);
    const scanner: IMcpToolDependencyScanner = { scanToolReferences: async () => [] };
    await new ApplyMcpToolUpdateUseCase(repository, scanner).execute({
      toolId: "mcp:local:weather",
      force: true,
      approval: { acknowledgedRisk: true },
      definition: { ...toolRecord("mcp:local:weather", "1.1.0").definition, tags: ["weather", "forecast"] },
    });

    const history = await new ListMcpToolLifecycleHistoryUseCase(repository).execute("mcp:local:weather");
    const summary = await new GetMcpToolLifecycleSummaryUseCase(repository).execute("mcp:local:weather");
    expect(history.length).toBeGreaterThan(1);
    expect(summary.counters.updateCount).toBe(1);
  });

  it("returns blocked safe-removal status when references exist", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const scanner: IMcpToolDependencyScanner = {
      scanToolReferences: async () => [Object.freeze({ kind: "workflow", id: "wf-1", label: "Weather Workflow" })],
    };
    expect((await new RemoveMcpToolUseCase(repository, scanner).execute("mcp:local:weather")).status).toBe("blocked");
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

    const results = await new QueryMcpToolCapabilitiesUseCase(repository).execute({
      inputType: "string",
      requiresAuth: true,
      sideEffects: ["write"],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.toolId).toBe("mcp:local:charge");
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

    const results = await new QueryMcpToolCapabilitiesUseCase(repository).execute({
      acceptsAssetKind: "json",
      producesAssetKind: "json",
      assetOutputMode: "asset-transform",
      transformsExistingAsset: true,
    });
    expect(results).toHaveLength(1);
  });

  it("supports mixed-input and version-aware asset introspection filters", async () => {
    const repository = makeRepository([
      Object.freeze({
        ...toolRecord("mcp:local:asset-mixed"),
        definition: Object.freeze({
          ...toolRecord("mcp:local:asset-mixed").definition,
          assetIo: Object.freeze({
            allowsRawInputs: true,
            inputs: Object.freeze([
              Object.freeze({
                path: "source",
                valueKind: "asset-reference" as const,
                resolution: "asset-record" as const,
                versionRequirement: "required" as const,
              }),
            ]),
            outputs: Object.freeze([
              Object.freeze({ path: "result", mode: "asset-create" as const, assetKind: "json" as const }),
            ]),
          }),
        }),
      }),
    ]);

    const results = await new QueryMcpToolCapabilitiesUseCase(repository).execute({
      supportsMixedInputs: true,
      requiresAssetVersion: true,
      createsAsset: true,
    });
    expect(results).toHaveLength(1);
  });

  it("gets details for a single installed tool", async () => {
    const repository = makeRepository([toolRecord("mcp:local:weather")]);
    const record = await new GetInstalledMcpToolUseCase(repository).execute("mcp:local:weather");
    expect(record.version).toBe("1.0.0");
  });
});
