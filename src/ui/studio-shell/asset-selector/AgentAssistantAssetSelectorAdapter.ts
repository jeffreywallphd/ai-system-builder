import {
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  createAssetSelectorRequest,
  type AssetSelectorRequest,
} from "../../../domain/studio-shell/AssetSelectorContract";
import {
  AssetSelectorUsageContexts,
  type AssetSelectorUsageContext,
} from "../../../application/studio-entry/AssetSelectorCapabilityRegistry";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../domain/taxonomy/CompositionTaxonomy";
import type { RegistryService } from "../../services/RegistryService";
import type { AssetSelectorDataProvider, AssetSelectorQueryResponse } from "./AssetSelectorDataProvider";

export interface AgentAssistantAssetSelectorAdapterOptions {
  readonly registryService: Pick<RegistryService, "filterAssets" | "searchAssets">;
  readonly limit?: number;
  readonly cacheTtlMs?: number;
  readonly cacheMaxEntries?: number;
}

export interface AgentAssistantAssetSelectorRequestInput {
  readonly requestId: string;
  readonly originatingStudio: string;
  readonly originatingField: string;
  readonly launchSource?: "studio" | "wizard" | "canvas" | "handoff" | "unknown";
  readonly selectionMode?: typeof AssetSelectorSelectionModes.singleSelect | typeof AssetSelectorSelectionModes.multiSelect;
  readonly minSelections?: number;
  readonly maxSelections?: number;
  readonly required?: boolean;
  readonly usageContext?: AssetSelectorUsageContext;
}

const deletedStatuses = new Set(["deleted", "deleting", "removed"]);

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isDeletedStatus(status: string): boolean {
  return deletedStatuses.has(status.trim().toLowerCase());
}

function buildAgentBadges(input: {
  readonly status: string;
  readonly kind: string;
  readonly behaviorKind?: string;
}): ReadonlyArray<string> {
  const badges = ["agent", input.kind, input.status];
  if (input.behaviorKind) {
    badges.push(input.behaviorKind);
  }
  return Object.freeze(
    badges
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

export function createAgentAssistantAssetSelectorRequest(input: AgentAssistantAssetSelectorRequestInput): AssetSelectorRequest {
  const selectionMode = input.selectionMode ?? AssetSelectorSelectionModes.singleSelect;
  const defaultMaxSelections = selectionMode === AssetSelectorSelectionModes.singleSelect ? 1 : undefined;

  return createAssetSelectorRequest({
    requestId: input.requestId,
    assetType: TaxonomySemanticRoles.agent,
    selectionMode,
    allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset, AssetSelectorSelectionTypes.createNewAsset],
    constraints: {
      required: input.required ?? false,
      minSelections: input.minSelections ?? 0,
      maxSelections: input.maxSelections ?? defaultMaxSelections,
    },
    context: {
      originatingStudio: input.originatingStudio,
      originatingField: input.originatingField,
      usageContext: input.usageContext ?? AssetSelectorUsageContexts.workflowStep,
      launchSource: input.launchSource ?? "wizard",
    },
  });
}

export class AgentAssistantAssetSelectorAdapter implements AssetSelectorDataProvider {
  private readonly limit: number;
  private readonly cacheTtlMs: number;
  private readonly cacheMaxEntries: number;
  private readonly queryCache = new Map<string, {
    readonly createdAt: number;
    readonly response: AssetSelectorQueryResponse;
  }>();

  public constructor(private readonly options: AgentAssistantAssetSelectorAdapterOptions) {
    this.limit = options.limit ?? 75;
    this.cacheTtlMs = options.cacheTtlMs ?? 15000;
    this.cacheMaxEntries = options.cacheMaxEntries ?? 40;
  }

  public async query(input: {
    readonly request: AssetSelectorRequest;
    readonly searchTerm: string;
  }): Promise<AssetSelectorQueryResponse> {
    const keyword = input.searchTerm.trim();
    const cacheKey = [
      input.request.requestId,
      input.request.assetType,
      input.request.context.usageContext ?? "",
      keyword.toLowerCase(),
    ].join("::");
    const now = Date.now();
    const cached = this.queryCache.get(cacheKey);
    if (cached && (now - cached.createdAt) <= this.cacheTtlMs) {
      return cached.response;
    }

    const response = keyword.length > 0
      ? await this.options.registryService.searchAssets({
        keyword,
        structuralKinds: [TaxonomyStructuralKinds.composite],
        semanticRoles: [TaxonomySemanticRoles.agent],
        behaviorKinds: [TaxonomyBehaviorKinds.autonomous],
        limit: this.limit,
      })
      : await this.options.registryService.filterAssets({
        structuralKinds: [TaxonomyStructuralKinds.composite],
        semanticRoles: [TaxonomySemanticRoles.agent],
        behaviorKinds: [TaxonomyBehaviorKinds.autonomous],
        limit: this.limit,
      });

    if (!response.ok || !response.data) {
      const failedResponse: AssetSelectorQueryResponse = Object.freeze({
        items: Object.freeze([]),
        error: response.error?.message ?? "Unable to load agent or assistant assets.",
      });
      this.cache(cacheKey, failedResponse, now);
      return failedResponse;
    }

    const items = response.data
      .filter((entry) => Boolean(entry.assetId?.trim()))
      .filter((entry) => !isDeletedStatus(entry.status))
      .filter((entry) => !entry.taxonomy || entry.taxonomy.semanticRole === TaxonomySemanticRoles.agent)
      .map((entry) => {
        const name = normalizeOptional(entry.name) ?? entry.assetId;
        return Object.freeze({
          id: `${entry.assetId}:${entry.versionId ?? ""}`,
          title: name,
          subtitle: normalizeOptional(entry.versionId),
          description: normalizeOptional(entry.provenance.sourceLabel),
          badges: buildAgentBadges({
            status: entry.status,
            kind: entry.kind,
            behaviorKind: entry.taxonomy?.behaviorKind,
          }),
          asset: Object.freeze({
            assetId: entry.assetId,
            versionId: normalizeOptional(entry.versionId),
            assetType: TaxonomySemanticRoles.agent,
            displayName: name,
            taxonomy: entry.taxonomy,
          }),
        });
      });

    const successResponse: AssetSelectorQueryResponse = Object.freeze({
      items: Object.freeze(items),
    });
    this.cache(cacheKey, successResponse, now);
    return successResponse;
  }

  private cache(key: string, response: AssetSelectorQueryResponse, createdAt: number): void {
    this.queryCache.set(key, Object.freeze({ createdAt, response }));
    if (this.queryCache.size <= this.cacheMaxEntries) {
      return;
    }
    const oldest = this.queryCache.keys().next().value;
    if (oldest) {
      this.queryCache.delete(oldest);
    }
  }
}
