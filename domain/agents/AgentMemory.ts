import { AssetId } from "../assets/AssetId";

export const AgentMemoryTypes = Object.freeze({
  episodic: "episodic",
  semantic: "semantic",
  working: "working",
});

export type AgentMemoryType = typeof AgentMemoryTypes[keyof typeof AgentMemoryTypes];

export interface AgentMemoryAssetRef {
  readonly assetId: AssetId;
  readonly assetVersionId?: string;
  readonly memoryType: AgentMemoryType;
  readonly lineageTag?: string;
}

export interface AgentMemoryRetrievalConfig {
  readonly strategy: "latest-first" | "semantic-filter" | "hybrid";
  readonly maxEntries: number;
  readonly requiredTags?: ReadonlyArray<string>;
}

export interface AgentMemoryConfiguration {
  readonly agentId: string;
  readonly assets: ReadonlyArray<AgentMemoryAssetRef>;
  readonly retrieval: AgentMemoryRetrievalConfig;
  readonly revision: number;
}

export interface AgentMemoryEntryReference {
  readonly assetId: string;
  readonly assetVersionId?: string;
  readonly memoryType?: AgentMemoryType;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AgentMemoryQuery {
  readonly assetIds?: ReadonlyArray<string>;
  readonly memoryTypes?: ReadonlyArray<AgentMemoryType>;
  readonly tags?: ReadonlyArray<string>;
  readonly maxEntries?: number;
}

export interface AgentMemoryStore {
  add(agentId: string, entry: AgentMemoryEntryReference): Promise<void>;
  query(agentId: string, criteria: AgentMemoryQuery): Promise<ReadonlyArray<AgentMemoryEntryReference>>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  return Object.freeze((values ?? []).map((value) => value.trim()).filter(Boolean));
}

export function normalizeAgentMemoryConfiguration(config: AgentMemoryConfiguration): AgentMemoryConfiguration {
  const agentId = normalizeRequired(config.agentId, "Agent memory configuration agentId");
  const assets = Object.freeze((config.assets ?? []).map((entry) => Object.freeze({
    assetId: AssetId.from(entry.assetId),
    assetVersionId: entry.assetVersionId?.trim() || undefined,
    memoryType: entry.memoryType,
    lineageTag: entry.lineageTag?.trim() || undefined,
  })));

  if (assets.length === 0) {
    throw new Error("Agent memory configuration must include at least one asset reference.");
  }

  if (!Number.isInteger(config.revision) || config.revision < 1) {
    throw new Error("Agent memory configuration revision must be a positive integer.");
  }

  const retrieval = Object.freeze({
    strategy: config.retrieval.strategy,
    maxEntries: config.retrieval.maxEntries,
    requiredTags: normalizeList(config.retrieval.requiredTags),
  });

  if (!Number.isInteger(retrieval.maxEntries) || retrieval.maxEntries <= 0) {
    throw new Error("Agent memory retrieval maxEntries must be a positive integer.");
  }

  return Object.freeze({
    agentId,
    assets,
    retrieval,
    revision: config.revision,
  });
}
