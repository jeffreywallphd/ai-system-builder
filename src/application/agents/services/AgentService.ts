import {
  createAgent,
  toAgentReadModel,
  updateAgent,
  type Agent,
  type AgentExecutionConfiguration,
  type AgentPlanningStrategy,
  type AgentReadModel,
} from "@domain/agents/Agent";
import type { AgentGoal } from "@domain/agents/AgentGoal";
import type { AgentPolicy } from "@domain/agents/AgentPolicy";
import type { AgentMemoryConfiguration } from "@domain/agents/AgentMemory";
import type { IAgentRepository } from "../../ports/interfaces/IAgentRepository";

export class AgentService {
  constructor(private readonly repository: IAgentRepository) {}

  public async createAgent(input: {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly goals: ReadonlyArray<AgentGoal>;
    readonly policy: AgentPolicy;
    readonly planningStrategy: AgentPlanningStrategy;
    readonly memory: AgentMemoryConfiguration;
    readonly execution: AgentExecutionConfiguration;
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
      readonly description?: string;
      readonly goals?: ReadonlyArray<AgentGoal>;
      readonly policy?: AgentPolicy;
      readonly memory?: AgentMemoryConfiguration;
      readonly planningStrategy?: AgentPlanningStrategy;
      readonly execution?: AgentExecutionConfiguration;
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

  public async archiveAgent(id: string): Promise<Agent> {
    return this.updateAgent(id, { status: "archived" });
  }

  public async deleteAgent(id: string): Promise<boolean> {
    return this.repository.delete(id.trim());
  }
}

