import type {
  AssetBinding,
  AssetComposition,
  AssetCompositionType,
  AssetConfigurationValues,
  AssetDefinition,
  AssetFamily,
  AssetInstance,
  AssetInstanceStateSummary,
  AssetLifecycleStatus,
  AssetMetadata,
  AssetReference,
  AssetResourceBackedView,
  AssetResourceBackedViewKind,
  AssetType,
} from "../../../contracts/asset";
import type { AssetValidationResult } from "./asset-validation-helpers";

export interface AssetRegistryListQuery {
  readonly searchText?: string;
  readonly assetTypes?: readonly AssetType[];
  readonly assetFamilies?: readonly AssetFamily[];
  readonly lifecycleStatuses?: readonly AssetLifecycleStatus[];
  readonly includeBuiltIns?: boolean;
  readonly includeCustom?: boolean;
  readonly includeMetadata?: boolean;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AssetRegistryReadOptions {
  readonly includeValidation?: boolean;
  readonly includeAiContext?: boolean;
  readonly includeConfigurationSchema?: boolean;
  readonly includePorts?: boolean;
  readonly includeRequirements?: boolean;
  readonly includeResourceBackings?: boolean;
  readonly includeMetadata?: boolean;
}

export interface AssetRegistryListDiagnostic {
  readonly severity: "info" | "warning" | "error";
  readonly code: string;
  readonly message: string;
}

export interface AssetRegistryListResult<TCard> {
  readonly items: readonly TCard[];
  readonly nextCursor?: string;
  readonly diagnostics?: readonly AssetRegistryListDiagnostic[];
}

export interface AssetDefinitionCard {
  readonly definitionRef: AssetReference;
  readonly definitionId: string;
  readonly version: string;
  readonly assetType: AssetType;
  readonly assetFamily: AssetFamily;
  readonly displayName: string;
  readonly summary?: string;
  readonly lifecycleStatus: AssetLifecycleStatus;
  readonly builtIn?: boolean;
  readonly metadata?: AssetMetadata;
}

export interface AssetDefinitionDetail {
  readonly definition: AssetDefinition;
  readonly builtIn?: boolean;
  readonly validationSummary?: AssetValidationResult;
}

export interface AssetInstanceCard {
  readonly instanceRef: AssetReference;
  readonly instanceId: string;
  readonly definitionRef: AssetReference;
  readonly displayName?: string;
  readonly lifecycleStatus: AssetLifecycleStatus;
  readonly configurationSummary?: AssetConfigurationSummary;
  readonly stateSummary?: AssetInstanceStateSummary;
  readonly metadata?: AssetMetadata;
}

export interface AssetConfigurationSummary {
  readonly configuredFieldCount: number;
  readonly configuredFieldIds: readonly string[];
}

export interface AssetInstanceDetail {
  readonly instance: AssetInstance;
  readonly configurationSummary?: AssetConfigurationSummary;
  readonly validationSummary?: AssetValidationResult;
}

export interface AssetCompositionCard {
  readonly compositionRef: AssetReference;
  readonly compositionId: string;
  readonly compositionType: AssetCompositionType;
  readonly version: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly lifecycleStatus: AssetLifecycleStatus;
  readonly rootInstanceCount: number;
  readonly instanceCount: number;
  readonly bindingCount: number;
  readonly metadata?: AssetMetadata;
}

export interface AssetBindingSummary {
  readonly bindingRef: AssetReference;
  readonly bindingId: string;
  readonly bindingKind: AssetBinding["bindingKind"];
  readonly sourceRef: AssetReference;
  readonly targetRef: AssetReference;
  readonly lifecycleStatus?: AssetLifecycleStatus;
}

export interface AssetCompositionDetail {
  readonly composition: AssetComposition;
  readonly rootInstanceRefs: readonly AssetReference[];
  readonly childInstanceRefs: readonly AssetReference[];
  readonly bindingRefs: readonly AssetReference[];
  readonly bindingSummaries: readonly AssetBindingSummary[];
  readonly validationSummary?: AssetValidationResult;
}

export interface AssetRegistryResourceBackedViewCard {
  readonly viewId: string;
  readonly viewKind: AssetResourceBackedViewKind;
  readonly displayName?: string;
  readonly summary?: string;
  readonly assetType?: AssetType;
  readonly assetFamily?: AssetFamily;
  readonly assetDefinitionRef?: AssetReference;
  readonly lifecycleStatus?: AssetLifecycleStatus;
  readonly metadata?: AssetMetadata;
}

export interface AssetRegistryResourceBackedViewDetail {
  readonly view: AssetResourceBackedView;
  readonly validationSummary?: AssetResourceBackedView["validationSummary"];
}

export interface AssetResourceBackedViewQuery {
  readonly searchText?: string;
  readonly assetTypes?: readonly AssetType[];
  readonly assetFamilies?: readonly AssetFamily[];
  readonly lifecycleStatuses?: readonly AssetLifecycleStatus[];
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AssetResourceBackedViewProvider {
  listResourceBackedViews(query?: AssetResourceBackedViewQuery): Promise<readonly AssetResourceBackedView[]>;
  readResourceBackedView(viewId: string): Promise<AssetResourceBackedView | undefined>;
}

export type AssetRegistryConfigurationValues = AssetConfigurationValues;
