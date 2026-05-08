import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AssetLibraryBuiltInFilter,
  AssetLibraryClient,
  AssetLibraryDefinitionCard,
  AssetLibraryDefinitionDetail,
  AssetLibraryQuery,
} from "../../../../../../modules/ui/shared/asset-library";
import { createApiAssetLibraryClient } from "../api/apiAssetLibraryClient";

export type AssetLibraryFilterValue = "all" | string;

export interface AssetLibraryFiltersState {
  readonly searchText: string;
  readonly assetType: AssetLibraryFilterValue;
  readonly assetFamily: AssetLibraryFilterValue;
  readonly lifecycleStatus: AssetLibraryFilterValue;
  readonly builtIn: AssetLibraryBuiltInFilter;
}

export interface AssetLibraryFeatureState {
  readonly filters: AssetLibraryFiltersState;
  readonly definitions: readonly AssetLibraryDefinitionCard[];
  readonly selectedDefinitionId?: string;
  readonly selectedDetail?: AssetLibraryDefinitionDetail;
  readonly isLoadingList: boolean;
  readonly isLoadingDetail: boolean;
  readonly listError?: string;
  readonly detailError?: string;
  readonly hasActiveFilters: boolean;
  readonly diagnostics: readonly string[];
  readonly setSearchText: (value: string) => void;
  readonly setAssetType: (value: AssetLibraryFilterValue) => void;
  readonly setAssetFamily: (value: AssetLibraryFilterValue) => void;
  readonly setLifecycleStatus: (value: AssetLibraryFilterValue) => void;
  readonly setBuiltIn: (value: AssetLibraryBuiltInFilter) => void;
  readonly selectDefinition: (definition: AssetLibraryDefinitionCard) => Promise<void>;
  readonly refresh: () => Promise<void>;
}

const DEFAULT_FILTERS: AssetLibraryFiltersState = {
  searchText: "",
  assetType: "all",
  assetFamily: "all",
  lifecycleStatus: "all",
  builtIn: "all",
};

const DETAIL_EXPANSIONS = [
  "aiContext",
  "configurationSchema",
  "ports",
  "requirements",
  "provenance",
  "metadata",
] as const;

function createQuery(filters: AssetLibraryFiltersState): AssetLibraryQuery {
  const searchText = filters.searchText.trim();
  return {
    limit: 50,
    ...(searchText ? { searchText } : {}),
    ...(filters.assetType !== "all"
      ? { assetTypes: [filters.assetType as NonNullable<AssetLibraryQuery["assetTypes"]>[number]] }
      : {}),
    ...(filters.assetFamily !== "all"
      ? { assetFamilies: [filters.assetFamily as NonNullable<AssetLibraryQuery["assetFamilies"]>[number]] }
      : {}),
    ...(filters.lifecycleStatus !== "all"
      ? { lifecycleStatuses: [filters.lifecycleStatus as NonNullable<AssetLibraryQuery["lifecycleStatuses"]>[number]] }
      : {}),
    ...(filters.builtIn !== "all" ? { builtIn: filters.builtIn } : {}),
  };
}

function filtersAreActive(filters: AssetLibraryFiltersState): boolean {
  return (
    filters.searchText.trim().length > 0 ||
    filters.assetType !== "all" ||
    filters.assetFamily !== "all" ||
    filters.lifecycleStatus !== "all" ||
    filters.builtIn !== "all"
  );
}

export function useAssetLibraryFeature(client: AssetLibraryClient = createApiAssetLibraryClient()): AssetLibraryFeatureState {
  const [filters, setFilters] = useState<AssetLibraryFiltersState>(DEFAULT_FILTERS);
  const [definitions, setDefinitions] = useState<readonly AssetLibraryDefinitionCard[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | undefined>();
  const [selectedDetail, setSelectedDetail] = useState<AssetLibraryDefinitionDetail | undefined>();
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | undefined>();
  const [detailError, setDetailError] = useState<string | undefined>();
  const [diagnostics, setDiagnostics] = useState<readonly string[]>([]);

  const query = useMemo(() => createQuery(filters), [filters]);
  const hasActiveFilters = useMemo(() => filtersAreActive(filters), [filters]);

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    setListError(undefined);
    const result = await client.listAssetDefinitions(query);
    if (result.ok === false) {
      setDefinitions([]);
      setDiagnostics([]);
      setListError(result.error.message || "Unable to load Asset Library.");
      setSelectedDefinitionId(undefined);
      setSelectedDetail(undefined);
      setIsLoadingList(false);
      return;
    }

    setDefinitions(result.value.items);
    setDiagnostics((result.value.diagnostics ?? []).map((diagnostic) => diagnostic.message));
    setIsLoadingList(false);

    if (selectedDefinitionId && !result.value.items.some((item) => item.id === selectedDefinitionId)) {
      setSelectedDefinitionId(undefined);
      setSelectedDetail(undefined);
      setDetailError(undefined);
    }
  }, [client, query, selectedDefinitionId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const selectDefinition = useCallback(async (definition: AssetLibraryDefinitionCard) => {
    setSelectedDefinitionId(definition.id);
    setSelectedDetail(undefined);
    setDetailError(undefined);
    setIsLoadingDetail(true);

    const result = definition.version
      ? await client.readAssetDefinitionVersion(
        { definitionId: definition.definitionId, version: definition.version },
        { expand: DETAIL_EXPANSIONS, includeValidation: true },
      )
      : await client.readAssetDefinition(
        { definitionId: definition.definitionId },
        { expand: DETAIL_EXPANSIONS, includeValidation: true },
      );

    if (result.ok === true) {
      setSelectedDetail(result.value);
    } else {
      setDetailError(result.error.message || "Unable to load this asset.");
    }
    setIsLoadingDetail(false);
  }, [client]);

  return {
    filters,
    definitions,
    selectedDefinitionId,
    selectedDetail,
    isLoadingList,
    isLoadingDetail,
    listError,
    detailError,
    hasActiveFilters,
    diagnostics,
    setSearchText: (value) => setFilters((current) => ({ ...current, searchText: value })),
    setAssetType: (value) => setFilters((current) => ({ ...current, assetType: value })),
    setAssetFamily: (value) => setFilters((current) => ({ ...current, assetFamily: value })),
    setLifecycleStatus: (value) => setFilters((current) => ({ ...current, lifecycleStatus: value })),
    setBuiltIn: (value) => setFilters((current) => ({ ...current, builtIn: value })),
    selectDefinition,
    refresh: loadList,
  };
}
