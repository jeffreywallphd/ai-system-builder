import { ExecutionPlan, ExecutionUnitKinds, type IExecutionUnitDefinition } from "../../../domain/execution/ExecutionPlan";
import type { AgentExecutionSession } from "../../../domain/agents/AgentExecutionSession";
import { AssetId } from "../../../domain/assets/AssetId";
import type { AgentPlan, AgentPlanStep } from "../../../domain/agents/AgentPlan";
import { isMcpToolId, parseMcpToolId } from "../../../domain/mcp/McpToolIdentity";

export interface AgentPlanStepOutputReference {
  readonly stepId: string;
  readonly outputKey: string;
}

export interface AgentPlanStepMappingInput {
  readonly stepId: string;
  readonly goalId?: string;
  readonly toolId: string;
  readonly intent: {
    readonly action: string;
    readonly inputAssetIds?: ReadonlyArray<AssetId>;
    readonly inputStepOutputs?: ReadonlyArray<AgentPlanStepOutputReference>;
    readonly expectedOutputKey?: string;
    readonly mcpInvocation?: {
      readonly structuredInput?: Readonly<Record<string, unknown>>;
      readonly expectedOutputSchema?: Readonly<Record<string, unknown>>;
      readonly authContextRef?: string;
    };
  };
  readonly dependsOnStepIds?: ReadonlyArray<string>;
}

export interface AgentExecutionBackboneMappingInput {
  readonly session: AgentExecutionSession;
  readonly steps: ReadonlyArray<AgentPlanStepMappingInput>;
}

export interface AgentExecutionUnitPayload {
  readonly sessionId: string;
  readonly agentId: string;
  readonly planId: string;
  readonly stepId: string;
  readonly goalId?: string;
  readonly toolId: string;
  readonly action: string;
  readonly inputAssetIds: ReadonlyArray<AssetId>;
  readonly inputStepOutputs: ReadonlyArray<AgentPlanStepOutputReference>;
  readonly expectedOutputKey?: string;
  readonly mcpInvocation?: {
    readonly toolId: string;
    readonly serverId: string;
    readonly toolName: string;
    readonly structuredInput?: Readonly<Record<string, unknown>>;
    readonly expectedOutputSchema?: Readonly<Record<string, unknown>>;
    readonly authContextRef?: string;
  };
}

