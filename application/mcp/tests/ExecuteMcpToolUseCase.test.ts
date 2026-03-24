import { describe, expect, it } from "bun:test";
import { ExecuteMcpToolUseCase } from "../ExecuteMcpToolUseCase";
import type { IMcpToolExecutor } from "../../ports/interfaces/IMcpToolExecutor";
import { ExecutionContextEnvelope } from "../../context/models/ExecutionContextEnvelope";
import { ExecutionContextToolPolicyService } from "../../context/ExecutionContextToolPolicyService";
import type { IMcpToolSecretRepository } from "../../ports/interfaces/IMcpToolSecretRepository";
import { McpToolAssetIoCoordinator } from "../McpToolAssetIoCoordinator";
import { RecordAssetTransformationUseCase } from "../../assets-system/RecordAssetTransformationUseCase";
import type { IAssetRecordRepository } from "../../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";
import type { IAssetTransformationRepository } from "../../ports/interfaces/IAssetTransformationRepository";
import type { IAssetLineageRepository } from "../../ports/interfaces/IAssetLineageRepository";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import { AssetTransformation } from "../../../domain/assets/AssetTransformation";
import { AssetLineageEdge } from "../../../domain/assets/AssetLineageEdge";

const executionContext = new ExecutionContextEnvelope({
  packageReferences: [{ packageId: "pkg-mcp", alias: "MCP policy" }],
  assembledContext: {
    fragments: [{ id: "ctx-1", kind: "instructions", content: "Only use the local MCP echo tool.", order: 0, assemblyKey: "instructions:ctx-1", precedence: 0, provenance: [] }],
    sections: [{ kind: "instructions", title: "System Instructions", fragments: [{ id: "ctx-1", kind: "instructions", content: "Only use the local MCP echo tool.", order: 0, assemblyKey: "instructions:ctx-1", precedence: 0, provenance: [] }], content: "Only use the local MCP echo tool." }],
    promptText: "Only use the local MCP echo tool.",
  },
  inspection: {
    assembledPromptText: "Only use the local MCP echo tool.",
    finalPromptText: "Only use the local MCP echo tool.",
    finalFragmentIds: ["ctx-1"],
    entries: [],
  },
  toolUsePolicy: {
    instructions: "Use the local echo MCP tool only.",
    allowedProviderKinds: ["mcp"],
    mcp: { allowedServerIds: ["local"], allowedToolNames: ["echo"] },
  },
});

