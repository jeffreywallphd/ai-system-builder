import {
  createDefaultMcpToolSandboxPolicy,
  deriveRequiredMcpToolPermissions,
  type McpSandboxEnvironmentMode,
  type McpSandboxNetworkProtocol,
  type McpToolPermissionApprovalEvent,
  type McpToolPermissionApprovalRecord,
  type McpToolPermissionApprovalStatus,
  type McpToolPermissionScope,
  type McpToolSandboxPolicy,
  type McpToolTrustScope,
} from "../../../domain/mcp/McpToolTrust";
import type { IMcpToolRegistryRepository } from "../../ports/interfaces/IMcpToolRegistryRepository";
import type { IMcpToolExecutionAuditSink } from "../../ports/interfaces/IMcpToolExecutionAuditSink";
import type { IMcpToolSecretRepository, McpToolSecretScope } from "../../ports/interfaces/IMcpToolSecretRepository";
import { McpToolAuthService } from "../security/McpToolAuthService";
import { McpToolApprovalPolicyService } from "../security/McpToolApprovalPolicyService";
import { McpToolPermissionPolicyService } from "../security/McpToolPermissionPolicyService";
import { McpToolSandboxPolicyService } from "../security/McpToolSandboxPolicyService";
import { McpToolRegistryError } from "./McpToolRegistryErrors";

export class ConfigureMcpToolCredentialsUseCase {
  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    private readonly secretRepository: IMcpToolSecretRepository,
  ) {}

  public async execute(request: { readonly toolId: string; readonly values: Readonly<Record<string, string>>; readonly scope?: McpToolSecretScope }) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }

    const configured = await this.secretRepository.upsertSecret(tool.toolId, request.values, tool.definition.auth.credentialFields ?? [], request.scope);
    return configured;
  }
}

export class GetMcpToolCredentialStatusUseCase {
  private readonly authService: McpToolAuthService;

  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    secretRepository: IMcpToolSecretRepository,
  ) {
    this.authService = new McpToolAuthService(secretRepository);
  }

  public async execute(toolId: string, scopeContext?: { readonly projectId?: string; readonly userId?: string }) {
    const tool = await this.registryRepository.getInstalledTool(toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }
    return this.authService.getCredentialStatus(tool, scopeContext);
  }
}

export class SetMcpToolPermissionsUseCase {
  constructor(private readonly registryRepository: IMcpToolRegistryRepository) {}

  public async execute(request: { readonly toolId: string; readonly grantedPermissions: ReadonlyArray<McpToolPermissionScope> }) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }
    const normalized = Object.freeze([...new Set(request.grantedPermissions.map((permission) => permission.trim()).filter(Boolean))] as McpToolPermissionScope[]);
    return this.registryRepository.saveInstalledTool(
      Object.freeze({
        ...tool,
        grantedPermissions: normalized,
        updatedAt: new Date().toISOString(),
      }),
    );
  }
}

export interface SetMcpToolPermissionApprovalRequest {
  readonly toolId: string;
  readonly permissions: ReadonlyArray<McpToolPermissionScope>;
  readonly status: Exclude<McpToolPermissionApprovalStatus, "revoked">;
  readonly scope?: McpToolTrustScope;
  readonly actor?: string;
  readonly reason?: string;
}

