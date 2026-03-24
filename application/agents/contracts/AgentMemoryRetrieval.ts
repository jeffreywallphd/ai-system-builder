import type { Agent } from "../../../domain/agents/Agent";
import type { AgentMemoryEntryReference, AgentMemoryType } from "../../../domain/agents/AgentMemory";

export interface AgentMemoryRetrievalRequest {
  readonly agent: Agent;
  readonly query?: string;
  readonly memoryTypes?: ReadonlyArray<AgentMemoryType>;
  readonly tags?: ReadonlyArray<string>;
  readonly maxEntries?: number;
  readonly beforeTimestamp?: string;
}

export interface AgentMemoryRetrievalService {
  retrieveMemory(request: AgentMemoryRetrievalRequest): Promise<ReadonlyArray<AgentMemoryEntryReference>>;
}
