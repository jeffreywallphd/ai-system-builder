import { Asset } from "../../../domain/assets/Asset";
import { AssetId } from "../../../domain/assets/AssetId";
import { AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import type { AgentMemoryEntryReference, AgentMemoryQuery, AgentMemoryStore, AgentMemoryType } from "../../../domain/agents/AgentMemory";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze((tags ?? []).map((tag) => tag.trim()).filter(Boolean));
}

function toPrimitiveMetadata(
  metadata?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string | number | boolean | null>> | undefined {
  if (!metadata) {
    return undefined;
  }
  const entries = Object.entries(metadata).flatMap(([key, value]) => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return [[key, value] as const];
    }
    return [];
  });
  return Object.freeze(Object.fromEntries(entries));
}

function versionIdFrom(agentId: string, assetId: string): string {
  const safeAgentId = agentId.trim().replace(/[^a-zA-Z0-9:_-]/g, "-");
  const safeAssetId = assetId.trim().replace(/[^a-zA-Z0-9:_-]/g, "-");
  return `agent-memory:${safeAgentId}:${safeAssetId}:${Date.now()}`;
}

function normalizeMetadataFilter(
  metadata: Readonly<Record<string, string | number | boolean | null>> | undefined,
): Readonly<Record<string, string | number | boolean | null>> {
  if (!metadata) {
    return Object.freeze({});
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) => {
      const normalizedKey = key.trim();
      if (!normalizedKey) {
        return [];
      }
      return [[normalizedKey, value] as const];
    }),
  ));
}

function matchesMetadataFilter(
  stored: Readonly<Record<string, string | number | boolean | null>> | undefined,
  filter: Readonly<Record<string, string | number | boolean | null>>,
): boolean {
  if (Object.keys(filter).length === 0) {
    return true;
  }
  if (!stored) {
    return false;
  }
  return Object.entries(filter).every(([key, expected]) => stored[key] === expected);
}

export class AssetBackedAgentMemoryStore implements AgentMemoryStore {
  constructor(
    private readonly assetCatalog: IAssetCatalog,
    private readonly versionRepository: IAssetVersionRepository,
  ) {}

  public async add(agentId: string, entry: AgentMemoryEntryReference): Promise<void> {
    const normalizedAgentId = agentId.trim();
    if (!normalizedAgentId) {
      throw new Error("Agent memory add requires agentId.");
    }

    const assetId = AssetId.from(entry.assetId).toString();

    const existingAsset = await this.assetCatalog.getById(assetId);
    const tags = normalizeTags(entry.tags);
    const metadata = entry.metadata ? Object.freeze({ ...entry.metadata }) : undefined;

    const normalizedAsset = existingAsset
      ? Asset.from(existingAsset).withSemanticMetadata({
          ...(existingAsset.semanticMetadata ?? {}),
          tags: Object.freeze([...(existingAsset.semanticMetadata?.tags ?? []), ...tags]),
          attributes: Object.freeze({
            ...(existingAsset.semanticMetadata?.attributes ?? {}),
            agentId: normalizedAgentId,
          }),
        })
      : new Asset({
          id: assetId,
          name: `Agent Memory ${assetId}`,
          kind: "json",
          status: "available",
          source: new AssetSourceInfo({ type: "system", provider: "agent-memory", workflowId: `agent:${normalizedAgentId}` }),
          location: new AssetLocation({ accessMethod: "memory", location: `agent-memory://${normalizedAgentId}/${assetId}`, format: "json", contentType: "application/json" }),
          semanticMetadata: {
            tags,
            attributes: { agentId: normalizedAgentId },
            description: `Memory entries for agent ${normalizedAgentId}`,
          },
        });

    await this.assetCatalog.save(normalizedAsset);

    const versionId = entry.assetVersionId?.trim() || versionIdFrom(normalizedAgentId, assetId);
    await this.versionRepository.saveVersion(new AssetVersion({
      assetId,
      versionId,
      metadata: {
        type: "agent-memory-entry",
        agentId: normalizedAgentId,
        tags,
        memoryType: entry.memoryType,
        ...(metadata ?? {}),
        entryMetadata: metadata,
      },
      reproducibilitySummary: {
        source: "agent-memory",
      },
    }));
  }

  public async query(agentId: string, criteria: AgentMemoryQuery): Promise<ReadonlyArray<AgentMemoryEntryReference>> {
    const normalizedAgentId = agentId.trim();
    const assetIds = (criteria.assetIds ?? []).map((entry) => AssetId.from(entry).toString());
    const tagFilter = new Set(normalizeTags(criteria.tags));
    const memoryTypeFilter = new Set<AgentMemoryType>(criteria.memoryTypes ?? []);
    const metadataFilter = normalizeMetadataFilter(criteria.metadata);
    const maxEntries = Math.max(1, Math.trunc(criteria.maxEntries ?? 10));
    const beforeTimestamp = criteria.beforeTimestamp ? new Date(criteria.beforeTimestamp) : undefined;
    if (beforeTimestamp && Number.isNaN(beforeTimestamp.getTime())) {
      throw new Error(`Agent memory query beforeTimestamp '${criteria.beforeTimestamp}' is invalid.`);
    }
    const responses: Array<AgentMemoryEntryReference & { readonly createdAt: number }> = [];

    for (const assetId of assetIds) {
      const asset = await this.assetCatalog.getById(assetId);
      if (!asset) {
        continue;
      }

      const agentScope = asset.semanticMetadata?.attributes?.agentId;
      if (typeof agentScope === "string" && agentScope !== normalizedAgentId) {
        continue;
      }

      const assetTags = normalizeTags(asset.semanticMetadata?.tags);

      const versions = [...await this.versionRepository.listVersionsByAssetId(assetId)]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      for (const version of versions) {
        if (beforeTimestamp && version.createdAt.getTime() >= beforeTimestamp.getTime()) {
          continue;
        }

        const storedMemoryType = typeof version.metadata?.memoryType === "string"
          ? (version.metadata.memoryType as AgentMemoryType)
          : undefined;
        if (memoryTypeFilter.size > 0 && (!storedMemoryType || !memoryTypeFilter.has(storedMemoryType))) {
          continue;
        }

        const metadata = toPrimitiveMetadata(version.metadata);
        const versionTags = normalizeTags(Array.isArray(version.metadata?.tags) ? (version.metadata?.tags as string[]) : undefined);
        const candidateTags = versionTags.length > 0 ? versionTags : assetTags;
        if (tagFilter.size > 0 && !candidateTags.some((tag) => tagFilter.has(tag))) {
          continue;
        }
        if (!matchesMetadataFilter(metadata, metadataFilter)) {
          continue;
        }

        responses.push(Object.freeze({
          assetId: new AssetId(assetId),
          assetVersionId: version.versionId,
          memoryType: storedMemoryType ?? "working",
          tags: candidateTags,
          metadata,
          createdAt: version.createdAt.getTime(),
        }));
      }
    }

    return Object.freeze(
      responses
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, maxEntries)
        .map((entry) => Object.freeze({
          assetId: entry.assetId,
          assetVersionId: entry.assetVersionId,
          memoryType: entry.memoryType,
          tags: entry.tags,
          metadata: entry.metadata,
        })),
    );
  }
}