describe("ExecuteMcpToolUseCase", () => {
  it("delegates a normalized tool execution request", async () => {
    const requests: unknown[] = [];
    const executor: IMcpToolExecutor = {
      executeTool: async (request) => {
        requests.push(request);
        return {
          executionId: "exec-1",
          serverId: request.serverId,
          toolName: request.toolName,
          status: "completed",
          content: [{ type: "text", text: "done" }],
        };
      },
    };

    const result = await new ExecuteMcpToolUseCase(executor).execute({
      serverId: " local ",
      toolName: " echo ",
      arguments: { message: "hello" },
      context: executionContext,
    });

    expect(result.status).toBe("completed");
    expect(requests).toEqual([
      {
        serverId: "local",
        toolName: "echo",
        arguments: { message: "hello" },
        context: executionContext,
        metadata: {
          workflowContext: {
            packageReferences: executionContext.packageReferences,
            assembledContext: executionContext.assembledContext,
            trimmingPolicy: executionContext.trimmingPolicy,
            budget: executionContext.budget,
            inspection: executionContext.inspection,
            toolUsePolicy: executionContext.toolUsePolicy,
          },
        },
      },
    ]);
  });

  it("rejects missing server identifiers", async () => {
    const executor: IMcpToolExecutor = {
      executeTool: async () => {
        throw new Error("should not run");
      },
    };

    await expect(new ExecuteMcpToolUseCase(executor).execute({ serverId: " ", toolName: "echo" })).rejects.toThrow(
      "serverId"
    );
  });

  it("blocks MCP tools that violate execution context policy", async () => {
    const executor: IMcpToolExecutor = {
      executeTool: async () => {
        throw new Error("should not run");
      },
    };

    await expect(
      new ExecuteMcpToolUseCase(executor).execute({
        serverId: "remote",
        toolName: "echo",
        context: executionContext,
      })
    ).rejects.toThrow("Execution context policy blocked the requested MCP tool invocation.");
  });

  it("validates installed tool input and output contracts", async () => {
    const executor: IMcpToolExecutor = {
      executeTool: async () => ({
        executionId: "exec-2",
        serverId: "local",
        toolName: "echo",
        status: "completed",
        content: [{ ok: true }],
        structuredContent: { ok: true },
      }),
    };

    const registry = {
      listInstalledTools: async () => [],
      getInstalledTool: async () => undefined,
      findInstalledToolByBinding: async () =>
        Object.freeze({
          toolId: "mcp:local:echo",
          status: "enabled" as const,
          installedAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          source: Object.freeze({ kind: "inline" as const, location: "inline:test" }),
          grantedPermissions: Object.freeze(["asset.write"] as const),
          definition: Object.freeze({
            id: "mcp:local:echo",
            version: "1.0.0",
            displayName: "Echo",
            sideEffects: "none" as const,
            auth: Object.freeze({ kind: "none" as const }),
            tags: Object.freeze([]),
            categories: Object.freeze([]),
            binding: Object.freeze({ serverId: "local", toolName: "echo" }),
            inputSchema: Object.freeze({ type: "object", required: ["message"], properties: { message: { type: "string" } } }),
            outputSchema: Object.freeze({ type: "object", required: ["text"], properties: { text: { type: "string" } } }),
          }),
        }),
      saveInstalledTool: async (record: never) => record,
      removeInstalledTool: async () => false,
    };

    await expect(
      new ExecuteMcpToolUseCase(executor, new ExecutionContextToolPolicyService(), registry).execute({
        serverId: "local",
        toolName: "echo",
        arguments: { message: "hi" },
      }),
    ).rejects.toThrow("output violates");
  });

  it("refuses execution when installed MCP tool is disabled", async () => {
    const executor: IMcpToolExecutor = {
      executeTool: async () => {
        throw new Error("should not run");
      },
    };

    const registry = {
      listInstalledTools: async () => [],
      getInstalledTool: async () => undefined,
      findInstalledToolByBinding: async () =>
        Object.freeze({
          toolId: "mcp:local:echo",
          status: "disabled" as const,
          installedAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          source: Object.freeze({ kind: "inline" as const, location: "inline:test" }),
          grantedPermissions: Object.freeze(["asset.write"] as const),
          definition: Object.freeze({
            id: "mcp:local:echo",
            version: "1.0.0",
            displayName: "Echo",
            sideEffects: "none" as const,
            auth: Object.freeze({ kind: "none" as const }),
            tags: Object.freeze([]),
            categories: Object.freeze([]),
            binding: Object.freeze({ serverId: "local", toolName: "echo" }),
            inputSchema: Object.freeze({ type: "object" }),
          }),
        }),
      saveInstalledTool: async (record: never) => record,
      removeInstalledTool: async () => false,
    };

    await expect(
      new ExecuteMcpToolUseCase(executor, new ExecutionContextToolPolicyService(), registry).execute({
        serverId: "local",
        toolName: "echo",
        arguments: {},
      }),
    ).rejects.toMatchObject({ code: "tool-disabled" });
  });

  it("denies execution when required credentials are missing", async () => {
    const executor: IMcpToolExecutor = {
      executeTool: async () => {
        throw new Error("should not run");
      },
    };
    const registry = {
      listInstalledTools: async () => [],
      getInstalledTool: async () => undefined,
      findInstalledToolByBinding: async () =>
        Object.freeze({
          toolId: "mcp:local:secure-weather",
          status: "enabled" as const,
          installedAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          source: Object.freeze({ kind: "inline" as const, location: "inline:test" }),
          grantedPermissions: Object.freeze(["network.access"] as const),
          definition: Object.freeze({
            id: "mcp:local:secure-weather",
            version: "1.0.0",
            displayName: "Secure Weather",
            sideEffects: "network" as const,
            auth: Object.freeze({
              kind: "required" as const,
              credentialFields: Object.freeze([{ key: "apiKey", label: "API Key", secret: true, required: true }]),
            }),
            permissions: Object.freeze(["network.access"] as const),
            tags: Object.freeze([]),
            categories: Object.freeze([]),
            binding: Object.freeze({ serverId: "local", toolName: "secure-weather" }),
            inputSchema: Object.freeze({ type: "object" }),
          }),
        }),
      saveInstalledTool: async (record: never) => record,
      removeInstalledTool: async () => false,
    };
    const secretRepository: IMcpToolSecretRepository = {
      getSecretReference: async () => undefined,
      resolveSecret: async () => undefined,
      upsertSecret: async () => ({ toolId: "x", fields: [], updatedAt: new Date().toISOString() }),
      removeSecret: async () => false,
    };

    await expect(
      new ExecuteMcpToolUseCase(executor, new ExecutionContextToolPolicyService(), registry, undefined, secretRepository).execute({
        serverId: "local",
        toolName: "secure-weather",
      }),
    ).rejects.toMatchObject({ code: "missing-auth-configuration" });
  });

  it("allows execution when required credentials and permission grants are configured", async () => {
    const requests: unknown[] = [];
    const executor: IMcpToolExecutor = {
      executeTool: async (request) => {
        requests.push(request);
        return {
          executionId: "exec-allow-1",
          serverId: request.serverId,
          toolName: request.toolName,
          status: "completed",
          content: [{ ok: true }],
          structuredContent: { ok: true },
        };
      },
    };
    const registry = {
      listInstalledTools: async () => [],
      getInstalledTool: async () => undefined,
      findInstalledToolByBinding: async () =>
        Object.freeze({
          toolId: "mcp:local:secure-weather",
          status: "enabled" as const,
          installedAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          source: Object.freeze({ kind: "inline" as const, location: "inline:test" }),
          grantedPermissions: Object.freeze(["network.access"] as const),
          definition: Object.freeze({
            id: "mcp:local:secure-weather",
            version: "1.0.0",
            displayName: "Secure Weather",
            sideEffects: "network" as const,
            auth: Object.freeze({
              kind: "required" as const,
              credentialFields: Object.freeze([{ key: "apiKey", label: "API Key", secret: true, required: true }]),
            }),
            permissions: Object.freeze(["network.access"] as const),
            tags: Object.freeze([]),
            categories: Object.freeze([]),
            binding: Object.freeze({ serverId: "local", toolName: "secure-weather" }),
            inputSchema: Object.freeze({ type: "object" }),
            outputSchema: Object.freeze({ type: "object", properties: { ok: { type: "boolean" } } }),
          }),
        }),
      saveInstalledTool: async (record: never) => record,
      removeInstalledTool: async () => false,
    };
    const secretRepository: IMcpToolSecretRepository = {
      getSecretReference: async () => ({ toolId: "mcp:local:secure-weather", fields: [], updatedAt: "2026-03-24T00:00:00.000Z" }),
      resolveSecret: async () =>
        ({ toolId: "mcp:local:secure-weather", values: { apiKey: "super-secret" }, updatedAt: "2026-03-24T00:00:00.000Z" }),
      upsertSecret: async () => ({ toolId: "x", fields: [], updatedAt: new Date().toISOString() }),
      removeSecret: async () => false,
    };

    await new ExecuteMcpToolUseCase(executor, new ExecutionContextToolPolicyService(), registry, undefined, secretRepository).execute({
      serverId: "local",
      toolName: "secure-weather",
    });

    expect((requests[0] as { resolvedCredentials?: unknown }).resolvedCredentials).toEqual({ apiKey: "super-secret" });
  });

  it("denies execution when required permissions are not granted", async () => {
    const executor: IMcpToolExecutor = { executeTool: async () => ({ executionId: "x", serverId: "local", toolName: "fs", status: "completed", content: [] }) };
    const registry = {
      listInstalledTools: async () => [],
      getInstalledTool: async () => undefined,
      findInstalledToolByBinding: async () =>
        Object.freeze({
          toolId: "mcp:local:fs-write",
          status: "enabled" as const,
          installedAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          source: Object.freeze({ kind: "inline" as const, location: "inline:test" }),
          grantedPermissions: Object.freeze(["filesystem.read"] as const),
          definition: Object.freeze({
            id: "mcp:local:fs-write",
            version: "1.0.0",
            displayName: "FS write",
            sideEffects: "system" as const,
            auth: Object.freeze({ kind: "none" as const }),
            tags: Object.freeze([]),
            categories: Object.freeze([]),
            binding: Object.freeze({ serverId: "local", toolName: "fs-write" }),
            inputSchema: Object.freeze({ type: "object" }),
          }),
        }),
      saveInstalledTool: async (record: never) => record,
      removeInstalledTool: async () => false,
    };

    await expect(
      new ExecuteMcpToolUseCase(executor, new ExecutionContextToolPolicyService(), registry).execute({
        serverId: "local",
        toolName: "fs-write",
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("resolves asset-backed inputs and persists asset outputs", async () => {
    const assets = new Map<string, any>([
      ["asset-input", {
        id: "asset-input",
        name: "Input",
        kind: "json",
        status: "available",
        source: { type: "uploaded" },
        location: { accessMethod: "memory", location: "memory://input.json", format: "json", contentType: "application/json" },
        relationships: [],
      }],
    ]);
    const versions = new Map<string, AssetVersion>([
      ["asset-input:version:seed", new AssetVersion({ assetId: "asset-input", versionId: "asset-input:version:seed" })],
    ]);
    const transformations = new Map<string, AssetTransformation>();
    const edges = new Map<string, AssetLineageEdge>();

    const assetRepo: IAssetRecordRepository = {
      save: async (asset) => { assets.set(asset.id, asset); },
      getById: async (assetId) => assets.get(assetId),
      list: async () => [...assets.values()],
      exists: async (assetId) => assets.has(assetId),
    };
    const versionRepo: IAssetVersionRepository = {
      saveVersion: async (version) => { versions.set(version.versionId, version); },
      getByVersionId: async (versionId) => versions.get(versionId),
      listVersionsByAssetId: async (assetId) => [...versions.values()].filter((version) => version.assetId.value === assetId),
    };
    const transformationRepo: IAssetTransformationRepository = {
      saveTransformation: async (transformation) => { transformations.set(transformation.transformationId, transformation); },
      getById: async (id) => transformations.get(id),
      listByVersionId: async (versionId) => [...transformations.values()].filter((tx) => tx.inputVersionIds.includes(versionId) || tx.outputVersionIds.includes(versionId)),
    };
    const lineageRepo: IAssetLineageRepository = {
      saveEdge: async (edge) => { edges.set(edge.edgeId, edge); },
      listEdgesByVersionId: async (versionId) => [...edges.values()].filter((edge) => edge.fromVersionId === versionId || edge.toVersionId === versionId),
    };

    const requests: unknown[] = [];
    const executor: IMcpToolExecutor = {
      executeTool: async (request) => {
        requests.push(request);
        return {
          executionId: "exec-asset-1",
          serverId: "local",
          toolName: "asset-transform",
          status: "completed",
          content: [{ transformed: { value: 42 } }],
          structuredContent: { transformed: { value: 42 } },
        };
      },
    };

    const registry = {
      listInstalledTools: async () => [],
      getInstalledTool: async () => undefined,
      findInstalledToolByBinding: async () =>
        Object.freeze({
          toolId: "mcp:local:asset-transform",
          status: "enabled" as const,
          installedAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
          source: Object.freeze({ kind: "inline" as const, location: "inline:test" }),
          grantedPermissions: Object.freeze(["asset.write"] as const),
          definition: Object.freeze({
            id: "mcp:local:asset-transform",
            version: "1.0.0",
            displayName: "Asset Transform",
            sideEffects: "write" as const,
            auth: Object.freeze({ kind: "none" as const }),
            tags: Object.freeze([]),
            categories: Object.freeze([]),
            binding: Object.freeze({ serverId: "local", toolName: "asset-transform" }),
            inputSchema: Object.freeze({ type: "object", properties: { source: { type: "string" } } }),
            outputSchema: Object.freeze({ type: "object", properties: { transformed: { type: "object" } } }),
            assetIo: Object.freeze({
              inputs: Object.freeze([
                Object.freeze({ path: "source", valueKind: "asset-id" as const, resolution: "location" as const, assetKinds: Object.freeze(["json"] as const) }),
              ]),
              outputs: Object.freeze([
                Object.freeze({ path: "transformed", mode: "asset-create" as const, assetKind: "json" as const }),
              ]),
            }),
          }),
        }),
      saveInstalledTool: async (record: never) => record,
      removeInstalledTool: async () => false,
    };

    const coordinator = new McpToolAssetIoCoordinator(
      assetRepo,
      versionRepo,
      new RecordAssetTransformationUseCase(transformationRepo, lineageRepo),
    );

    const result = await new ExecuteMcpToolUseCase(
      executor,
      new ExecutionContextToolPolicyService(),
      registry,
      undefined,
      undefined,
      undefined,
      undefined,
      coordinator,
    ).execute({
      serverId: "local",
      toolName: "asset-transform",
      arguments: { source: "asset-input" },
    });

    expect((requests[0] as { arguments: Record<string, unknown> }).arguments.source).toBe("memory://input.json");
    expect(result.metadata?.assetIo).toBeDefined();
    expect([...versions.values()].some((version) => version.assetId.value.includes("mcp:local:asset-transform:asset"))).toBe(true);
    expect(transformations.size).toBeGreaterThan(0);
  });

});
