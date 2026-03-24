import type {
  McpToolPermissionScope,
  McpToolPermissionApprovalStatus,
  McpToolSandboxPolicy,
} from "../mcp/McpToolTrust";

export const AgentApprovalStatuses = Object.freeze({
  pending: "pending",
  approved: "approved",
  denied: "denied",
  revoked: "revoked",
});

export type AgentApprovalStatus = typeof AgentApprovalStatuses[keyof typeof AgentApprovalStatuses];

export const AgentExtendedPermissionIds = Object.freeze({
  runtimeExecute: "runtime.execute",
  workspaceRead: "workspace.read",
  workspaceWrite: "workspace.write",
});

export type AgentExtendedPermissionId =
  typeof AgentExtendedPermissionIds[keyof typeof AgentExtendedPermissionIds];

export type AgentPermissionId = McpToolPermissionScope | AgentExtendedPermissionId;

export interface AgentToolScopeConstraint {
  readonly toolId: string;
  readonly allowedScopes: ReadonlyArray<string>;
}

export interface AgentToolAccessPolicy {
  readonly allowedToolIds: ReadonlyArray<string>;
  readonly scopeConstraints: ReadonlyArray<AgentToolScopeConstraint>;
}

export interface AgentCostLimits {
  readonly maxTokens?: number;
  readonly maxEstimatedUsd?: number;
}

export interface AgentExecutionLimits {
  readonly maxSteps?: number;
  readonly maxWallClockMs?: number;
}

export interface AgentSafetyConstraint {
  readonly requiredApprovals: ReadonlyArray<{
    readonly permissionId: AgentPermissionId;
    readonly minimumStatus: AgentApprovalStatus;
    readonly scopeType: "tool" | "workspace" | "global";
    readonly scopeId?: string;
  }>;
  readonly deniedPermissionIds: ReadonlyArray<AgentPermissionId>;
  readonly sandbox: McpToolSandboxPolicy;
}

export interface AgentPolicy {
  readonly toolAccess: AgentToolAccessPolicy;
  readonly restrictedActions: ReadonlyArray<string>;
  readonly costLimits: AgentCostLimits;
  readonly executionLimits: AgentExecutionLimits;
  readonly safetyConstraints: AgentSafetyConstraint;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped]);
}

function isSupportedToolId(value: string): boolean {
  const normalized = value.trim();
  if (normalized.startsWith("mcp:")) {
    const parts = normalized.split(":");
    return parts.length === 3 && parts.every((part) => part.length > 0);
  }
  if (normalized.startsWith("workflow:")) {
    const parts = normalized.split(":");
    return parts.length >= 2 && parts.slice(1).every((part) => part.length > 0);
  }
  return false;
}

function normalizeScope(scope: string, toolId: string): string {
  const normalized = normalizeRequired(scope, "Agent tool scope");
  if (!/^[a-z0-9_.-]+$/i.test(normalized)) {
    throw new Error(`Agent tool scope '${normalized}' for '${toolId}' is malformed.`);
  }
  return normalized;
}

export function normalizeAgentPolicy(policy: AgentPolicy): AgentPolicy {
  const allowedToolIds = normalizeList(policy.toolAccess?.allowedToolIds);
  if (allowedToolIds.length === 0) {
    throw new Error("Agent policy must include at least one allowed tool.");
  }
  for (const toolId of allowedToolIds) {
    if (!isSupportedToolId(toolId)) {
      throw new Error(`Agent policy allowed tool id '${toolId}' is malformed.`);
    }
  }

  const toolScopeConstraints = Object.freeze(
    (policy.toolAccess?.scopeConstraints ?? []).map((constraint) => Object.freeze({
      toolId: normalizeRequired(constraint.toolId, "Agent tool scope toolId"),
      allowedScopes: Object.freeze(
        normalizeList(constraint.allowedScopes).map((scope) => normalizeScope(scope, constraint.toolId)),
      ),
    })),
  );

  for (const constraint of toolScopeConstraints) {
    if (!allowedToolIds.includes(constraint.toolId)) {
      throw new Error(`Agent tool scope constraint references unknown allowed tool '${constraint.toolId}'.`);
    }
    if (constraint.allowedScopes.length === 0) {
      throw new Error(`Agent tool scope constraint for '${constraint.toolId}' must include at least one scope.`);
    }
  }

  const executionLimitsInput = policy.executionLimits ?? {};
  const executionLimits = Object.freeze({
    maxSteps: normalizePositiveInt(executionLimitsInput.maxSteps, "Agent execution limit maxSteps"),
    maxWallClockMs: normalizePositiveInt(executionLimitsInput.maxWallClockMs, "Agent execution limit maxWallClockMs"),
  });

  const costLimitsInput = policy.costLimits ?? {};
  const costLimits = Object.freeze({
    maxTokens: normalizePositiveInt(costLimitsInput.maxTokens, "Agent cost limit maxTokens"),
    maxEstimatedUsd: normalizeNonNegativeNumber(costLimitsInput.maxEstimatedUsd, "Agent cost limit maxEstimatedUsd"),
  });
  if (costLimits.maxTokens !== undefined && costLimits.maxEstimatedUsd !== undefined && costLimits.maxTokens < 100) {
    throw new Error("Agent policy cost limits are conflicting: maxTokens is unrealistically low for a USD budget.");
  }

  const safetyInput = policy.safetyConstraints ?? {
    requiredApprovals: [],
    deniedPermissionIds: [],
    sandbox: {
      network: { allowed: false },
      filesystem: { allowed: false },
      assets: { read: true, write: false },
      environment: { mode: "none" },
    },
  };
  const requiredApprovals = Object.freeze((safetyInput.requiredApprovals ?? []).map((entry) => Object.freeze({
    permissionId: normalizePermissionId(entry.permissionId),
    minimumStatus: normalizeApprovalStatus(entry.minimumStatus),
    scopeType: normalizeScopeType(entry.scopeType),
    scopeId: entry.scopeId?.trim() || undefined,
  })));
  const deniedPermissionIds = Object.freeze((safetyInput.deniedPermissionIds ?? []).map((permissionId) => normalizePermissionId(permissionId)));
  const sandbox = normalizeSandboxPolicy(safetyInput.sandbox);

  if (!sandbox.network.allowed && deniedPermissionIds.includes("network.access")) {
    throw new Error("Agent policy should not redundantly deny network.access when sandbox.network is deny.");
  }
  if (!sandbox.network.allowed && requiredApprovals.some((entry) => entry.permissionId === "network.access")) {
    throw new Error("Agent policy sandbox denies network access but approvals require network.access.");
  }
  if (!sandbox.filesystem.allowed && requiredApprovals.some((entry) => entry.permissionId.startsWith("filesystem."))) {
    throw new Error("Agent policy sandbox denies filesystem access but approvals require filesystem permissions.");
  }
  for (const approval of requiredApprovals) {
    if (approval.scopeType === "tool") {
      if (!approval.scopeId) {
        throw new Error("Agent required approvals with tool scope must include scopeId.");
      }
      if (!allowedToolIds.includes(approval.scopeId)) {
        throw new Error(`Agent required approval references unknown tool scope '${approval.scopeId}'.`);
      }
    }
    if (approval.scopeType !== "tool" && approval.scopeId) {
      throw new Error("Agent required approval scopeId is only supported when scopeType is tool.");
    }
  }
  for (const deniedPermissionId of deniedPermissionIds) {
    if (requiredApprovals.some((entry) => entry.permissionId === deniedPermissionId)) {
      throw new Error(`Agent policy permission '${deniedPermissionId}' cannot be both required and denied.`);
    }
  }

  return Object.freeze({
    toolAccess: Object.freeze({
      allowedToolIds,
      scopeConstraints: toolScopeConstraints,
    }),
    restrictedActions: normalizeList(policy.restrictedActions),
    costLimits,
    executionLimits,
    safetyConstraints: Object.freeze({
      requiredApprovals,
      deniedPermissionIds,
      sandbox,
    }),
  });
}

