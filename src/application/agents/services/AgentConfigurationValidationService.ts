import {
  createAgent,
  type Agent,
  type AgentExecutionConfiguration,
  type AgentPlanningStrategy,
  AgentPlanningStrategyModes,
  SupportedAgentPlanningStrategies,
} from "@domain/agents/Agent";
import { isCanonicalAgentToolId } from "@domain/agents/AgentToolIdentity";
import type { AgentGoal } from "@domain/agents/AgentGoal";
import type { AgentMemoryConfiguration } from "@domain/agents/AgentMemory";
import type { AgentPolicy } from "@domain/agents/AgentPolicy";
import { AgentConfigurationValidationError } from "./AgentConfigurationValidationError";

export interface AgentConfigurationValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly section: "goals" | "policy" | "tools" | "memory" | "strategy" | "execution" | "agent";
}

export interface AgentConfigurationValidationInput {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly memory: AgentMemoryConfiguration;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly execution: AgentExecutionConfiguration;
}

export interface AgentConfigurationValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<AgentConfigurationValidationIssue>;
}

export interface AgentConfigurationValidationOptions {
  readonly mode: "create" | "update";
  readonly existingAgentId?: string;
}

export function toAgentConfigurationValidationInput(agent: Agent): AgentConfigurationValidationInput {
  return Object.freeze({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    goals: agent.goals,
    policy: agent.policy,
    memory: agent.memory,
    planningStrategy: agent.planningStrategy,
    execution: agent.execution,
  });
}

export class AgentConfigurationValidationService {
  public validateAgent(agent: Agent): AgentConfigurationValidationResult {
    return this.validate(toAgentConfigurationValidationInput(agent), { mode: "update", existingAgentId: agent.id });
  }

  public assertValid(input: AgentConfigurationValidationInput): void {
    const validation = this.validate(input, { mode: "create" });
    if (!validation.valid) {
      throw new AgentConfigurationValidationError(validation.issues);
    }
  }

  public assertValidForCreate(input: AgentConfigurationValidationInput): void {
    const validation = this.validate(input, { mode: "create" });
    if (!validation.valid) {
      throw new AgentConfigurationValidationError(validation.issues);
    }
  }

  public assertValidForUpdate(existingAgentId: string, input: AgentConfigurationValidationInput): void {
    const validation = this.validate(input, { mode: "update", existingAgentId });
    if (!validation.valid) {
      throw new AgentConfigurationValidationError(validation.issues);
    }
  }

