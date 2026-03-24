import {
  createAgent,
  toAgentReadModel,
  updateAgent,
  type Agent,
  type AgentExecutionPolicy,
  type AgentGoal,
  type AgentMemoryConfig,
  type AgentPlanningStrategyReference,
  type AgentReadModel,
  type AgentToolReference,
} from "../../../domain/agents/Agent";
import type { IAgentRepository } from "../../ports/interfaces/IAgentRepository";

export class AgentService {
  constructor(private readonly repository: IAgentRepository) {}

  public async createAgent(input: {
    readonly id: string;
    readonly name: string;
    readonly goals: ReadonlyArray<AgentGoal>;
    readonly allowedTools: ReadonlyArray<AgentToolReference>;
    readonly memoryConfig: AgentMemoryConfig;
    readonly planningStrategy: AgentPlanningStrategyReference;
    readonly executionPolicy?: AgentExecutionPolicy;
  }): Promise<Agent> {
    const existing = await this.repository.get(input.id.trim());
    if (existing) {
      throw new Error(`Agent '${input.id}' already exists.`);
    }
    const created = createAgent(input);
    return this.repository.save(created);
  }

  public async updateAgent(
    id: string,
    changes: {
      readonly name?: string;
      readonly goals?: ReadonlyArray<AgentGoal>;
      readonly allowedTools?: ReadonlyArray<AgentToolReference>;
      readonly memoryConfig?: AgentMemoryConfig;
      readonly planningStrategy?: AgentPlanningStrategyReference;
      readonly executionPolicy?: AgentExecutionPolicy;
      readonly status?: Agent["status"];
    },
  ): Promise<Agent> {
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

  public async getAgentReadModel(id: string): Promise<AgentReadModel | undefined> {
    const agent = await this.repository.get(id.trim());
    return agent ? toAgentReadModel(agent) : undefined;
  }

  public async listAgents(): Promise<ReadonlyArray<Agent>> {
    return this.repository.list();
  }

  public async listAgentReadModels(): Promise<ReadonlyArray<AgentReadModel>> {
    const agents = await this.repository.list();
    return Object.freeze(agents.map((agent) => toAgentReadModel(agent)));
  }
}