export interface AgentExecutionBackboneMapping {
  readonly plan: ExecutionPlan;
  readonly unitPayloadByUnitId: Readonly<Record<string, AgentExecutionUnitPayload>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function resolvePlanId(session: AgentExecutionSession): string {
  return session.executionPlan?.planId.trim() || `agent-plan:${session.id}`;
}

function normalizeExpectedOutputKey(value: string | undefined): string | undefined {
  const normalized = value?.trim() || undefined;
  if (!normalized) {
    return undefined;
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(normalized)) {
    throw new Error(`Agent plan step expectedOutputKey '${normalized}' is malformed.`);
  }
  return normalized;
}

function normalizeStepOutputReference(reference: AgentPlanStepOutputReference): AgentPlanStepOutputReference {
  return Object.freeze({
    stepId: normalizeRequired(reference.stepId, "Agent plan step-output reference stepId"),
    outputKey: normalizeRequired(normalizeExpectedOutputKey(reference.outputKey) ?? "", "Agent plan step-output reference outputKey"),
  });
}

function normalizeStep(step: AgentPlanStepMappingInput): AgentPlanStepMappingInput {
  return Object.freeze({
    stepId: normalizeRequired(step.stepId, "Agent plan step id"),
    goalId: step.goalId?.trim() || undefined,
    toolId: normalizeRequired(step.toolId, "Agent plan step toolId"),
    intent: Object.freeze({
      action: normalizeRequired(step.intent?.action ?? "", "Agent plan step action"),
      inputAssetIds: Object.freeze((step.intent?.inputAssetIds ?? []).map((assetId) => {
        const normalizedAssetId = AssetId.from(assetId);
        if (!normalizedAssetId.toString().startsWith("asset:")) {
          throw new Error(`Agent plan step inputAssetId '${normalizedAssetId.toString()}' must use canonical asset id format.`);
        }
        return normalizedAssetId;
      })),
      inputStepOutputs: Object.freeze((step.intent?.inputStepOutputs ?? []).map((reference) => normalizeStepOutputReference(reference))),
      expectedOutputKey: normalizeExpectedOutputKey(step.intent?.expectedOutputKey),
      mcpInvocation: step.intent?.mcpInvocation
        ? Object.freeze({
            structuredInput: cloneSchemaRecord(step.intent.mcpInvocation.structuredInput),
            expectedOutputSchema: cloneSchemaRecord(step.intent.mcpInvocation.expectedOutputSchema),
            authContextRef: step.intent.mcpInvocation.authContextRef?.trim() || undefined,
          })
        : undefined,
    }),
    dependsOnStepIds: Object.freeze(
      [...new Set((step.dependsOnStepIds ?? []).map((dependency) => normalizeRequired(dependency, "Agent plan dependency id")))],
    ),
  });
}

function cloneSchemaRecord(value: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.freeze(JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

function validateDependencies(steps: ReadonlyArray<AgentPlanStepMappingInput>): void {
  const stepIdSet = new Set(steps.map((step) => step.stepId));
  if (stepIdSet.size !== steps.length) {
    throw new Error("Agent execution mapping steps must use unique step ids.");
  }

  for (const step of steps) {
    if ((step.dependsOnStepIds ?? []).includes(step.stepId)) {
      throw new Error(`Agent execution mapping step '${step.stepId}' cannot depend on itself.`);
    }
    for (const dependencyId of step.dependsOnStepIds ?? []) {
      if (!stepIdSet.has(dependencyId)) {
        throw new Error(`Agent execution mapping step '${step.stepId}' depends on unknown step '${dependencyId}'.`);
      }
    }

    for (const inputReference of step.intent.inputStepOutputs ?? []) {
      if (!stepIdSet.has(inputReference.stepId)) {
        throw new Error(`Agent execution mapping step '${step.stepId}' references unknown step output '${inputReference.stepId}'.`);
      }
      if (!(step.dependsOnStepIds ?? []).includes(inputReference.stepId)) {
        throw new Error(`Agent execution mapping step '${step.stepId}' must depend on '${inputReference.stepId}' when consuming its output.`);
      }
    }
  }

  const dependencyGraph = new Map(steps.map((step) => [step.stepId, step.dependsOnStepIds ?? []] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (stepId: string): void => {
    if (visited.has(stepId)) {
      return;
    }
    if (visiting.has(stepId)) {
      throw new Error(`Agent execution mapping step '${stepId}' participates in a dependency cycle.`);
    }
    visiting.add(stepId);
    for (const dependencyId of dependencyGraph.get(stepId) ?? []) {
      visit(dependencyId);
    }
    visiting.delete(stepId);
    visited.add(stepId);
  };
  for (const step of steps) {
    visit(step.stepId);
  }
}

function validateResultWiring(steps: ReadonlyArray<AgentPlanStepMappingInput>): void {
  const seenOutputKeys = new Set<string>();
  const stepById = new Map(steps.map((step) => [step.stepId, step] as const));
  for (const step of steps) {
    const outputKey = step.intent.expectedOutputKey;
    if (outputKey) {
      if (seenOutputKeys.has(outputKey)) {
        throw new Error(`Agent execution mapping expectedOutputKey '${outputKey}' must be unique across steps.`);
      }
      seenOutputKeys.add(outputKey);
    }

    for (const reference of step.intent.inputStepOutputs ?? []) {
      const referencedStep = stepById.get(reference.stepId);
      if (!referencedStep) {
        throw new Error(`Agent execution mapping step '${step.stepId}' references unknown step output '${reference.stepId}'.`);
      }
      const referencedOutputKey = referencedStep.intent.expectedOutputKey;
      if (referencedOutputKey && reference.outputKey !== referencedOutputKey) {
        throw new Error(
          `Agent execution mapping step '${step.stepId}' references outputKey '${reference.outputKey}' from '${reference.stepId}', but that step declares expectedOutputKey '${referencedOutputKey}'.`,
        );
      }
    }
  }
}

function toMappingStep(step: AgentPlanStep): AgentPlanStepMappingInput {
  return Object.freeze({
    stepId: step.stepId,
    goalId: step.goalId,
    toolId: step.toolId,
    dependsOnStepIds: step.dependsOnStepIds,
    intent: Object.freeze({
      action: step.intent.action,
      expectedOutputKey: step.intent.expectedOutputKey,
      mcpInvocation: step.intent.toolInvocation?.kind === "mcp"
        ? Object.freeze({
            structuredInput: step.intent.toolInvocation.structuredInput,
            expectedOutputSchema: step.intent.toolInvocation.expectedOutputSchema,
            authContextRef: step.intent.toolInvocation.authContextRef,
          })
        : undefined,
      inputAssetIds: Object.freeze(
        step.intent.inputReferences
          .filter((reference) => reference.kind === "asset")
          .map((reference) => reference.assetId),
      ),
      inputStepOutputs: Object.freeze(
        step.intent.inputReferences
          .filter((reference) => reference.kind === "step-output")
          .map((reference) => Object.freeze({ stepId: reference.stepId, outputKey: reference.outputKey })),
      ),
    }),
  });
}

export function mapAgentPlanToBackbone(input: {
  readonly session: AgentExecutionSession;
  readonly plan: AgentPlan;
}): AgentExecutionBackboneMapping {
  const sessionPlanId = input.session.executionPlan?.planId;
  if (sessionPlanId && sessionPlanId !== input.plan.planId) {
    throw new Error(`Agent execution session planId '${sessionPlanId}' must match agent plan '${input.plan.planId}'.`);
  }
  if (input.plan.agentId !== input.session.agentId) {
    throw new Error(`Agent execution plan agentId '${input.plan.agentId}' must match session agentId '${input.session.agentId}'.`);
  }

  return mapAgentExecutionToBackbone({
    session: input.session,
    steps: input.plan.steps.map((step) => toMappingStep(step)),
  });
}

export function mapAgentExecutionToExecutionPlan(input: AgentExecutionBackboneMappingInput): ExecutionPlan {
  return mapAgentExecutionToBackbone(input).plan;
}

export function buildAgentExecutionUnitPayload(input: {
  readonly session: AgentExecutionSession;
  readonly step: AgentPlanStepMappingInput;
}): AgentExecutionUnitPayload {
  const planId = resolvePlanId(input.session);
  const normalizedStep = normalizeStep(input.step);
  return Object.freeze({
    sessionId: normalizeRequired(input.session.id, "Agent execution session id"),
    agentId: normalizeRequired(input.session.agentId, "Agent execution session agentId"),
    planId,
    stepId: normalizedStep.stepId,
    goalId: normalizedStep.goalId,
    toolId: normalizedStep.toolId,
    action: normalizedStep.intent.action,
    inputAssetIds: normalizedStep.intent.inputAssetIds ?? [],
    inputStepOutputs: normalizedStep.intent.inputStepOutputs ?? [],
    expectedOutputKey: normalizedStep.intent.expectedOutputKey,
    mcpInvocation: resolveMcpInvocationPayload(normalizedStep),
  });
}

function resolveMcpInvocationPayload(step: AgentPlanStepMappingInput): AgentExecutionUnitPayload["mcpInvocation"] {
  if (!isMcpToolId(step.toolId)) {
    return undefined;
  }
  const identity = parseMcpToolId(step.toolId);
  return Object.freeze({
    toolId: identity.toolId,
    serverId: identity.serverId,
    toolName: identity.toolName,
    structuredInput: cloneSchemaRecord(step.intent.mcpInvocation?.structuredInput),
    expectedOutputSchema: cloneSchemaRecord(step.intent.mcpInvocation?.expectedOutputSchema),
    authContextRef: step.intent.mcpInvocation?.authContextRef?.trim() || undefined,
  });
}

export function mapAgentExecutionToBackbone(input: AgentExecutionBackboneMappingInput): AgentExecutionBackboneMapping {
  if ((input.steps?.length ?? 0) === 0) {
    throw new Error("Agent execution mapping requires at least one step.");
  }

  const planId = resolvePlanId(input.session);
  const normalizedSteps = input.steps.map((step) => normalizeStep(step));
  validateDependencies(normalizedSteps);
  validateResultWiring(normalizedSteps);

  const units: IExecutionUnitDefinition[] = normalizedSteps.map((step) => ({
    id: step.stepId,
    kind: isMcpToolId(step.toolId) ? ExecutionUnitKinds.mcpToolInvocation : ExecutionUnitKinds.agentToolStep,
    label: step.intent.action,
    dependsOn: step.dependsOnStepIds,
  }));

  const plan = new ExecutionPlan({
    id: planId,
    units,
  });

  const payloadEntries = normalizedSteps.map((step) => [
    step.stepId,
    buildAgentExecutionUnitPayload({ session: input.session, step }),
  ] as const);

  return Object.freeze({
    plan,
    unitPayloadByUnitId: Object.freeze(Object.fromEntries(payloadEntries)),
  });
}
