import type { Agent } from "@domain/agents/Agent";

export interface IAgentRepository {
  save(agent: Agent): Promise<Agent>;
  get(id: string): Promise<Agent | undefined>;
  list(): Promise<ReadonlyArray<Agent>>;
  delete(id: string): Promise<boolean>;
}

