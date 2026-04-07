import type {
  McpSandboxEnvironmentMode,
  McpSandboxNetworkProtocol,
  McpToolPermissionScope,
  McpToolPermissionApprovalStatus,
  McpToolSandboxPolicy,
} from "../mcp/McpToolTrust";
import { isMcpToolId, parseMcpToolId, type McpToolIdentity } from "../mcp/McpToolIdentity";
import { normalizeAgentToolId } from "./AgentToolIdentity";

export const AgentApprovalStatuses = Object.freeze({
  pending: "pending",
  approved: "approved",
  denied: "denied",
  revoked: "revoked",
} as const satisfies Record<McpToolPermissionApprovalStatus, McpToolPermissionApprovalStatus>);

export type AgentApprovalStatus = McpToolPermissionApprovalStatus;

const CanonicalMcpPermissionIds = Object.freeze([
  "asset.read",
  "asset.write",
  "network.access",
  "filesystem.read",
  "filesystem.write",
  "system.exec",
] as const satisfies ReadonlyArray<McpToolPermissionScope>);

const CanonicalSandboxEnvironmentModes = Object.freeze([
  "inherit-runtime",
  "none",
  "allowlist",
] as const satisfies ReadonlyArray<McpSandboxEnvironmentMode>);

const CanonicalSandboxNetworkProtocols = Object.freeze([
  "http",
  "https",
  "ws",
  "wss",
  "tcp",
  "udp",
] as const satisfies ReadonlyArray<McpSandboxNetworkProtocol>);

export const AgentExtendedPermissionIds = Object.freeze({
  runtimeExecute: "runtime.execute",
  workspaceRead: "workspace.read",
  workspaceWrite: "workspace.write",
});

export type AgentExtendedPermissionId =
  typeof AgentExtendedPermissionIds[keyof typeof AgentExtendedPermissionIds];

export type AgentPermissionId = McpToolPermissionScope | AgentExtendedPermissionId;

export interface AgentMcpToolBinding {
  readonly toolId: string;
  readonly serverId: string;
  readonly toolName: string;
}

export interface AgentToolScopeConstraint {
  readonly toolId: string;
  readonly allowedScopes: ReadonlyArray<string>;
}

