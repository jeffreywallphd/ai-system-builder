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
  readonly memoryTypes?: ReadonlyArray<AgentMemoryType>;
  readonly semantic?: {
    readonly minRelevanceScore?: number;
  };
  readonly recency?: {
    readonly preferLatest: boolean;
    readonly lookbackWindowEntries?: number;
  };
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
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped]);
}

function normalizeMemoryTypes(values: ReadonlyArray<AgentMemoryType> | undefined): ReadonlyArray<AgentMemoryType> {
  const deduped: AgentMemoryType[] = [];
  const seen = new Set<AgentMemoryType>();
  for (const value of values ?? []) {
    if (!Object.values(AgentMemoryTypes).includes(value)) {
      throw new Error(`Unsupported agent memory type '${String(value)}'.`);
    }
    if (!seen.has(value)) {
      seen.add(value);
      deduped.push(value);
    }
  }
  return Object.freeze(deduped);
}

export function normalizeAgentMemoryConfiguration(config: AgentMemoryConfiguration): AgentMemoryConfiguration {
  const agentId = normalizeRequired(config.agentId, "Agent memory configuration agentId");
  const seenRefs = new Set<string>();
  const assets = Object.freeze((config.assets ?? []).map((entry) => {
    if (!Object.values(AgentMemoryTypes).includes(entry.memoryType)) {
      throw new Error(`Unsupported agent memory type '${String(entry.memoryType)}'.`);
    }

    const normalizedEntry = Object.freeze({
      assetId: AssetId.from(entry.assetId),
      assetVersionId: entry.assetVersionId?.trim() || undefined,
      memoryType: entry.memoryType,
      lineageTag: entry.lineageTag?.trim() || undefined,
    });

    const key = [
      normalizedEntry.assetId.toString(),
      normalizedEntry.assetVersionId ?? "latest",
      normalizedEntry.memoryType,
    ].join("|");
    if (seenRefs.has(key)) {
      throw new Error(`Agent memory configuration contains duplicate asset reference '${key}'.`);
    }
    seenRefs.add(key);

    return normalizedEntry;
  }));

  if (assets.length === 0) {
    throw new Error("Agent memory configuration must include at least one asset reference.");
  }

  if (!Number.isInteger(config.revision) || config.revision < 1) {
    throw new Error("Agent memory configuration revision must be a positive integer.");
  }

  const retrievalStrategy = config.retrieval?.strategy;
  const retrieval = Object.freeze({
    strategy: retrievalStrategy,
    maxEntries: config.retrieval?.maxEntries,
    requiredTags: normalizeList(config.retrieval?.requiredTags),
    memoryTypes: normalizeMemoryTypes(config.retrieval?.memoryTypes),
    semantic: config.retrieval?.semantic
      ? Object.freeze({
          minRelevanceScore: normalizeUnitScore(config.retrieval.semantic.minRelevanceScore, "Agent memory semantic minRelevanceScore"),
        })
      : undefined,
    recency: config.retrieval?.recency
      ? Object.freeze({
          preferLatest: config.retrieval.recency.preferLatest,
          lookbackWindowEntries: normalizePositiveInt(
            config.retrieval.recency.lookbackWindowEntries,
            "Agent memory recency lookbackWindowEntries",
          ),
        })
      : undefined,
  });

  if (!["latest-first", "semantic-filter", "hybrid"].includes(String(retrieval.strategy))) {
    throw new Error("Agent memory retrieval strategy must be latest-first, semantic-filter, or hybrid.");
  }

  if (!Number.isInteger(retrieval.maxEntries) || retrieval.maxEntries <= 0) {
    throw new Error("Agent memory retrieval maxEntries must be a positive integer.");
  }

  if (retrieval.strategy === "latest-first" && retrieval.semantic) {
    throw new Error("Agent memory retrieval semantic config is not allowed for latest-first strategy.");
  }

  return Object.freeze({
    agentId,
    assets,
    retrieval,
    revision: config.revision,
  });
}

function normalizePositiveInt(value: number | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer when provided.`);
  }
  return value;
}

function normalizeUnitScore(value: number | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a number between 0 and 1 when provided.`);
  }
  return value;
}
