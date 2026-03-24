import { createAgentWorkingMemory, updateAgentWorkingMemory, type AgentWorkingMemory } from "../../../domain/agents/AgentWorkingMemory";
import type { Agent } from "../../../domain/agents/Agent";
import type { AgentPlan } from "../../../domain/agents/AgentPlan";
import type { AgentMemoryEntryReference } from "../../../domain/agents/AgentMemory";
import type { AgentExecutionReadModel } from "./AgentExecutionService";

function planAssetReferences(plan: AgentPlan): ReadonlyArray<AgentMemoryEntryReference["assetId"]> {
  const refs: AgentMemoryEntryReference["assetId"][] = [];
  for (const step of plan.steps) {
    for (const reference of step.intent.inputReferences) {
      if (reference.kind === "asset") {
        refs.push(reference.assetId);
      }
    }
  }
  return Object.freeze(refs);
}

export class AgentWorkingMemoryService {
  public createFromRetrievedMemory(input: {
    readonly agent: Agent;
    readonly sessionId: string;
    readonly plan?: AgentPlan;
    readonly retrievedMemory: ReadonlyArray<AgentMemoryEntryReference>;
  }): AgentWorkingMemory {
    const maxEntries = input.agent.memory.policy.maxRetrievalEntries ?? input.agent.memory.retrieval.maxEntries;
    return createAgentWorkingMemory({
      sessionId: input.sessionId,
      agentId: input.agent.id,
      planId: input.plan?.planId,
      retrievedMemory: input.retrievedMemory,
      planAssetReferences: input.plan ? planAssetReferences(input.plan) : undefined,
      maxEntries,
    });
  }

  public appendExecutionOutcome(
    state: AgentWorkingMemory,
    execution: AgentExecutionReadModel,
  ): AgentWorkingMemory {
    return updateAgentWorkingMemory(state, {
      appendExecutionOutputs: execution.outcomes.map((outcome) => Object.freeze({
        stepId: outcome.stepId,
        status: outcome.status,
        summary: outcome.output ?? outcome.errorMessage,
      })),
    });
  }
}
