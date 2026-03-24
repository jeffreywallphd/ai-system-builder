import { ExecutionPlan, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
import type { AgentExecutionSession } from "../../../domain/agents/AgentExecutionSession";

export interface AgentPlanStepMappingInput {
  readonly stepId: string;
  readonly toolId: string;
  readonly objective: string;
  readonly dependsOnStepIds?: ReadonlyArray<string>;
}

export interface AgentExecutionBackboneMappingInput {
  readonly session: AgentExecutionSession;
  readonly steps: ReadonlyArray<AgentPlanStepMappingInput>;
}

export function mapAgentExecutionToExecutionPlan(input: AgentExecutionBackboneMappingInput): ExecutionPlan {
  const planId = input.session.planId?.trim() || `agent-plan:${input.session.id}`;
  return new ExecutionPlan({
    id: planId,
    units: input.steps.map((step) => ({
      id: step.stepId,
      kind: ExecutionUnitKinds.agentToolStep,
      label: step.objective,
      dependsOn: step.dependsOnStepIds,
    })),
  });
}

export interface AgentExecutionUnitPayload {
  readonly sessionId: string;
  readonly agentId: string;
  readonly planId: string;
  readonly stepId: string;
  readonly toolId: string;
  readonly objective: string;
}

export function buildAgentExecutionUnitPayload(input: {
  readonly session: AgentExecutionSession;
  readonly step: AgentPlanStepMappingInput;
}): AgentExecutionUnitPayload {
  const planId = input.session.planId?.trim() || `agent-plan:${input.session.id}`;
  return Object.freeze({
    sessionId: input.session.id,
    agentId: input.session.agentId,
    planId,
    stepId: input.step.stepId,
    toolId: input.step.toolId,
    objective: input.step.objective,
  });
}
