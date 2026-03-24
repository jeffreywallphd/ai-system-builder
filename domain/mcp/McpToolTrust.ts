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

export interface McpToolSandboxPolicy {
  readonly networkAccess: "allow" | "deny";
  readonly filesystemAccess: {
    readonly mode: "deny" | "read-only" | "read-write";
    readonly allowedPaths?: ReadonlyArray<string>;
  };
  readonly assetAccess: "deny" | "read-only" | "read-write";
  readonly environmentExposure: {
    readonly mode: McpSandboxEnvironmentMode;
    readonly allowlist?: ReadonlyArray<string>;
  };
}

export type McpSandboxEnforcementStatus = "enforced" | "declared-only";

export interface McpToolSandboxEnforcementSummary {
  readonly networkAccess: McpSandboxEnforcementStatus;
  readonly filesystemAccess: McpSandboxEnforcementStatus;
  readonly assetAccess: McpSandboxEnforcementStatus;
  readonly environmentExposure: McpSandboxEnforcementStatus;
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
    networkAccess: "allow",
    filesystemAccess: Object.freeze({ mode: "read-write", allowedPaths: Object.freeze([]) }),
    assetAccess: "read-write",
    environmentExposure: Object.freeze({ mode: "inherit-runtime", allowlist: Object.freeze([]) }),
  });
}

export function createDefaultMcpToolSandboxEnforcementSummary(): McpToolSandboxEnforcementSummary {
  return Object.freeze({
    networkAccess: "enforced",
    filesystemAccess: "enforced",
    assetAccess: "enforced",
    environmentExposure: "declared-only",
  });
}
