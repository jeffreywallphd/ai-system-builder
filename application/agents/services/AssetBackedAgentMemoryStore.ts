import { Asset } from "../../../domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "../../../domain/assets/AssetMetadata";
import { AssetVersion } from "../../../domain/assets/AssetVersion";
import type { AgentMemoryEntryReference, AgentMemoryQuery, AgentMemoryStore } from "../../../domain/agents/AgentMemory";
import type { IAssetCatalog } from "../../ports/interfaces/IAssetCatalog";
import type { IAssetVersionRepository } from "../../ports/interfaces/IAssetVersionRepository";

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze((tags ?? []).map((tag) => tag.trim()).filter(Boolean));
}

function versionIdFrom(agentId: string, assetId: string): string {
  const safeAgentId = agentId.trim().replace(/[^a-zA-Z0-9:_-]/g, "-");
  const safeAssetId = assetId.trim().replace(/[^a-zA-Z0-9:_-]/g, "-");
  return `agent-memory:${safeAgentId}:${safeAssetId}:${Date.now()}`;
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

    const assetId = entry.assetId.trim();
    if (!assetId) {
      throw new Error("Agent memory add requires assetId.");
    }

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
        entryMetadata: metadata,
      },
      reproducibilitySummary: {
        source: "agent-memory",
      },
    }));
  }

  public async query(agentId: string, criteria: AgentMemoryQuery): Promise<ReadonlyArray<AgentMemoryEntryReference>> {
    const normalizedAgentId = agentId.trim();
    const assetIds = (criteria.assetIds ?? []).map((entry) => entry.trim()).filter(Boolean);
    const tagFilter = new Set(normalizeTags(criteria.tags));
    const maxEntries = Math.max(1, Math.trunc(criteria.maxEntries ?? 10));
    const responses: AgentMemoryEntryReference[] = [];

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
      if (tagFilter.size > 0 && !assetTags.some((tag) => tagFilter.has(tag))) {
        continue;
      }

      const versions = await this.versionRepository.listVersionsByAssetId(assetId);
      const latest = [...versions].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

      responses.push(Object.freeze({
        assetId,
        assetVersionId: latest?.versionId,
        tags: assetTags,
        metadata: latest?.metadata,
      }));
    }

    return Object.freeze(responses.slice(0, maxEntries));
  }
}
