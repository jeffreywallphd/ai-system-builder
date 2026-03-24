import type { AgentMemoryEntryReference, AgentMemoryStore, AgentMemoryType } from "../../../domain/agents/AgentMemory";
import type { AgentMemoryRetrievalRequest, AgentMemoryRetrievalService } from "../contracts/AgentMemoryRetrieval";

function normalizeList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  return Object.freeze([...(values ?? [])].map((value) => value.trim()).filter(Boolean));
}

function resolveRequestedTypes(request: AgentMemoryRetrievalRequest): ReadonlyArray<AgentMemoryType> | undefined {
  const requested = request.memoryTypes ?? request.agent.memory.retrieval.memoryTypes;
  const retrievable = request.agent.memory.policy.retrievableTypes;
  if (!retrievable || retrievable.length === 0) {
    return requested;
  }

  if (!requested || requested.length === 0) {
    return retrievable;
  }

  const allowed = new Set(retrievable);
  return Object.freeze(requested.filter((type) => allowed.has(type)));
}

export class DefaultAgentMemoryRetrievalService implements AgentMemoryRetrievalService {
  constructor(private readonly memoryStore: AgentMemoryStore) {}

  public async retrieveMemory(request: AgentMemoryRetrievalRequest): Promise<ReadonlyArray<AgentMemoryEntryReference>> {
    const assetIds = request.agent.memory.assets.map((entry) => entry.assetId);
    const memoryTypes = resolveRequestedTypes(request);
    const requestedLimit = request.maxEntries ?? request.agent.memory.retrieval.maxEntries;
    const policyLimit = request.agent.memory.policy.maxRetrievalEntries;
    const maxEntries = Math.max(1, Math.min(requestedLimit, policyLimit ?? requestedLimit));

    const requestedTags = normalizeList(request.tags);
    const configuredTags = normalizeList(request.agent.memory.retrieval.requiredTags);
    const tags = requestedTags.length > 0 ? requestedTags : configuredTags;

    return this.memoryStore.query(request.agent.id, {
      assetIds,
      memoryTypes,
      tags,
      maxEntries,
      beforeTimestamp: request.beforeTimestamp,
    });
  }
}