function normalizeScopeType(value: "tool" | "workspace" | "global"): "tool" | "workspace" | "global" {
  if (!["tool", "workspace", "global"].includes(value)) {
    throw new Error("Agent required approval scopeType must be tool, workspace, or global.");
  }
  return value;
}

function normalizeApprovalStatus(value: McpToolPermissionApprovalStatus | undefined): AgentApprovalStatus {
  const normalized = value ?? "approved";
  if (!Object.values(AgentApprovalStatuses).includes(normalized)) {
    throw new Error("Agent required approval minimumStatus is invalid.");
  }
  return normalized;
}

function normalizePermissionId(value: string): AgentPermissionId {
  const normalized = normalizeRequired(value, "Agent permissionId") as AgentPermissionId;
  const supported: ReadonlyArray<string> = [
    "asset.read",
    "asset.write",
    "network.access",
    "filesystem.read",
    "filesystem.write",
    "system.exec",
    AgentExtendedPermissionIds.runtimeExecute,
    AgentExtendedPermissionIds.workspaceRead,
    AgentExtendedPermissionIds.workspaceWrite,
  ];
  if (!supported.includes(normalized)) {
    throw new Error(`Agent permissionId '${normalized}' is unsupported.`);
  }
  return normalized;
}

function normalizeSandboxPolicy(value: McpToolSandboxPolicy | undefined): McpToolSandboxPolicy {
  const sandbox = value ?? {
    network: { allowed: false },
    filesystem: { allowed: false },
    assets: { read: true, write: false },
    environment: { mode: "none" as const },
  };

  if (!sandbox.network) {
    throw new Error("Agent sandbox network policy is required.");
  }
  if (sandbox.network.allowedHosts && sandbox.network.allowedHosts.some((host) => !host.trim())) {
    throw new Error("Agent sandbox network allowedHosts must not contain empty entries.");
  }
  if (sandbox.filesystem.allowed && !(sandbox.filesystem.readPaths?.length || sandbox.filesystem.writePaths?.length)) {
    throw new Error("Agent sandbox filesystem policy requires readPaths or writePaths when filesystem is allowed.");
  }
  if (sandbox.environment.mode === "allowlist" && (sandbox.environment.allowedEnvVars?.length ?? 0) === 0) {
    throw new Error("Agent sandbox environment allowlist mode requires allowedEnvVars.");
  }

  return Object.freeze({
    network: Object.freeze({
      allowed: sandbox.network.allowed,
      allowedHosts: normalizeList(sandbox.network.allowedHosts),
      allowedProtocols: Object.freeze([...(sandbox.network.allowedProtocols ?? [])]),
    }),
    filesystem: Object.freeze({
      allowed: sandbox.filesystem.allowed,
      readPaths: normalizeList(sandbox.filesystem.readPaths),
      writePaths: normalizeList(sandbox.filesystem.writePaths),
    }),
    assets: Object.freeze({
      read: Boolean(sandbox.assets.read),
      write: Boolean(sandbox.assets.write),
    }),
    environment: Object.freeze({
      mode: sandbox.environment.mode,
      allowedEnvVars: normalizeList(sandbox.environment.allowedEnvVars),
    }),
  });
}

function normalizePositiveInt(value: number | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer when provided.`);
  }
  return value;
}

function normalizeNonNegativeNumber(value: number | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number when provided.`);
  }
  return value;
}
