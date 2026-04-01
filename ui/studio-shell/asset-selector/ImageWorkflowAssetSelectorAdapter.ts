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
import { TaxonomySemanticRoles } from "../../../domain/taxonomy/CompositionTaxonomy";
import {
  createDefaultImageWorkflowAssetRegistry,
  type ImageWorkflowAssetRegistry,
} from "../../../application/contracts/ImageWorkflowAssetRegistry";
import type { AssetSelectorDataProvider, AssetSelectorQueryResponse } from "./AssetSelectorDataProvider";

export interface ImageWorkflowAssetSelectorRequestInput {
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

export interface ImageWorkflowAssetSelectorAdapterOptions {
  readonly registry?: Pick<ImageWorkflowAssetRegistry, "list">;
}

function normalize(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createImageWorkflowAssetSelectorRequest(input: ImageWorkflowAssetSelectorRequestInput): AssetSelectorRequest {
  const selectionMode = input.selectionMode ?? AssetSelectorSelectionModes.singleSelect;
  const defaultMaxSelections = selectionMode === AssetSelectorSelectionModes.singleSelect ? 1 : undefined;

  return createAssetSelectorRequest({
    requestId: input.requestId,
    assetType: TaxonomySemanticRoles.workflow,
    selectionMode,
    allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
    constraints: {
      required: input.required ?? true,
      minSelections: input.minSelections ?? 1,
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

export class ImageWorkflowAssetSelectorAdapter implements AssetSelectorDataProvider {
  private readonly registry: Pick<ImageWorkflowAssetRegistry, "list">;

  public constructor(options: ImageWorkflowAssetSelectorAdapterOptions = {}) {
    this.registry = options.registry ?? createDefaultImageWorkflowAssetRegistry();
  }

  public async query(input: {
    readonly request: AssetSelectorRequest;
    readonly searchTerm: string;
  }): Promise<AssetSelectorQueryResponse> {
    const term = input.searchTerm.trim().toLowerCase();
    const entries = this.registry.list().filter((entry) => {
      if (!term) {
        return true;
      }
      const searchable = [
        entry.id,
        entry.title,
        entry.summary,
        entry.intentType,
        ...entry.tags,
      ].map((value) => value.toLowerCase());
      return searchable.some((value) => value.includes(term));
    });

    return Object.freeze({
      items: Object.freeze(entries.map((entry) => Object.freeze({
        id: `${entry.id}:${entry.version}`,
        title: entry.title,
        subtitle: entry.version,
        description: entry.summary,
        badges: Object.freeze([
          "image-workflow",
          entry.intentType,
          entry.taxonomy.behaviorKind,
        ]),
        asset: Object.freeze({
          assetId: entry.id,
          versionId: normalize(entry.version),
          assetType: TaxonomySemanticRoles.workflow,
          displayName: entry.title,
          taxonomy: entry.taxonomy,
          metadata: Object.freeze({
            summary: entry.summary,
            previewMode: entry.preview.previewMode,
            inspectableFields: entry.preview.inspectableFields,
            configurationSurface: entry.configurationSurface,
          }),
        }),
      }))),
    });
  }
}
