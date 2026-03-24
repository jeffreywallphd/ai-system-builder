export interface AgentToolScopeConstraint {
  readonly toolId: string;
  readonly allowedScopes: ReadonlyArray<string>;
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
  readonly requiredApprovals: ReadonlyArray<string>;
  readonly deniedPermissions: ReadonlyArray<string>;
}

export interface AgentPolicy {
  readonly allowedTools: ReadonlyArray<string>;
  readonly toolScopeConstraints: ReadonlyArray<AgentToolScopeConstraint>;
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
  return Object.freeze((values ?? []).map((value) => value.trim()).filter(Boolean));
}

export function normalizeAgentPolicy(policy: AgentPolicy): AgentPolicy {
  const allowedTools = normalizeList(policy.allowedTools);
  if (allowedTools.length === 0) {
    throw new Error("Agent policy must include at least one allowed tool.");
  }

  const toolScopeConstraints = Object.freeze(
    (policy.toolScopeConstraints ?? []).map((constraint) => Object.freeze({
      toolId: normalizeRequired(constraint.toolId, "Agent tool scope toolId"),
      allowedScopes: normalizeList(constraint.allowedScopes),
    })),
  );

  for (const constraint of toolScopeConstraints) {
    if (!allowedTools.includes(constraint.toolId)) {
      throw new Error(`Agent tool scope constraint references unknown allowed tool '${constraint.toolId}'.`);
    }
  }

  const executionLimits = Object.freeze({
    maxSteps: normalizePositiveInt(policy.executionLimits.maxSteps, "Agent execution limit maxSteps"),
    maxWallClockMs: normalizePositiveInt(policy.executionLimits.maxWallClockMs, "Agent execution limit maxWallClockMs"),
  });

  const costLimits = Object.freeze({
    maxTokens: normalizePositiveInt(policy.costLimits.maxTokens, "Agent cost limit maxTokens"),
    maxEstimatedUsd: normalizeNonNegativeNumber(policy.costLimits.maxEstimatedUsd, "Agent cost limit maxEstimatedUsd"),
  });

  return Object.freeze({
    allowedTools,
    toolScopeConstraints,
    restrictedActions: normalizeList(policy.restrictedActions),
    costLimits,
    executionLimits,
    safetyConstraints: Object.freeze({
      requiredApprovals: normalizeList(policy.safetyConstraints.requiredApprovals),
      deniedPermissions: normalizeList(policy.safetyConstraints.deniedPermissions),
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
