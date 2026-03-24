import type { McpToolDefinition, McpToolSideEffectClass } from "./McpToolCapability";

export type McpToolPermissionScope =
  | "asset.read"
  | "asset.write"
  | "network.access"
  | "filesystem.read"
  | "filesystem.write"
  | "system.exec";

export type McpToolTrustScopeType = "global" | "project" | "user";
export type McpToolPermissionApprovalStatus = "pending" | "approved" | "denied" | "revoked";

export interface McpToolTrustScope {
  readonly scopeType: McpToolTrustScopeType;
  readonly scopeId?: string;
}

export interface McpToolPermissionApprovalRecord {
  readonly approvalId: string;
  readonly permission: McpToolPermissionScope;
  readonly scope: McpToolTrustScope;
  readonly status: McpToolPermissionApprovalStatus;
  readonly requestedAt: string;
  readonly updatedAt: string;
  readonly decidedBy?: string;
  readonly reason?: string;
}

export interface McpToolPermissionApprovalEvent {
  readonly eventId: string;
  readonly permission: McpToolPermissionScope;
  readonly scope: McpToolTrustScope;
  readonly fromStatus?: McpToolPermissionApprovalStatus;
  readonly toStatus: McpToolPermissionApprovalStatus;
  readonly occurredAt: string;
  readonly actor?: string;
  readonly reason?: string;
}

export type McpSandboxEnvironmentMode = "inherit-runtime" | "none" | "allowlist";
export type McpSandboxNetworkProtocol = "http" | "https" | "ws" | "wss" | "tcp" | "udp";
export type McpSandboxAssetAction = "read" | "write";

export interface McpToolSandboxPolicy {
  readonly network: {
    readonly allowed: boolean;
    readonly allowedHosts?: ReadonlyArray<string>;
    readonly allowedProtocols?: ReadonlyArray<McpSandboxNetworkProtocol>;
  };
  readonly filesystem: {
    readonly allowed: boolean;
    readonly readPaths?: ReadonlyArray<string>;
    readonly writePaths?: ReadonlyArray<string>;
  };
  readonly assets: {
    readonly read: boolean;
    readonly write: boolean;
  };
  readonly environment: {
    readonly mode: McpSandboxEnvironmentMode;
    readonly allowedEnvVars?: ReadonlyArray<string>;
  };
}

export interface McpToolSandboxCapabilityRequest {
  readonly network?: {
    readonly hosts?: ReadonlyArray<string>;
    readonly protocols?: ReadonlyArray<McpSandboxNetworkProtocol>;
  };
  readonly filesystem?: {
    readonly readPaths?: ReadonlyArray<string>;
    readonly writePaths?: ReadonlyArray<string>;
  };
  readonly asset?: {
    readonly actions?: ReadonlyArray<McpSandboxAssetAction>;
  };
  readonly environment?: {
    readonly variableNames?: ReadonlyArray<string>;
  };
}

export type McpSandboxEnforcementStatus = "enforced" | "declared-only";

export interface McpToolSandboxEnforcementSummary {
  readonly network: McpSandboxEnforcementStatus;
  readonly filesystem: McpSandboxEnforcementStatus;
  readonly assets: McpSandboxEnforcementStatus;
  readonly environment: McpSandboxEnforcementStatus;
}

export interface McpToolCredentialFieldRequirement {
  readonly key: string;
  readonly label: string;
  readonly secret: boolean;
  readonly required: boolean;
  readonly format?: "string" | "token" | "password";
  readonly description?: string;
}

export interface McpToolCredentialStatus {
  readonly toolId: string;
  readonly required: boolean;
  readonly configured: boolean;
  readonly missingRequiredFields: ReadonlyArray<string>;
  readonly updatedAt?: string;
}

export interface McpToolCredentialValidationResult {
  readonly toolId: string;
  readonly status: "valid" | "missing" | "partial" | "invalid";
  readonly missingFields: ReadonlyArray<string>;
  readonly malformedFields: ReadonlyArray<string>;
  readonly classification: "missing-auth-configuration" | "invalid-credentials" | "authorized";
}

export interface McpToolExecutionPermissionDecision {
  readonly allowed: boolean;
  readonly requiredPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly grantedPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly deniedPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly reason: "allowed" | "missing-grants";
}

export interface McpToolExecutionApprovalDecision {
  readonly allowed: boolean;
  readonly requiredPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly missingApprovals: ReadonlyArray<McpToolPermissionScope>;
  readonly deniedApprovals: ReadonlyArray<McpToolPermissionScope>;
  readonly approvalScope: McpToolTrustScope;
  readonly reason: "approved" | "approval-required" | "approval-denied";
}

export interface McpToolExecutionSandboxDecision {
  readonly allowed: boolean;
  readonly deniedCapabilities: ReadonlyArray<"network" | "filesystem" | "asset" | "environment">;
  readonly declaredCapabilities: ReadonlyArray<"network" | "filesystem" | "asset" | "environment">;
  readonly requestedCapabilities: McpToolSandboxCapabilityRequest;
  readonly policy: McpToolSandboxPolicy;
  readonly enforcement: McpToolSandboxEnforcementSummary;
  readonly reason: "sandbox-allowed" | "sandbox-denied";
}

const sideEffectPermissionMap: Readonly<Record<McpToolSideEffectClass, ReadonlyArray<McpToolPermissionScope>>> = Object.freeze({
  none: Object.freeze([]),
  read: Object.freeze(["asset.read"]),
  write: Object.freeze(["asset.write"]),
  network: Object.freeze(["network.access"]),
  system: Object.freeze(["filesystem.read", "filesystem.write", "system.exec"]),
});

export function deriveRequiredMcpToolPermissions(definition: McpToolDefinition): ReadonlyArray<McpToolPermissionScope> {
  const sideEffectPermissions = sideEffectPermissionMap[definition.sideEffects] ?? [];
  const explicitPermissions = (definition.permissions ?? []).filter(Boolean);
  return Object.freeze([...new Set([...sideEffectPermissions, ...explicitPermissions])]);
}

export function createDefaultMcpToolSandboxPolicy(): McpToolSandboxPolicy {
  return Object.freeze({
    network: Object.freeze({
      allowed: true,
      allowedHosts: Object.freeze([]),
      allowedProtocols: Object.freeze(["http", "https", "ws", "wss", "tcp", "udp"]),
    }),
    filesystem: Object.freeze({
      allowed: true,
      readPaths: Object.freeze([]),
      writePaths: Object.freeze([]),
    }),
    assets: Object.freeze({
      read: true,
      write: true,
    }),
    environment: Object.freeze({ mode: "inherit-runtime", allowedEnvVars: Object.freeze([]) }),
  });
}

export function createDefaultMcpToolSandboxEnforcementSummary(): McpToolSandboxEnforcementSummary {
  return Object.freeze({
    network: "enforced",
    filesystem: "enforced",
    assets: "enforced",
    environment: "declared-only",
  });
}
