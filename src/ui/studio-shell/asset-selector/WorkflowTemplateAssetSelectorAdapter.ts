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
import { CoreImageStarterWorkflowTemplates } from "../../../application/workflow-template-studio/CoreImageStarterWorkflowTemplates";
import type { AssetSelectorDataProvider, AssetSelectorQueryResponse } from "./AssetSelectorDataProvider";

export interface WorkflowTemplateAssetSelectorRequestInput {
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

export function createWorkflowTemplateAssetSelectorRequest(
  input: WorkflowTemplateAssetSelectorRequestInput,
): AssetSelectorRequest {
  const selectionMode = input.selectionMode ?? AssetSelectorSelectionModes.singleSelect;
  const defaultMaxSelections = selectionMode === AssetSelectorSelectionModes.singleSelect ? 1 : undefined;

  return createAssetSelectorRequest({
    requestId: input.requestId,
    assetType: TaxonomySemanticRoles.workflowTemplate,
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
      usageContext: input.usageContext ?? AssetSelectorUsageContexts.workflowTemplate,
      launchSource: input.launchSource ?? "wizard",
    },
  });
}

export class WorkflowTemplateAssetSelectorAdapter implements AssetSelectorDataProvider {
  public async query(input: {
    readonly request: AssetSelectorRequest;
    readonly searchTerm: string;
  }): Promise<AssetSelectorQueryResponse> {
    const term = input.searchTerm.trim().toLowerCase();
    const entries = CoreImageStarterWorkflowTemplates.filter((entry) => {
      if (!term) return true;
      return [entry.name, entry.summary ?? "", entry.category, entry.metadata.category ?? "", ...entry.tags]
        .map((value) => value.toLowerCase())
        .some((value) => value.includes(term));
    });

    return Object.freeze({
      items: Object.freeze(entries.map((entry) => Object.freeze({
        id: `${entry.templateId}:${entry.versionId}`,
        title: entry.name,
        subtitle: entry.versionId,
        description: entry.summary,
        badges: Object.freeze([entry.metadata.category ?? entry.category, entry.supportedIntent]),
        asset: Object.freeze({
          assetId: entry.templateId,
          versionId: entry.versionId,
          assetType: TaxonomySemanticRoles.workflowTemplate,
          displayName: entry.name,
          taxonomy: {
            structuralKind: "composite",
            semanticRole: "workflow-template",
            behaviorKind: "deterministic",
          },
          metadata: Object.freeze({
            category: entry.metadata.category ?? entry.category,
            intent: entry.metadata.intent ?? entry.supportedIntent,
            inputSummary: entry.inputRequirements.map((item) => item.inputId).join(", "),
            outputSummary: entry.outputExpectations.map((item) => item.outputId).join(", "),
          }),
        }),
      }))),
    });
  }
}