  public validate(
    input: AgentConfigurationValidationInput,
    options: AgentConfigurationValidationOptions = { mode: "create" },
  ): AgentConfigurationValidationResult {
    const issues: AgentConfigurationValidationIssue[] = [];
    const allowedToolIds = new Set(input.policy.toolAccess.allowedToolIds);
    const supportedRetrievalStrategies = new Set(["latest-first", "semantic-filter", "hybrid"]);
    const supportedRetentionModes = new Set(["disabled", "bounded"]);

    if (options.mode === "update" && options.existingAgentId && input.id !== options.existingAgentId) {
      issues.push({
        code: "agent-id-immutable",
        path: "id",
        message: "Agent id cannot be changed during update validation.",
        severity: "error",
        section: "agent",
      });
    }

    if (input.goals.length === 0) {
      issues.push({
        code: "goal-missing",
        path: "goals",
        message: "At least one goal is required.",
        severity: "error",
        section: "goals",
      });
    }

    const goalIds = input.goals.map((goal) => goal.id.trim()).filter(Boolean);
    if (goalIds.length !== input.goals.length) {
      issues.push({
        code: "goal-id-missing",
        path: "goals",
        message: "Every goal must define a non-empty id.",
        severity: "error",
        section: "goals",
      });
    }
    if (new Set(goalIds).size !== goalIds.length) {
      issues.push({
        code: "goal-id-duplicate",
        path: "goals",
        message: "Goal ids must be unique.",
        severity: "error",
        section: "goals",
      });
    }

    for (const goal of input.goals) {
      if (!goal.objective.trim()) {
        issues.push({
          code: "goal-objective-missing",
          path: `goals.${goal.id || "<unknown>"}.objective`,
          message: "Goal objective is required.",
          severity: "error",
          section: "goals",
        });
      }
      if (goal.successCriteria.length === 0) {
        issues.push({
          code: "goal-success-criteria-missing",
          path: `goals.${goal.id || "<unknown>"}.successCriteria`,
          message: "Goal successCriteria must include at least one value.",
          severity: "error",
          section: "goals",
        });
      }
      for (const requiredToolId of goal.requiredToolIds ?? []) {
        if (!isCanonicalAgentToolId(requiredToolId)) {
          issues.push({
            code: "goal-required-tool-malformed",
            path: `goals.${goal.id || "<unknown>"}.requiredToolIds`,
            message: `Goal required tool id '${requiredToolId}' is malformed.`,
            severity: "error",
            section: "goals",
          });
          continue;
        }
        if (!allowedToolIds.has(requiredToolId)) {
          issues.push({
            code: "goal-required-tool-not-allowed",
            path: `goals.${goal.id || "<unknown>"}.requiredToolIds`,
            message: `Goal requires tool '${requiredToolId}' that is not present in policy.toolAccess.allowedToolIds.`,
            severity: "error",
            section: "goals",
          });
        }
      }
    }

    const priorityOrders = input.goals.map((goal) => goal.priorityOrder);
    const uniqueOrderCount = new Set(priorityOrders).size;
    if (uniqueOrderCount !== priorityOrders.length) {
      issues.push({
        code: "goal-priority-order-duplicate",
        path: "goals",
        message: "Goal priorityOrder values must be unique.",
        severity: "error",
        section: "goals",
      });
    }
    const sortedPriority = [...priorityOrders].sort((left, right) => left - right);
    const contiguous = sortedPriority.every((value, index) => Number.isInteger(value) && value === index + 1);
    if (!contiguous) {
      issues.push({
        code: "goal-priority-order-noncontiguous",
        path: "goals",
        message: "Goal priorityOrder values must be contiguous and start at 1.",
        severity: "error",
        section: "goals",
      });
    }

    const malformedToolIds = input.policy.toolAccess.allowedToolIds.filter(
      (toolId) => !isCanonicalAgentToolId(toolId),
    );
    if (malformedToolIds.length > 0) {
      issues.push({
        code: "tool-id-malformed",
        path: "policy.toolAccess.allowedToolIds",
        message: `Malformed tool ids detected: ${malformedToolIds.join(", ")}.`,
        severity: "error",
        section: "tools",
      });
    }

    if (input.policy.toolAccess.allowedToolIds.length === 0) {
      issues.push({
        code: "tool-id-missing",
        path: "policy.toolAccess.allowedToolIds",
        message: "At least one allowed tool id is required.",
        severity: "error",
        section: "tools",
      });
    }

    if (input.policy.executionLimits.maxSteps !== undefined && input.goals.length > input.policy.executionLimits.maxSteps) {
      issues.push({
        code: "execution-limits-max-steps-too-low",
        path: "policy.executionLimits.maxSteps",
        message: "policy.executionLimits.maxSteps is lower than the number of configured goals.",
        severity: "error",
        section: "policy",
      });
    }

    if (input.execution.maxExecutionUnits !== undefined && input.goals.length > input.execution.maxExecutionUnits) {
      issues.push({
        code: "execution-max-units-too-low",
        path: "execution.maxExecutionUnits",
        message: "execution.maxExecutionUnits is lower than the number of configured goals.",
        severity: "error",
        section: "execution",
      });
    }
    if (
      input.execution.maxExecutionUnits !== undefined
      && input.policy.executionLimits.maxSteps !== undefined
      && input.execution.maxExecutionUnits > input.policy.executionLimits.maxSteps
    ) {
      issues.push({
        code: "execution-max-units-exceeds-policy-max-steps",
        path: "execution.maxExecutionUnits",
        message: "execution.maxExecutionUnits cannot exceed policy.executionLimits.maxSteps.",
        severity: "error",
        section: "execution",
      });
    }

    if (input.memory.agentId !== input.id) {
      issues.push({
        code: "memory-agent-id-mismatch",
        path: "memory.agentId",
        message: "memory.agentId must match the agent id.",
        severity: "error",
        section: "memory",
      });
    }
    const seenMemoryAssets = new Set<string>();
    for (let index = 0; index < input.memory.assets.length; index += 1) {
      const assetRef = input.memory.assets[index];
      const assetPath = `memory.assets.${index}`;
      const assetId = assetRef.assetId?.toString?.() ?? "";
      if (!assetId.startsWith("asset:")) {
        issues.push({
          code: "memory-asset-id-noncanonical",
          path: `${assetPath}.assetId`,
          message: `Memory asset id '${assetId}' must use canonical 'asset:' format.`,
          severity: "error",
          section: "memory",
        });
      }
      if (assetRef.assetVersionId !== undefined && !/^[a-zA-Z0-9:_-]+$/.test(assetRef.assetVersionId)) {
        issues.push({
          code: "memory-asset-version-id-malformed",
          path: `${assetPath}.assetVersionId`,
          message: `Memory asset version id '${assetRef.assetVersionId}' is malformed.`,
          severity: "error",
          section: "memory",
        });
      }
      const duplicateKey = `${assetId}|${assetRef.assetVersionId ?? "latest"}|${assetRef.memoryType}`;
      if (seenMemoryAssets.has(duplicateKey)) {
        issues.push({
          code: "memory-asset-reference-duplicate",
          path: assetPath,
          message: `Duplicate memory asset reference '${duplicateKey}' is not allowed.`,
          severity: "error",
          section: "memory",
        });
      }
      seenMemoryAssets.add(duplicateKey);
    }
    if (!supportedRetrievalStrategies.has(input.memory.retrieval.strategy)) {
      issues.push({
        code: "memory-retrieval-strategy-unsupported",
        path: "memory.retrieval.strategy",
        message: `Unsupported memory retrieval strategy '${input.memory.retrieval.strategy}'.`,
        severity: "error",
        section: "memory",
      });
    }
    if (input.memory.retrieval.maxEntries <= 0 || !Number.isInteger(input.memory.retrieval.maxEntries)) {
      issues.push({
        code: "memory-retrieval-max-entries-invalid",
        path: "memory.retrieval.maxEntries",
        message: "memory.retrieval.maxEntries must be a positive integer.",
        severity: "error",
        section: "memory",
      });
    }
    if (input.memory.retrieval.recency?.lookbackWindowEntries !== undefined) {
      if (
        !Number.isInteger(input.memory.retrieval.recency.lookbackWindowEntries)
        || input.memory.retrieval.recency.lookbackWindowEntries <= 0
      ) {
        issues.push({
          code: "memory-recency-lookback-invalid",
          path: "memory.retrieval.recency.lookbackWindowEntries",
          message: "memory.retrieval.recency.lookbackWindowEntries must be a positive integer when provided.",
          severity: "error",
          section: "memory",
        });
      }
    }
    if (input.memory.retrieval.semantic?.minRelevanceScore !== undefined) {
      const score = input.memory.retrieval.semantic.minRelevanceScore;
      if (!Number.isFinite(score) || score < 0 || score > 1) {
        issues.push({
          code: "memory-semantic-score-invalid",
          path: "memory.retrieval.semantic.minRelevanceScore",
          message: "memory.retrieval.semantic.minRelevanceScore must be a number between 0 and 1.",
          severity: "error",
          section: "memory",
        });
      }
    }

    if (input.memory.retrieval.strategy === "hybrid" && !input.memory.retrieval.semantic && !input.memory.retrieval.recency) {
      issues.push({
        code: "memory-hybrid-config-missing",
        path: "memory.retrieval",
        message: "Hybrid retrieval requires semantic or recency configuration.",
        severity: "error",
        section: "memory",
      });
    }
    if (input.memory.retrieval.strategy === "semantic-filter" && !input.memory.retrieval.semantic) {
      issues.push({
        code: "memory-semantic-config-missing",
        path: "memory.retrieval.semantic",
        message: "semantic-filter retrieval requires semantic configuration.",
        severity: "error",
        section: "memory",
      });
    }
    if (input.memory.retrieval.strategy === "latest-first" && input.memory.retrieval.semantic) {
      issues.push({
        code: "memory-latest-first-semantic-not-allowed",
        path: "memory.retrieval.semantic",
        message: "latest-first retrieval does not allow semantic configuration.",
        severity: "error",
        section: "memory",
      });
    }
    if (
      input.memory.retrieval.memoryTypes
      && input.memory.policy.retrievableTypes
      && input.memory.retrieval.memoryTypes.some((memoryType) => !input.memory.policy.retrievableTypes?.includes(memoryType))
    ) {
      issues.push({
        code: "memory-retrieval-types-not-retrievable",
        path: "memory.retrieval.memoryTypes",
        message: "memory.retrieval.memoryTypes must be a subset of memory.policy.retrievableTypes when retrievableTypes are configured.",
        severity: "error",
        section: "memory",
      });
    }
    if (
      input.memory.policy.maxRetrievalEntries !== undefined
      && input.memory.policy.maxRetrievalEntries > input.memory.retrieval.maxEntries
    ) {
      issues.push({
        code: "memory-policy-max-retrieval-exceeds-retrieval",
        path: "memory.policy.maxRetrievalEntries",
        message: "memory.policy.maxRetrievalEntries cannot exceed memory.retrieval.maxEntries.",
        severity: "error",
        section: "memory",
      });
    }
    if (!supportedRetentionModes.has(input.memory.policy.retention.mode)) {
      issues.push({
        code: "memory-retention-mode-unsupported",
        path: "memory.policy.retention.mode",
        message: `Unsupported memory retention mode '${input.memory.policy.retention.mode}'.`,
        severity: "error",
        section: "memory",
      });
    }
    if (
      input.memory.policy.retention.mode === "disabled"
      && input.memory.policy.retention.maxDurableEntries !== undefined
    ) {
      issues.push({
        code: "memory-retention-disabled-max-durable-not-allowed",
        path: "memory.policy.retention.maxDurableEntries",
        message: "maxDurableEntries is not allowed when memory retention mode is disabled.",
        severity: "error",
        section: "memory",
      });
    }
    if (
      input.memory.policy.sessionOnlyTypes
      && input.memory.policy.writableTypes
      && input.memory.policy.sessionOnlyTypes.some((memoryType) => !input.memory.policy.writableTypes?.includes(memoryType))
    ) {
      issues.push({
        code: "memory-session-only-not-writable",
        path: "memory.policy.sessionOnlyTypes",
        message: "sessionOnlyTypes must be a subset of writableTypes.",
        severity: "error",
        section: "memory",
      });
    }
    if (
      input.memory.policy.retrievableTypes
      && input.memory.policy.sessionOnlyTypes
      && input.memory.policy.retrievableTypes.some((memoryType) => input.memory.policy.sessionOnlyTypes?.includes(memoryType))
    ) {
      issues.push({
        code: "memory-retrievable-session-only-overlap",
        path: "memory.policy.retrievableTypes",
        message: "retrievableTypes cannot include sessionOnlyTypes.",
        severity: "error",
        section: "memory",
      });
    }
    if (
      input.memory.retrieval.memoryTypes
      && input.memory.policy.sessionOnlyTypes
      && input.memory.retrieval.memoryTypes.some((memoryType) => input.memory.policy.sessionOnlyTypes?.includes(memoryType))
    ) {
      issues.push({
        code: "memory-retrieval-session-only-overlap",
        path: "memory.retrieval.memoryTypes",
        message: "retrieval.memoryTypes cannot include sessionOnlyTypes.",
        severity: "error",
        section: "memory",
      });
    }
    const durableWritableTypes = (input.memory.policy.writableTypes ?? [])
      .filter((memoryType) => !(input.memory.policy.sessionOnlyTypes ?? []).includes(memoryType));
    if (durableWritableTypes.length > 0 && input.memory.assets.length === 0) {
      issues.push({
        code: "memory-durable-types-require-assets",
        path: "memory.assets",
        message: "At least one asset reference is required when durable writable memory types are configured.",
        severity: "error",
        section: "memory",
      });
    }
    if (input.memory.policy.retention.mode === "bounded" && durableWritableTypes.length === 0) {
      issues.push({
        code: "memory-bounded-retention-requires-durable-types",
        path: "memory.policy.retention",
        message: "Bounded retention requires at least one durable writable memory type.",
        severity: "error",
        section: "memory",
      });
    }

    const strategySupported = SupportedAgentPlanningStrategies.some(
      (strategy) => strategy.strategyId === input.planningStrategy.strategyId.toLowerCase()
        && strategy.mode === input.planningStrategy.mode,
    );
    if (!input.planningStrategy.strategyId.trim()) {
      issues.push({
        code: "strategy-id-missing",
        path: "planningStrategy.strategyId",
        message: "planningStrategy.strategyId is required.",
        severity: "error",
        section: "strategy",
      });
    }
    if (!strategySupported) {
      issues.push({
        code: "strategy-unsupported",
        path: "planningStrategy",
        message: `Unsupported strategy '${input.planningStrategy.strategyId}@${input.planningStrategy.mode}'.`,
        severity: "error",
        section: "strategy",
      });
    }
    if (input.planningStrategy.mode !== AgentPlanningStrategyModes.deterministicLinear) {
      issues.push({
        code: "strategy-mode-unsupported",
        path: "planningStrategy.mode",
        message: "Only deterministic-linear strategy mode is supported.",
        severity: "error",
        section: "strategy",
      });
    }
    if (
      input.planningStrategy.strategyId.trim().toLowerCase() === "deterministic"
      && input.planningStrategy.mode !== AgentPlanningStrategyModes.deterministicLinear
    ) {
      issues.push({
        code: "strategy-deterministic-mode-mismatch",
        path: "planningStrategy",
        message: "deterministic strategy id only supports deterministic-linear mode.",
        severity: "error",
        section: "strategy",
      });
    }

    const deniedPermissions = new Set(input.policy.safetyConstraints.deniedPermissionIds);
    const requiredApprovals = input.policy.safetyConstraints.requiredApprovals;
    const sandbox = input.policy.safetyConstraints.sandbox;
    const requiredApprovalPermissionIds = new Set(requiredApprovals.map((approval) => approval.permissionId));

    if (!sandbox.network.allowed && deniedPermissions.has("network.access")) {
      issues.push({
        code: "policy-network-denial-redundant",
        path: "policy.safetyConstraints.deniedPermissionIds",
        message: "network.access should not be denied redundantly when sandbox.network.allowed is false.",
        severity: "error",
        section: "policy",
      });
    }
    if (!sandbox.network.allowed && requiredApprovalPermissionIds.has("network.access")) {
      issues.push({
        code: "policy-network-approval-sandbox-conflict",
        path: "policy.safetyConstraints.requiredApprovals",
        message: "network.access approval requirement conflicts with sandbox.network.allowed=false.",
        severity: "error",
        section: "policy",
      });
    }
    if (
      !sandbox.filesystem.allowed
      && [...requiredApprovalPermissionIds].some((permissionId) => permissionId.startsWith("filesystem."))
    ) {
      issues.push({
        code: "policy-filesystem-approval-sandbox-conflict",
        path: "policy.safetyConstraints.requiredApprovals",
        message: "filesystem approval requirements conflict with sandbox.filesystem.allowed=false.",
        severity: "error",
        section: "policy",
      });
    }
    if (!sandbox.assets.read && requiredApprovalPermissionIds.has("asset.read")) {
      issues.push({
        code: "policy-asset-read-approval-sandbox-conflict",
        path: "policy.safetyConstraints.requiredApprovals",
        message: "asset.read approval requirement conflicts with sandbox.assets.read=false.",
        severity: "error",
        section: "policy",
      });
    }
    if (!sandbox.assets.write && requiredApprovalPermissionIds.has("asset.write")) {
      issues.push({
        code: "policy-asset-write-approval-sandbox-conflict",
        path: "policy.safetyConstraints.requiredApprovals",
        message: "asset.write approval requirement conflicts with sandbox.assets.write=false.",
        severity: "error",
        section: "policy",
      });
    }

    for (const deniedPermissionId of deniedPermissions) {
      if (requiredApprovalPermissionIds.has(deniedPermissionId)) {
        issues.push({
          code: "policy-permission-required-and-denied",
          path: "policy.safetyConstraints",
          message: `Permission '${deniedPermissionId}' cannot be both required and denied.`,
          severity: "error",
          section: "policy",
        });
      }
    }

    for (const approval of requiredApprovals) {
      if (approval.scopeType === "tool" && !approval.scopeId) {
        issues.push({
          code: "policy-tool-scope-approval-missing-scope-id",
          path: "policy.safetyConstraints.requiredApprovals",
          message: `Approval '${approval.permissionId}' with tool scope requires scopeId.`,
          severity: "error",
          section: "policy",
        });
      }
      if (approval.scopeType === "tool" && approval.scopeId && !allowedToolIds.has(approval.scopeId)) {
        issues.push({
          code: "policy-tool-scope-approval-tool-not-allowed",
          path: "policy.safetyConstraints.requiredApprovals",
          message: `Approval scope tool '${approval.scopeId}' must exist in policy.toolAccess.allowedToolIds.`,
          severity: "error",
          section: "policy",
        });
      }
      if (approval.scopeType !== "tool" && approval.scopeId) {
        issues.push({
          code: "policy-non-tool-scope-id-not-allowed",
          path: "policy.safetyConstraints.requiredApprovals",
          message: "scopeId is only allowed when approval scopeType is tool.",
          severity: "error",
          section: "policy",
        });
      }
    }

    try {
      createAgent({
        id: input.id,
        name: input.name,
        description: input.description,
        goals: input.goals,
        policy: input.policy,
        memory: input.memory,
        planningStrategy: input.planningStrategy,
        execution: input.execution,
      });
    } catch (error) {
      issues.push({
        code: "agent-configuration-invalid",
        path: "agent",
        message: error instanceof Error ? error.message : "Agent configuration is invalid.",
        severity: "error",
        section: "agent",
      });
    }

    const hasError = issues.some((issue) => issue.severity === "error");
    return Object.freeze({
      valid: !hasError,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    });
  }
}

