export interface AgentMemoryEntryReference {
  readonly assetId: string;
  readonly assetVersionId?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AgentMemoryQuery {
  readonly assetIds?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
  readonly maxEntries?: number;
}

export interface AgentMemoryStore {
  add(agentId: string, entry: AgentMemoryEntryReference): Promise<void>;
  query(agentId: string, criteria: AgentMemoryQuery): Promise<ReadonlyArray<AgentMemoryEntryReference>>;
}
