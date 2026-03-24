import { createAgent, updateAgent, type Agent, type AgentGoal, type AgentMemoryConfig, type AgentPlanningStrategyReference, type AgentToolReference } from "../../../domain/agents/Agent";
import type { IAgentRepository } from "../../ports/interfaces/IAgentRepository";

export class AgentService {
  constructor(private readonly repository: IAgentRepository) {}

  public async createAgent(input: {
    readonly id: string;
    readonly goals: ReadonlyArray<AgentGoal>;
    readonly allowedTools: ReadonlyArray<AgentToolReference>;
    readonly memoryConfig: AgentMemoryConfig;
    readonly planningStrategy: AgentPlanningStrategyReference;
  }): Promise<Agent> {
    const existing = await this.repository.get(input.id.trim());
    if (existing) {
      throw new Error(`Agent '${input.id}' already exists.`);
    }
    const created = createAgent(input);
    return this.repository.save(created);
  }

  public async updateAgent(id: string, changes: {
    readonly goals?: ReadonlyArray<AgentGoal>;
    readonly allowedTools?: ReadonlyArray<AgentToolReference>;
    readonly memoryConfig?: AgentMemoryConfig;
    readonly planningStrategy?: AgentPlanningStrategyReference;
  }): Promise<Agent> {
    const current = await this.repository.get(id.trim());
    if (!current) {
      throw new Error(`Agent '${id}' was not found.`);
    }
    const updated = updateAgent(current, changes);
    return this.repository.save(updated);
  }

  public async getAgent(id: string): Promise<Agent | undefined> {
    return this.repository.get(id.trim());
  }

  public async listAgents(): Promise<ReadonlyArray<Agent>> {
    return this.repository.list();
  }
}