export interface AgentToolAccessPolicy {
  readonly allowedToolIds: ReadonlyArray<string>;
  readonly allowedMcpTools?: ReadonlyArray<AgentMcpToolBinding>;
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

function normalizeToolId(value: string): string {
  return normalizeAgentToolId(value, "Agent policy allowed tool id");
}

function normalizeScope(scope: string, toolId: string): string {
  const normalized = normalizeRequired(scope, "Agent tool scope");
  if (!/^[a-z0-9_.-]+$/i.test(normalized)) {
    throw new Error(`Agent tool scope '${normalized}' for '${toolId}' is malformed.`);
  }
  return normalized;
}

function normalizeScopeType(value: "tool" | "workspace" | "global"): "tool" | "workspace" | "global" {
  if (!["tool", "workspace", "global"].includes(value)) {
    throw new Error("Agent required approval scopeType must be tool, workspace, or global.");
  }
  return value;
}

function normalizeApprovalStatus(value: McpToolPermissionApprovalStatus | undefined): AgentApprovalStatus {
  const normalized = value ?? AgentApprovalStatuses.approved;
  if (!Object.values(AgentApprovalStatuses).includes(normalized)) {
    throw new Error("Agent required approval minimumStatus is invalid.");
  }
  return normalized;
}

function normalizePermissionId(value: string): AgentPermissionId {
  const normalized = normalizeRequired(value, "Agent permissionId") as AgentPermissionId;
  const supported: ReadonlyArray<string> = [
    ...CanonicalMcpPermissionIds,
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
  if (!sandbox.filesystem) {
    throw new Error("Agent sandbox filesystem policy is required.");
  }
  if (!sandbox.assets) {
    throw new Error("Agent sandbox assets policy is required.");
  }
  if (!sandbox.environment) {
    throw new Error("Agent sandbox environment policy is required.");
  }

  if (!CanonicalSandboxEnvironmentModes.includes(sandbox.environment.mode)) {
    throw new Error(`Agent sandbox environment mode '${sandbox.environment.mode}' is invalid.`);
  }

  const normalizedAllowedProtocols = Object.freeze(
    [...new Set(sandbox.network.allowedProtocols ?? [])].map((protocol) => {
      if (!CanonicalSandboxNetworkProtocols.includes(protocol)) {
        throw new Error(`Agent sandbox network protocol '${protocol}' is invalid.`);
      }
      return protocol;
    }),
  );

  const normalizedAllowedHosts = normalizeList(sandbox.network.allowedHosts);
  if (normalizedAllowedHosts.some((host) => /\s/.test(host))) {
    throw new Error("Agent sandbox network allowedHosts must not include whitespace.");
  }

  const normalizedReadPaths = normalizeList(sandbox.filesystem.readPaths);
  const normalizedWritePaths = normalizeList(sandbox.filesystem.writePaths);
  const normalizedAllowedEnvVars = normalizeList(sandbox.environment.allowedEnvVars);

  if (!sandbox.network.allowed && (normalizedAllowedHosts.length > 0 || normalizedAllowedProtocols.length > 0)) {
    throw new Error("Agent sandbox network denied policy cannot include allowedHosts or allowedProtocols.");
  }

  if (!sandbox.filesystem.allowed && (normalizedReadPaths.length > 0 || normalizedWritePaths.length > 0)) {
    throw new Error("Agent sandbox filesystem denied policy cannot include readPaths or writePaths.");
  }

  if (sandbox.filesystem.allowed && normalizedReadPaths.length === 0 && normalizedWritePaths.length === 0) {
    throw new Error("Agent sandbox filesystem policy requires readPaths or writePaths when filesystem is allowed.");
  }

  if (sandbox.environment.mode === "allowlist" && normalizedAllowedEnvVars.length === 0) {
    throw new Error("Agent sandbox environment allowlist mode requires allowedEnvVars.");
  }

  if (sandbox.environment.mode === "none" && normalizedAllowedEnvVars.length > 0) {
    throw new Error("Agent sandbox environment none mode cannot include allowedEnvVars.");
  }

  return Object.freeze({
    network: Object.freeze({
      allowed: sandbox.network.allowed,
      allowedHosts: normalizedAllowedHosts,
      allowedProtocols: normalizedAllowedProtocols,
    }),
    filesystem: Object.freeze({
      allowed: sandbox.filesystem.allowed,
      readPaths: normalizedReadPaths,
      writePaths: normalizedWritePaths,
    }),
    assets: Object.freeze({
      read: Boolean(sandbox.assets.read),
      write: Boolean(sandbox.assets.write),
    }),
    environment: Object.freeze({
      mode: sandbox.environment.mode,
      allowedEnvVars: normalizedAllowedEnvVars,
    }),
  });
}

function deriveAllowedMcpTools(
  allowedToolIds: ReadonlyArray<string>,
  explicitBindings?: ReadonlyArray<AgentMcpToolBinding>,
): ReadonlyArray<AgentMcpToolBinding> {
  const derived = new Map<string, AgentMcpToolBinding>();

  for (const toolId of allowedToolIds) {
    if (!isMcpToolId(toolId)) {
      continue;
    }
    const identity: McpToolIdentity = parseMcpToolId(toolId);
    derived.set(identity.toolId, Object.freeze({
      toolId: identity.toolId,
      serverId: identity.serverId,
      toolName: identity.toolName,
    }));
  }

  for (const binding of explicitBindings ?? []) {
    const identity = parseMcpToolId(binding.toolId);
    if (!allowedToolIds.includes(identity.toolId)) {
      throw new Error(`Agent policy allowedMcpTools entry '${identity.toolId}' must also be present in allowedToolIds.`);
    }
    if (binding.serverId.trim() !== identity.serverId || binding.toolName.trim() !== identity.toolName) {
      throw new Error(`Agent policy allowedMcpTools entry '${identity.toolId}' must match canonical serverId/toolName.`);
    }
    derived.set(identity.toolId, Object.freeze({
      toolId: identity.toolId,
      serverId: identity.serverId,
      toolName: identity.toolName,
    }));
  }

  return Object.freeze([...derived.values()].sort((left, right) => left.toolId.localeCompare(right.toolId)));
}

export function normalizeAgentPolicy(policy: AgentPolicy): AgentPolicy {
  const allowedToolIds = Object.freeze(normalizeList(policy.toolAccess?.allowedToolIds).map((toolId) => normalizeToolId(toolId)));
  const allowedMcpTools = deriveAllowedMcpTools(allowedToolIds, policy.toolAccess?.allowedMcpTools);
  if (allowedToolIds.length === 0) {
    throw new Error("Agent policy must include at least one allowed tool.");
  }

  const toolScopeConstraints = Object.freeze(
    (policy.toolAccess?.scopeConstraints ?? []).map((constraint) => Object.freeze({
      toolId: normalizeToolId(constraint.toolId),
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
      environment: { mode: "none" as const },
    },
  };

  const requiredApprovals = Object.freeze((safetyInput.requiredApprovals ?? []).map((entry) => Object.freeze({
    permissionId: normalizePermissionId(entry.permissionId),
    minimumStatus: normalizeApprovalStatus(entry.minimumStatus),
    scopeType: normalizeScopeType(entry.scopeType),
    scopeId: entry.scopeId?.trim() || undefined,
  })));

  const deniedPermissionIds = Object.freeze(
    [...new Set((safetyInput.deniedPermissionIds ?? []).map((permissionId) => normalizePermissionId(permissionId)))],
  );
  const sandbox = normalizeSandboxPolicy(safetyInput.sandbox);

  const requiredApprovalByKey = new Map<string, AgentApprovalStatus>();
  for (const approval of requiredApprovals) {
    const key = `${approval.permissionId}|${approval.scopeType}|${approval.scopeId ?? "*"}`;
    const existing = requiredApprovalByKey.get(key);
    if (existing && existing !== approval.minimumStatus) {
      throw new Error(`Agent policy approval for '${approval.permissionId}' has conflicting minimumStatus values.`);
    }
    requiredApprovalByKey.set(key, approval.minimumStatus);

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

  if (!sandbox.network.allowed && deniedPermissionIds.includes("network.access")) {
    throw new Error("Agent policy should not redundantly deny network.access when sandbox.network is deny.");
  }
  if (!sandbox.network.allowed && requiredApprovals.some((entry) => entry.permissionId === "network.access")) {
    throw new Error("Agent policy sandbox denies network access but approvals require network.access.");
  }
  if (!sandbox.filesystem.allowed && requiredApprovals.some((entry) => entry.permissionId.startsWith("filesystem."))) {
    throw new Error("Agent policy sandbox denies filesystem access but approvals require filesystem permissions.");
  }
  if (!sandbox.assets.read && requiredApprovals.some((entry) => entry.permissionId === "asset.read")) {
    throw new Error("Agent policy sandbox denies asset read but approvals require asset.read.");
  }
  if (!sandbox.assets.write && requiredApprovals.some((entry) => entry.permissionId === "asset.write")) {
    throw new Error("Agent policy sandbox denies asset write but approvals require asset.write.");
  }

  for (const deniedPermissionId of deniedPermissionIds) {
    if (requiredApprovals.some((entry) => entry.permissionId === deniedPermissionId)) {
      throw new Error(`Agent policy permission '${deniedPermissionId}' cannot be both required and denied.`);
    }
  }

  return Object.freeze({
    toolAccess: Object.freeze({
      allowedToolIds,
      allowedMcpTools,
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
