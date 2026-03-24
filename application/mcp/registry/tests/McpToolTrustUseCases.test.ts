import { describe, expect, it } from "bun:test";
import type { IMcpToolRegistryRepository } from "../../../ports/interfaces/IMcpToolRegistryRepository";
import type { IMcpToolSecretRepository } from "../../../ports/interfaces/IMcpToolSecretRepository";
import type { InstalledMcpToolRecord } from "../../../../domain/mcp/InstalledMcpTool";
import {
  ConfigureMcpToolCredentialsUseCase,
  GetMcpToolCredentialStatusUseCase,
  SetMcpToolPermissionsUseCase,
} from "../McpToolTrustUseCases";

function makeTool(): InstalledMcpToolRecord {
  return Object.freeze({
    toolId: "mcp:local:secure-weather",
    status: "enabled",
    installedAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    source: Object.freeze({ kind: "inline", location: "inline:test" }),
    grantedPermissions: Object.freeze([]),
    definition: Object.freeze({
      id: "mcp:local:secure-weather",
      version: "1.0.0",
      displayName: "Secure Weather",
      sideEffects: "network",
      auth: Object.freeze({
        kind: "required",
        credentialFields: Object.freeze([{ key: "apiKey", label: "API Key", secret: true, required: true }]),
      }),
      permissions: Object.freeze(["network.access"]),
      tags: Object.freeze([]),
      categories: Object.freeze([]),
      inputSchema: Object.freeze({ type: "object" }),
      binding: Object.freeze({ serverId: "local", toolName: "secure-weather" }),
    }),
  });
}

function makeRegistry(tool: InstalledMcpToolRecord): IMcpToolRegistryRepository {
  let record = tool;
  return {
    listInstalledTools: async () => [record],
    getInstalledTool: async () => record,
    findInstalledToolByBinding: async () => record,
    saveInstalledTool: async (next) => {
      record = next;
      return next;
    },
    removeInstalledTool: async () => false,
  };
}

describe("McpToolTrustUseCases", () => {
  it("stores credentials through secret repository and exposes status without secret values", async () => {
    const tool = makeTool();
    const registry = makeRegistry(tool);
    let storedValues: Record<string, string> | undefined;
    const secrets: IMcpToolSecretRepository = {
      getSecretReference: async () => ({ toolId: tool.toolId, scopeType: "global", fields: tool.definition.auth.credentialFields ?? [], updatedAt: "2026-03-24T00:00:00.000Z" }),
      resolveSecret: async () => ({ toolId: tool.toolId, scopeType: "global", values: storedValues ?? {}, updatedAt: "2026-03-24T00:00:00.000Z" }),
      upsertSecret: async (_toolId, values, fields) => {
        storedValues = { ...values };
        return { toolId: tool.toolId, scopeType: "global", fields, updatedAt: "2026-03-24T00:00:00.000Z" };
      },
      removeSecret: async () => false,
    };

    await new ConfigureMcpToolCredentialsUseCase(registry, secrets).execute({
      toolId: tool.toolId,
      values: { apiKey: "abc123" },
    });

    const status = await new GetMcpToolCredentialStatusUseCase(registry, secrets).execute(tool.toolId);
    expect(status.configured).toBe(true);
    expect(status.missingRequiredFields).toEqual([]);
    expect((status as unknown as { values?: unknown }).values).toBeUndefined();
  });

  it("updates installed tool permission grants", async () => {
    const tool = makeTool();
    const registry = makeRegistry(tool);

    const updated = await new SetMcpToolPermissionsUseCase(registry).execute({
      toolId: tool.toolId,
      grantedPermissions: ["network.access"],
    });

    expect(updated.grantedPermissions).toEqual(["network.access"]);
  });
});
