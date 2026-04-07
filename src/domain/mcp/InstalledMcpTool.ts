import type { McpToolDefinition } from "./McpToolCapability";
import {
  createDefaultMcpToolSandboxEnforcementSummary,
  createDefaultMcpToolSandboxPolicy,
  type McpToolPermissionApprovalEvent,
  type McpToolPermissionApprovalRecord,
  type McpToolPermissionScope,
  type McpToolSandboxEnforcementSummary,
  type McpToolSandboxPolicy,
} from "./McpToolTrust";

export type InstalledMcpToolStatus = "enabled" | "disabled";
export type McpToolDefinitionSourceKind = "inline" | "local" | "remote";
export type McpToolVersionTransitionKind = "initial-install" | "same-version" | "upgrade" | "downgrade" | "incomparable";
export type McpToolLifecycleAction = "install" | "reinstall" | "update" | "downgrade" | "replace";
export type McpToolVersionPolicy = "pinned" | "floating";

export interface McpToolDefinitionSource {
  readonly kind: McpToolDefinitionSourceKind;
  readonly location: string;
}

export interface InstalledMcpToolRecord {
  readonly toolId: string;
  readonly definition: McpToolDefinition;
  readonly status: InstalledMcpToolStatus;
  readonly installedAt: string;
  readonly updatedAt: string;
  readonly source: McpToolDefinitionSource;
  readonly grantedPermissions?: ReadonlyArray<McpToolPermissionScope>;
  readonly permissionApprovals?: ReadonlyArray<McpToolPermissionApprovalRecord>;
  readonly approvalHistory?: ReadonlyArray<McpToolPermissionApprovalEvent>;
  readonly sandboxPolicy?: McpToolSandboxPolicy;
  readonly sandboxEnforcement?: McpToolSandboxEnforcementSummary;
  readonly lifecycle?: InstalledMcpToolLifecycle;
}

export interface InstalledMcpToolLifecycle {
  readonly versionPolicy: McpToolVersionPolicy;
  readonly lastAction: McpToolLifecycleAction;
  readonly lastTransition: McpToolVersionTransitionKind;
  readonly installCount: number;
  readonly reinstallCount: number;
  readonly updateCount: number;
  readonly downgradeCount: number;
  readonly replaceCount: number;
  readonly previousVersion?: string;
  readonly lastResolvedVersion: string;
  readonly history: ReadonlyArray<InstalledMcpToolLifecycleEvent>;
}

export interface InstalledMcpToolLifecycleEvent {
  readonly occurredAt: string;
  readonly action: McpToolLifecycleAction;
  readonly transition: McpToolVersionTransitionKind;
  readonly fromVersion?: string;
  readonly toVersion: string;
  readonly reason?: string;
}

export function createInstalledMcpToolRecord(params: {
  readonly definition: McpToolDefinition;
  readonly source: McpToolDefinitionSource;
  readonly now?: Date;
  readonly status?: InstalledMcpToolStatus;
  readonly versionPolicy?: McpToolVersionPolicy;
}): InstalledMcpToolRecord {
  const nowIso = (params.now ?? new Date()).toISOString();
  return Object.freeze({
    toolId: params.definition.id,
    definition: params.definition,
    status: params.status ?? "enabled",
    installedAt: nowIso,
    updatedAt: nowIso,
    source: Object.freeze({
      kind: params.source.kind,
      location: params.source.location.trim(),
    }),
    grantedPermissions: Object.freeze([]),
    permissionApprovals: Object.freeze([]),
    approvalHistory: Object.freeze([]),
    sandboxPolicy: createDefaultMcpToolSandboxPolicy(),
    sandboxEnforcement: createDefaultMcpToolSandboxEnforcementSummary(),
    lifecycle: Object.freeze({
      versionPolicy: params.versionPolicy ?? "pinned",
      lastAction: "install",
      lastTransition: "initial-install",
      installCount: 1,
      reinstallCount: 0,
      updateCount: 0,
      downgradeCount: 0,
      replaceCount: 0,
      lastResolvedVersion: params.definition.version.trim(),
      history: Object.freeze([
        Object.freeze({
          occurredAt: nowIso,
          action: "install",
          transition: "initial-install",
          toVersion: params.definition.version.trim(),
          reason: "initial-install",
        }),
      ]),
    }),
  });
}