export class SetMcpToolPermissionApprovalUseCase {
  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    private readonly auditSink: IMcpToolExecutionAuditSink = { record: async () => undefined },
  ) {}

  public async execute(request: SetMcpToolPermissionApprovalRequest) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }
    const now = new Date().toISOString();
    const scope = normalizeScope(request.scope);
    const permissions = normalizePermissions(request.permissions);
    const nextApprovals = [...(tool.permissionApprovals ?? [])];
    const nextHistory = [...(tool.approvalHistory ?? [])];

    for (const permission of permissions) {
      const current = findLatestApproval(nextApprovals, permission, scope);
      const record: McpToolPermissionApprovalRecord = Object.freeze({
        approvalId: current?.approvalId ?? `approval:${tool.toolId}:${permission}:${scope.scopeType}:${scope.scopeId ?? "global"}`,
        permission,
        scope,
        status: request.status,
        requestedAt: current?.requestedAt ?? now,
        updatedAt: now,
        decidedBy: request.actor,
        reason: request.reason,
      });
      if (current) {
        const index = nextApprovals.findIndex((entry) => entry.approvalId === current.approvalId);
        nextApprovals[index] = record;
      } else {
        nextApprovals.push(record);
      }
      const event: McpToolPermissionApprovalEvent = Object.freeze({
        eventId: `approval-event:${tool.toolId}:${permission}:${now}:${Math.random().toString(16).slice(2)}`,
        permission,
        scope,
        fromStatus: current?.status,
        toStatus: request.status,
        occurredAt: now,
        actor: request.actor,
        reason: request.reason,
      });
      nextHistory.push(event);
    }

    const updated = await this.registryRepository.saveInstalledTool(Object.freeze({
      ...tool,
      permissionApprovals: Object.freeze(nextApprovals),
      approvalHistory: Object.freeze(nextHistory.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))),
      updatedAt: now,
    }));

    await this.auditSink.record({
      toolId: updated.toolId,
      serverId: updated.definition.binding?.serverId ?? "unknown",
      toolName: updated.definition.binding?.toolName ?? updated.toolId,
      occurredAt: now,
      outcome: "administrative",
      reason: request.status === "pending"
        ? "approval-requested"
        : request.status === "approved"
          ? "approval-granted"
          : "approval-denied",
      metadata: Object.freeze({
        permissions,
        scope,
        actor: request.actor,
        reviewReason: request.reason,
      }),
    });

    return updated;
  }
}

export class RevokeMcpToolPermissionApprovalUseCase {
  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    private readonly auditSink: IMcpToolExecutionAuditSink = { record: async () => undefined },
  ) {}

  public async execute(request: { readonly toolId: string; readonly permissions: ReadonlyArray<McpToolPermissionScope>; readonly scope?: McpToolTrustScope; readonly actor?: string; readonly reason?: string }) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }
    const now = new Date().toISOString();
    const scope = normalizeScope(request.scope);
    const permissions = normalizePermissions(request.permissions);
    const nextApprovals = [...(tool.permissionApprovals ?? [])];
    const nextHistory = [...(tool.approvalHistory ?? [])];

    for (const permission of permissions) {
      const current = findLatestApproval(nextApprovals, permission, scope);
      const revised: McpToolPermissionApprovalRecord = Object.freeze({
        approvalId: current?.approvalId ?? `approval:${tool.toolId}:${permission}:${scope.scopeType}:${scope.scopeId ?? "global"}`,
        permission,
        scope,
        status: "revoked",
        requestedAt: current?.requestedAt ?? now,
        updatedAt: now,
        decidedBy: request.actor,
        reason: request.reason ?? "revoked",
      });
      if (current) {
        const index = nextApprovals.findIndex((entry) => entry.approvalId === current.approvalId);
        nextApprovals[index] = revised;
      } else {
        nextApprovals.push(revised);
      }
      nextHistory.push(Object.freeze({
        eventId: `approval-event:${tool.toolId}:${permission}:${now}:${Math.random().toString(16).slice(2)}`,
        permission,
        scope,
        fromStatus: current?.status,
        toStatus: "revoked" as const,
        occurredAt: now,
        actor: request.actor,
        reason: request.reason ?? "revoked",
      }));
    }

    const updated = await this.registryRepository.saveInstalledTool(Object.freeze({
      ...tool,
      permissionApprovals: Object.freeze(nextApprovals),
      approvalHistory: Object.freeze(nextHistory.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))),
      updatedAt: now,
    }));
    await this.auditSink.record({
      toolId: updated.toolId,
      serverId: updated.definition.binding?.serverId ?? "unknown",
      toolName: updated.definition.binding?.toolName ?? updated.toolId,
      occurredAt: now,
      outcome: "administrative",
      reason: "approval-revoked",
      metadata: Object.freeze({ permissions, scope, actor: request.actor, reviewReason: request.reason }),
    });
    return updated;
  }
}

export class SetMcpToolSandboxPolicyUseCase {
  constructor(private readonly registryRepository: IMcpToolRegistryRepository) {}

