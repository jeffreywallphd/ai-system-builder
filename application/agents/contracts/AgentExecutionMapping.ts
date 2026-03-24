import { ExecutionPlan, ExecutionUnitKinds, type IExecutionUnitDefinition } from "../../../domain/execution/ExecutionPlan";
import type { AgentExecutionSession } from "../../../domain/agents/AgentExecutionSession";

export interface AgentPlanStepMappingInput {
  readonly stepId: string;
  readonly goalId?: string;
  readonly toolId: string;
  readonly objective: string;
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
  readonly objective: string;
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
  return session.planId?.trim() || `agent-plan:${session.id}`;
}

function normalizeStep(step: AgentPlanStepMappingInput): AgentPlanStepMappingInput {
  return Object.freeze({
    stepId: normalizeRequired(step.stepId, "Agent plan step id"),
    goalId: step.goalId?.trim() || undefined,
    toolId: normalizeRequired(step.toolId, "Agent plan step toolId"),
    objective: normalizeRequired(step.objective, "Agent plan step objective"),
    dependsOnStepIds: Object.freeze((step.dependsOnStepIds ?? []).map((dependency) => normalizeRequired(dependency, "Agent plan dependency id"))),
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
    objective: normalizedStep.objective,
  });
}

export function mapAgentExecutionToBackbone(input: AgentExecutionBackboneMappingInput): AgentExecutionBackboneMapping {
  if ((input.steps?.length ?? 0) === 0) {
    throw new Error("Agent execution mapping requires at least one step.");
  }

  const planId = resolvePlanId(input.session);
  const normalizedSteps = input.steps.map((step) => normalizeStep(step));

  const units: IExecutionUnitDefinition[] = normalizedSteps.map((step) => ({
    id: step.stepId,
    kind: ExecutionUnitKinds.agentToolStep,
    label: step.objective,
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
