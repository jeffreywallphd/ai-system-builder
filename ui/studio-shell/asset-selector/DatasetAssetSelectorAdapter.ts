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

export interface DatasetAssetSelectorAdapterOptions {
  readonly registryService: Pick<RegistryService, "filterAssets" | "searchAssets">;
  readonly limit?: number;
}

export interface DatasetAssetSelectorRequestInput {
  readonly requestId: string;
  readonly originatingStudio: string;
  readonly originatingField: string;
  readonly launchSource?: "studio" | "wizard" | "canvas" | "handoff" | "unknown";
  readonly selectionMode?: typeof AssetSelectorSelectionModes.multiSelect | typeof AssetSelectorSelectionModes.singleSelect;
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

function buildDatasetBadges(input: {
  readonly status: string;
  readonly sourceLabel?: string;
}): ReadonlyArray<string> {
  const badges = ["dataset", input.status];
  if (input.sourceLabel) {
    badges.push(input.sourceLabel);
  }
  return Object.freeze(
    badges
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function isDeletedStatus(status: string): boolean {
  return deletedStatuses.has(status.trim().toLowerCase());
}

export function createDatasetAssetSelectorRequest(input: DatasetAssetSelectorRequestInput): AssetSelectorRequest {
  const selectionMode = input.selectionMode ?? AssetSelectorSelectionModes.multiSelect;
  return createAssetSelectorRequest({
    requestId: input.requestId,
    assetType: TaxonomySemanticRoles.dataset,
    selectionMode,
    allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset, AssetSelectorSelectionTypes.createNewAsset],
    constraints: {
      required: input.required ?? false,
      minSelections: input.minSelections ?? (selectionMode === AssetSelectorSelectionModes.singleSelect ? 0 : 0),
      maxSelections: input.maxSelections,
    },
    context: {
      originatingStudio: input.originatingStudio,
      originatingField: input.originatingField,
      usageContext: input.usageContext ?? AssetSelectorUsageContexts.workflowInput,
      launchSource: input.launchSource ?? "wizard",
    },
  });
}

export class DatasetAssetSelectorAdapter implements AssetSelectorDataProvider {
  private readonly limit: number;

  public constructor(private readonly options: DatasetAssetSelectorAdapterOptions) {
    this.limit = options.limit ?? 75;
  }

  public async query(input: {
    readonly request: AssetSelectorRequest;
    readonly searchTerm: string;
  }): Promise<AssetSelectorQueryResponse> {
    const keyword = input.searchTerm.trim();
    const response = keyword.length > 0
      ? await this.options.registryService.searchAssets({
        keyword,
        structuralKinds: [TaxonomyStructuralKinds.atomic],
        semanticRoles: [TaxonomySemanticRoles.dataset],
        behaviorKinds: [TaxonomyBehaviorKinds.none],
        limit: this.limit,
      })
      : await this.options.registryService.filterAssets({
        structuralKinds: [TaxonomyStructuralKinds.atomic],
        semanticRoles: [TaxonomySemanticRoles.dataset],
        behaviorKinds: [TaxonomyBehaviorKinds.none],
        limit: this.limit,
      });

    if (!response.ok || !response.data) {
      return Object.freeze({
        items: Object.freeze([]),
        error: response.error?.message ?? "Unable to load dataset assets.",
      });
    }

    const items = response.data
      .filter((entry) => Boolean(entry.assetId?.trim()))
      .filter((entry) => !isDeletedStatus(entry.status))
      .filter((entry) => !entry.taxonomy || entry.taxonomy.semanticRole === TaxonomySemanticRoles.dataset)
      .map((entry) => {
        const name = normalizeOptional(entry.name) ?? entry.assetId;
        const sourceLabel = normalizeOptional(entry.provenance.sourceLabel);
        return Object.freeze({
          id: `${entry.assetId}:${entry.versionId ?? ""}`,
          title: name,
          subtitle: normalizeOptional(entry.versionId),
          description: sourceLabel,
          badges: buildDatasetBadges({
            status: entry.status,
            sourceLabel,
          }),
          asset: Object.freeze({
            assetId: entry.assetId,
            versionId: normalizeOptional(entry.versionId),
            assetType: TaxonomySemanticRoles.dataset,
            displayName: name,
            taxonomy: entry.taxonomy,
          }),
        });
      });

    return Object.freeze({
      items: Object.freeze(items),
    });
  }
}