  public async execute(request: {
    readonly toolId: string;
    readonly policy: {
      readonly networkAccess?: "allow" | "deny";
      readonly networkAllowlist?: {
        readonly hosts?: ReadonlyArray<string>;
        readonly protocols?: ReadonlyArray<McpSandboxNetworkProtocol>;
      };
      readonly filesystemAccess?: {
        readonly mode: "deny" | "read-only" | "read-write";
        readonly readAllowedPaths?: ReadonlyArray<string>;
        readonly writeAllowedPaths?: ReadonlyArray<string>;
      };
      readonly assetAccess?: "deny" | "read-only" | "read-write";
      readonly environmentExposure?: { readonly mode: McpSandboxEnvironmentMode; readonly allowlist?: ReadonlyArray<string> };
    };
  }) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }
    const current = tool.sandboxPolicy ?? createDefaultMcpToolSandboxPolicy();
    const nextPolicy: McpToolSandboxPolicy = Object.freeze({
      networkAccess: request.policy.networkAccess ?? current.networkAccess,
      networkAllowlist: Object.freeze({
        hosts: Object.freeze(request.policy.networkAllowlist?.hosts ?? current.networkAllowlist?.hosts ?? []),
        protocols: Object.freeze(request.policy.networkAllowlist?.protocols ?? current.networkAllowlist?.protocols ?? []),
      }),
      filesystemAccess: Object.freeze({
        mode: request.policy.filesystemAccess?.mode ?? current.filesystemAccess.mode,
        readAllowedPaths: Object.freeze(request.policy.filesystemAccess?.readAllowedPaths ?? current.filesystemAccess.readAllowedPaths ?? []),
        writeAllowedPaths: Object.freeze(request.policy.filesystemAccess?.writeAllowedPaths ?? current.filesystemAccess.writeAllowedPaths ?? []),
      }),
      assetAccess: request.policy.assetAccess ?? current.assetAccess,
      environmentExposure: Object.freeze({
        mode: request.policy.environmentExposure?.mode ?? current.environmentExposure.mode,
        allowlist: Object.freeze(request.policy.environmentExposure?.allowlist ?? current.environmentExposure.allowlist ?? []),
      }),
    });
    return this.registryRepository.saveInstalledTool(Object.freeze({
      ...tool,
      sandboxPolicy: nextPolicy,
      updatedAt: new Date().toISOString(),
    }));
  }
}

export interface McpToolTrustStateReadModel {
  readonly toolId: string;
  readonly requiredPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly grantedPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly approval: {
    readonly scope: McpToolTrustScope;
    readonly missing: ReadonlyArray<McpToolPermissionScope>;
    readonly denied: ReadonlyArray<McpToolPermissionScope>;
    readonly approvals: ReadonlyArray<McpToolPermissionApprovalRecord>;
    readonly statusByPermission: ReadonlyArray<{
      readonly permission: McpToolPermissionScope;
      readonly status: McpToolPermissionApprovalStatus | "missing";
    }>;
  };
  readonly sandbox: {
    readonly declaredCapabilities: ReadonlyArray<"network" | "filesystem" | "asset" | "environment">;
    readonly policy: McpToolSandboxPolicy;
    readonly enforcement: Readonly<Record<"networkAccess" | "filesystemAccess" | "assetAccess" | "environmentExposure", "enforced" | "declared-only">>;
    readonly deniedCapabilities: ReadonlyArray<"network" | "filesystem" | "asset" | "environment">;
  };
  readonly executionReadiness: {
    readonly ready: boolean;
    readonly blockers: ReadonlyArray<"missing-approval" | "denied-approval" | "missing-permission-grant" | "sandbox-denied">;
  };
}

