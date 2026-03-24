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
    readonly permissionId: string;
    readonly scopeType: "tool" | "workspace" | "global";
    readonly scopeId?: string;
  }>;
  readonly deniedPermissionIds: ReadonlyArray<string>;
  readonly sandbox: {
    readonly network: "deny" | "allow";
    readonly filesystem: "deny" | "read-only" | "read-write";
    readonly assets: "deny" | "read-only" | "read-write";
    readonly allowEnvironmentVariables: ReadonlyArray<string>;
  };
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

export function normalizeAgentPolicy(policy: AgentPolicy): AgentPolicy {
  const allowedToolIds = normalizeList(policy.toolAccess?.allowedToolIds);
  if (allowedToolIds.length === 0) {
    throw new Error("Agent policy must include at least one allowed tool.");
  }

  const toolScopeConstraints = Object.freeze(
    (policy.toolAccess?.scopeConstraints ?? []).map((constraint) => Object.freeze({
      toolId: normalizeRequired(constraint.toolId, "Agent tool scope toolId"),
      allowedScopes: normalizeList(constraint.allowedScopes),
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
    sandbox: { network: "deny", filesystem: "deny", assets: "read-only", allowEnvironmentVariables: [] },
  };
  const requiredApprovals = Object.freeze((safetyInput.requiredApprovals ?? []).map((entry) => Object.freeze({
    permissionId: normalizeRequired(entry.permissionId, "Agent required approval permissionId"),
    scopeType: normalizeScopeType(entry.scopeType),
    scopeId: entry.scopeId?.trim() || undefined,
  })));
  const deniedPermissionIds = normalizeList(safetyInput.deniedPermissionIds);
  const sandbox = Object.freeze({
    network: safetyInput.sandbox?.network ?? "deny",
    filesystem: safetyInput.sandbox?.filesystem ?? "deny",
    assets: safetyInput.sandbox?.assets ?? "read-only",
    allowEnvironmentVariables: normalizeList(safetyInput.sandbox?.allowEnvironmentVariables),
  });

  if (sandbox.network === "deny" && deniedPermissionIds.includes("network.open")) {
    throw new Error("Agent policy should not redundantly deny network.open when sandbox.network is deny.");
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
