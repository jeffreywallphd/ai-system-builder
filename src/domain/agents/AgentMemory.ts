import { AssetId } from "../assets/AssetId";

export const AgentMemoryTypes = Object.freeze({
  episodic: "episodic",
  semantic: "semantic",
  working: "working",
});

export type AgentMemoryType = typeof AgentMemoryTypes[keyof typeof AgentMemoryTypes];

export const AgentMemoryRetrievalStrategies = Object.freeze({
  latestFirst: "latest-first",
  semanticFilter: "semantic-filter",
  hybrid: "hybrid",
});

export type AgentMemoryRetrievalStrategy =
  typeof AgentMemoryRetrievalStrategies[keyof typeof AgentMemoryRetrievalStrategies];

export interface AgentMemoryAssetRef {
  readonly assetId: AssetId;
  readonly assetVersionId?: string;
  readonly memoryType: AgentMemoryType;
  readonly lineageTag?: string;
}

export interface AgentMemoryRetrievalConfig {
  readonly strategy: AgentMemoryRetrievalStrategy;
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

export const AgentMemoryRetentionModes = Object.freeze({
  disabled: "disabled",
  bounded: "bounded",
});

export type AgentMemoryRetentionMode = typeof AgentMemoryRetentionModes[keyof typeof AgentMemoryRetentionModes];

export interface AgentMemoryPolicy {
  readonly maxRetrievalEntries?: number;
  readonly retrievableTypes?: ReadonlyArray<AgentMemoryType>;
  readonly writableTypes?: ReadonlyArray<AgentMemoryType>;
  readonly sessionOnlyTypes?: ReadonlyArray<AgentMemoryType>;
  readonly retention: {
    readonly mode: AgentMemoryRetentionMode;
    readonly maxDurableEntries?: number;
  };
}

export interface AgentMemoryConfiguration {
  readonly agentId: string;
  readonly assets: ReadonlyArray<AgentMemoryAssetRef>;
  readonly retrieval: AgentMemoryRetrievalConfig;
  readonly policy: AgentMemoryPolicy;
  readonly revision: number;
}

export interface AgentMemoryEntryReference {
  readonly assetId: AssetId;
  readonly assetVersionId?: string;
  readonly memoryType: AgentMemoryType;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AgentMemoryQuery {
  readonly assetIds?: ReadonlyArray<AssetId>;
  readonly memoryTypes?: ReadonlyArray<AgentMemoryType>;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
  readonly maxEntries?: number;
  readonly beforeTimestamp?: string;
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

function assertSubset(
  subset: ReadonlyArray<AgentMemoryType>,
  superset: ReadonlyArray<AgentMemoryType>,
  label: string,
): void {
  const allowed = new Set(superset);
  for (const value of subset) {
    if (!allowed.has(value)) {
      throw new Error(`${label} includes '${value}' which is not allowed by writableTypes.`);
    }
  }
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
    if (!normalizedEntry.assetId.toString().startsWith("asset:")) {
      throw new Error(`Agent memory asset reference '${normalizedEntry.assetId.toString()}' must use canonical asset id format.`);
    }
    if (normalizedEntry.assetVersionId !== undefined && !/^[a-zA-Z0-9:_-]+$/.test(normalizedEntry.assetVersionId)) {
      throw new Error(`Agent memory assetVersionId '${normalizedEntry.assetVersionId}' is malformed.`);
    }

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
  const policy = Object.freeze({
    maxRetrievalEntries: normalizePositiveInt(config.policy?.maxRetrievalEntries, "Agent memory policy maxRetrievalEntries"),
    retrievableTypes: normalizeMemoryTypes(config.policy?.retrievableTypes),
    writableTypes: normalizeMemoryTypes(config.policy?.writableTypes),
    sessionOnlyTypes: normalizeMemoryTypes(config.policy?.sessionOnlyTypes),
    retention: Object.freeze({
      mode: config.policy?.retention?.mode ?? AgentMemoryRetentionModes.bounded,
      maxDurableEntries: normalizePositiveInt(config.policy?.retention?.maxDurableEntries, "Agent memory policy retention maxDurableEntries"),
    }),
  });

  if (!Object.values(AgentMemoryRetrievalStrategies).includes(retrieval.strategy)) {
    throw new Error("Agent memory retrieval strategy must be latest-first, semantic-filter, or hybrid.");
  }

  if (!Number.isInteger(retrieval.maxEntries) || retrieval.maxEntries <= 0) {
    throw new Error("Agent memory retrieval maxEntries must be a positive integer.");
  }

  if (retrieval.strategy === "latest-first" && retrieval.semantic) {
    throw new Error("Agent memory retrieval semantic config is not allowed for latest-first strategy.");
  }
  if (retrieval.strategy === "semantic-filter" && !retrieval.semantic) {
    throw new Error("Agent memory retrieval semantic-filter strategy requires semantic config.");
  }
  if (retrieval.strategy === "hybrid" && !retrieval.recency && !retrieval.semantic) {
    throw new Error("Agent memory retrieval hybrid strategy requires semantic or recency config.");
  }
  if (!Object.values(AgentMemoryRetentionModes).includes(policy.retention.mode)) {
    throw new Error("Agent memory policy retention mode must be disabled or bounded.");
  }
  if (policy.retention.mode === AgentMemoryRetentionModes.disabled && policy.retention.maxDurableEntries !== undefined) {
    throw new Error("Agent memory policy retention maxDurableEntries is not allowed when retention mode is disabled.");
  }
  if (policy.maxRetrievalEntries !== undefined && policy.maxRetrievalEntries > retrieval.maxEntries) {
    throw new Error("Agent memory policy maxRetrievalEntries cannot exceed retrieval maxEntries.");
  }
  if (policy.writableTypes.length > 0 && policy.sessionOnlyTypes.length > 0) {
    assertSubset(policy.sessionOnlyTypes, policy.writableTypes, "Agent memory policy sessionOnlyTypes");
  }
  if (policy.retrievableTypes.length > 0 && policy.sessionOnlyTypes.length > 0) {
    const sessionOnly = new Set(policy.sessionOnlyTypes);
    const overlap = policy.retrievableTypes.filter((type) => sessionOnly.has(type));
    if (overlap.length > 0) {
      throw new Error(
        `Agent memory policy retrievableTypes cannot include session-only types: ${overlap.join(", ")}.`,
      );
    }
  }
  if (retrieval.memoryTypes.length > 0 && policy.retrievableTypes.length > 0) {
    const allowed = new Set(policy.retrievableTypes);
    for (const value of retrieval.memoryTypes) {
      if (!allowed.has(value)) {
        throw new Error(
          `Agent memory retrieval memoryTypes includes '${value}' which is not allowed by policy retrievableTypes.`,
        );
      }
    }
  }
  if (retrieval.memoryTypes.length > 0 && policy.sessionOnlyTypes.length > 0) {
    const sessionOnly = new Set(policy.sessionOnlyTypes);
    const overlap = retrieval.memoryTypes.filter((type) => sessionOnly.has(type));
    if (overlap.length > 0) {
      throw new Error(
        `Agent memory retrieval memoryTypes cannot include session-only types: ${overlap.join(", ")}.`,
      );
    }
  }

  const durableWritableTypes = policy.writableTypes.filter((type) => !policy.sessionOnlyTypes.includes(type));
  if (policy.retention.mode === AgentMemoryRetentionModes.bounded && durableWritableTypes.length === 0) {
    throw new Error("Agent memory bounded retention requires at least one durable writable memory type.");
  }
  if (durableWritableTypes.length > 0 && assets.length === 0) {
    throw new Error("Agent memory durable writable types require at least one asset-backed memory reference.");
  }

  return Object.freeze({
    agentId,
    assets,
    retrieval,
    policy,
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
