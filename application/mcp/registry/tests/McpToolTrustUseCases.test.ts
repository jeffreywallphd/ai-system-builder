import { describe, expect, it } from "bun:test";
import type { IMcpToolRegistryRepository } from "../../../ports/interfaces/IMcpToolRegistryRepository";
import type { IMcpToolSecretRepository } from "../../../ports/interfaces/IMcpToolSecretRepository";
import type { InstalledMcpToolRecord } from "../../../../domain/mcp/InstalledMcpTool";
import {
  ConfigureMcpToolCredentialsUseCase,
  GetMcpToolEffectivePermissionsUseCase,
  GetMcpToolSandboxPostureUseCase,
  GetMcpToolCredentialStatusUseCase,
  GetMissingMcpToolApprovalsUseCase,
  GetMcpToolTrustStateUseCase,
  RevokeMcpToolPermissionApprovalUseCase,
  SetMcpToolPermissionApprovalUseCase,
  SetMcpToolPermissionsUseCase,
  SetMcpToolSandboxPolicyUseCase,
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
      permissions: Object.freeze(["network.access"] as const),
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

  it("tracks approval lifecycle and revocation", async () => {
    const tool = makeTool();
    const registry = makeRegistry(tool);

    const granted = await new SetMcpToolPermissionApprovalUseCase(registry).execute({
      toolId: tool.toolId,
      permissions: ["network.access"],
      status: "approved",
      actor: "tester",
      reason: "accepted",
    });
    expect(granted.permissionApprovals?.[0]?.status).toBe("approved");

    const revoked = await new RevokeMcpToolPermissionApprovalUseCase(registry).execute({
      toolId: tool.toolId,
      permissions: ["network.access"],
      actor: "tester",
      reason: "removed",
    });
    expect(revoked.permissionApprovals?.[0]?.status).toBe("revoked");
    expect((revoked.approvalHistory ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("updates sandbox policy and exposes trust read model posture", async () => {
    const tool = makeTool();
    const registry = makeRegistry(tool);
    await new SetMcpToolSandboxPolicyUseCase(registry).execute({
      toolId: tool.toolId,
      policy: {
        network: { allowed: false, allowedHosts: ["api.safe.local"], allowedProtocols: ["https"] },
        
        filesystem: { allowed: true, readPaths: ["/workspace/safe"], writePaths: [] },
        environment: { mode: "allowlist", allowedEnvVars: ["SAFE_ENV"] },
      },
    });
    const trust = await new GetMcpToolTrustStateUseCase(registry).execute({ toolId: tool.toolId });
    expect(trust.sandbox.policy.network.allowed).toBe(false);
    expect(trust.sandbox.policy.network.allowedHosts).toEqual(["api.safe.local"]);
    expect(trust.approval.statusByPermission[0]?.status).toBe("missing");
    expect(trust.sandbox.enforcement.environment).toBe("declared-only");
  });

  it("provides dedicated approval/permission/sandbox read models", async () => {
    const tool = makeTool();
    const registry = makeRegistry(tool);
    await new SetMcpToolPermissionsUseCase(registry).execute({
      toolId: tool.toolId,
      grantedPermissions: ["network.access"],
    });
    await new SetMcpToolPermissionApprovalUseCase(registry).execute({
      toolId: tool.toolId,
      permissions: ["network.access"],
      status: "approved",
      scope: { scopeType: "project", scopeId: "project-a" },
    });

    const trustState = new GetMcpToolTrustStateUseCase(registry);
    const missing = await new GetMissingMcpToolApprovalsUseCase(trustState).execute({
      toolId: tool.toolId,
      scope: { scopeType: "project", scopeId: "project-a" },
    });
    expect(missing.missingApprovals).toEqual([]);
    expect(missing.approvalStatusByPermission[0]?.status).toBe("approved");

    const effectivePermissions = await new GetMcpToolEffectivePermissionsUseCase(registry).execute({ toolId: tool.toolId });
    expect(effectivePermissions.allowed).toBe(true);

    const sandboxPosture = await new GetMcpToolSandboxPostureUseCase(registry).execute({ toolId: tool.toolId });
    expect(sandboxPosture.policy.network.allowed).toBe(true);
  });
});
