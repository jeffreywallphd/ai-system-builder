import type {
  AssetFamily,
  AssetLifecycleStatus,
  AssetType,
} from "../../../contracts/asset";

export type AssetLibraryBuiltInFilter = "all" | "built-in" | "custom";

export type AssetLibraryDefinitionExpansion =
  | "aiContext"
  | "configurationSchema"
  | "ports"
  | "requirements"
  | "provenance"
  | "metadata";

export interface AssetLibraryQuery {
  readonly searchText?: string;
  readonly assetTypes?: readonly AssetType[];
  readonly assetFamilies?: readonly AssetFamily[];
  readonly lifecycleStatuses?: readonly AssetLifecycleStatus[];
  readonly builtIn?: AssetLibraryBuiltInFilter;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AssetLibraryDefinitionLocator {
  readonly definitionId: string;
  readonly version?: string;
}

export type AssetLibraryDefinitionVersionLocator = Required<
  Pick<AssetLibraryDefinitionLocator, "definitionId" | "version">
>;

export interface AssetLibraryDetailOptions {
  readonly includeValidation?: boolean;
  readonly expand?: readonly AssetLibraryDefinitionExpansion[];
}