export class GetMcpToolTrustStateUseCase {
  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    private readonly approvalService: McpToolApprovalPolicyService = new McpToolApprovalPolicyService(),
    private readonly permissionService: McpToolPermissionPolicyService = new McpToolPermissionPolicyService(),
    private readonly sandboxService: McpToolSandboxPolicyService = new McpToolSandboxPolicyService(),
  ) {}

  public async execute(request: { readonly toolId: string; readonly scope?: McpToolTrustScope }): Promise<McpToolTrustStateReadModel> {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }
    const scope = normalizeScope(request.scope);
    const requiredPermissions = deriveRequiredMcpToolPermissions(tool.definition);
    const permissionDecision = this.permissionService.evaluate(tool, []);
    const approvalDecision = this.approvalService.evaluate(tool, scope, []);
    const sandboxDecision = this.sandboxService.evaluate(tool);
    const statuses = requiredPermissions.map((permission) => {
      const latestApproval = findLatestApproval(tool.permissionApprovals ?? [], permission, scope);
      return Object.freeze({
        permission,
        status: latestApproval?.status ?? "missing",
      });
    });
    const blockers = [
      ...(approvalDecision.missingApprovals.length > 0 ? ["missing-approval" as const] : []),
      ...(approvalDecision.deniedApprovals.length > 0 ? ["denied-approval" as const] : []),
      ...(permissionDecision.deniedPermissions.length > 0 ? ["missing-permission-grant" as const] : []),
      ...(!sandboxDecision.allowed ? ["sandbox-denied" as const] : []),
    ];
    return Object.freeze({
      toolId: tool.toolId,
      requiredPermissions,
      grantedPermissions: Object.freeze([...(tool.grantedPermissions ?? [])]),
      approval: Object.freeze({
        scope,
        missing: approvalDecision.missingApprovals,
        denied: approvalDecision.deniedApprovals,
        approvals: Object.freeze((tool.permissionApprovals ?? []).filter((entry) => requiredPermissions.includes(entry.permission))),
        statusByPermission: Object.freeze(statuses),
      }),
      sandbox: Object.freeze({
        declaredCapabilities: sandboxDecision.declaredCapabilities,
        policy: sandboxDecision.policy,
        enforcement: Object.freeze({ ...sandboxDecision.enforcement }),
        deniedCapabilities: sandboxDecision.deniedCapabilities,
      }),
      executionReadiness: Object.freeze({
        ready: blockers.length === 0,
        blockers: Object.freeze(blockers),
      }),
    });
  }
}

export class GetMissingMcpToolApprovalsUseCase {
  constructor(private readonly trustStateUseCase: GetMcpToolTrustStateUseCase) {}

  public async execute(request: { readonly toolId: string; readonly scope?: McpToolTrustScope }) {
    const trust = await this.trustStateUseCase.execute(request);
    return Object.freeze({
      toolId: trust.toolId,
      scope: trust.approval.scope,
      missingApprovals: trust.approval.missing,
      deniedApprovals: trust.approval.denied,
      approvalStatusByPermission: trust.approval.statusByPermission,
    });
  }
}

export class GetMcpToolEffectivePermissionsUseCase {
  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    private readonly permissionService: McpToolPermissionPolicyService = new McpToolPermissionPolicyService(),
  ) {}

  public async execute(request: { readonly toolId: string; readonly runtimePermissions?: ReadonlyArray<McpToolPermissionScope> }) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }
    return this.permissionService.evaluate(tool, request.runtimePermissions ?? []);
  }
}

export class GetMcpToolSandboxPostureUseCase {
  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    private readonly sandboxService: McpToolSandboxPolicyService = new McpToolSandboxPolicyService(),
  ) {}

  public async execute(request: { readonly toolId: string }) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }
    const sandboxDecision = this.sandboxService.evaluate(tool);
    return Object.freeze({
      toolId: tool.toolId,
      declaredCapabilities: sandboxDecision.declaredCapabilities,
      policy: sandboxDecision.policy,
      enforcement: sandboxDecision.enforcement,
      deniedCapabilities: sandboxDecision.deniedCapabilities,
      requestedCapabilities: sandboxDecision.requestedCapabilities,
    });
  }
}

export {
  GetMcpToolTrustStateUseCase as getToolTrustState,
  GetMissingMcpToolApprovalsUseCase as getMissingApprovals,
  GetMcpToolEffectivePermissionsUseCase as getEffectivePermissions,
  GetMcpToolSandboxPostureUseCase as getSandboxPosture,
};

function normalizePermissions(permissions: ReadonlyArray<McpToolPermissionScope>): ReadonlyArray<McpToolPermissionScope> {
  return Object.freeze([...new Set(permissions.map((permission) => permission.trim()).filter(Boolean))] as McpToolPermissionScope[]);
}

function normalizeScope(scope: McpToolTrustScope | undefined): McpToolTrustScope {
  if (!scope) {
    return Object.freeze({ scopeType: "global" });
  }
  return Object.freeze({
    scopeType: scope.scopeType,
    scopeId: scope.scopeId?.trim() || undefined,
  });
}

function findLatestApproval(
  approvals: ReadonlyArray<McpToolPermissionApprovalRecord>,
  permission: McpToolPermissionScope,
  scope: McpToolTrustScope,
): McpToolPermissionApprovalRecord | undefined {
  return [...approvals]
    .filter((entry) => entry.permission === permission)
    .filter((entry) => entry.scope.scopeType === scope.scopeType && entry.scope.scopeId === scope.scopeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}
