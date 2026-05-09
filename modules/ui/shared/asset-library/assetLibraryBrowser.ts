import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AssetFamily,
  AssetLifecycleStatus,
  AssetType,
} from "../../../contracts/asset";
import {
  isAssetFamily,
  isAssetLifecycleStatus,
  isAssetType,
} from "../../../contracts/asset";
import type { AssetLibraryBuiltInFilter, AssetLibraryQuery } from "./assetLibraryQueries";
import type {
  AssetLibraryClient,
  AssetLibraryDefinitionCard,
  AssetLibraryDefinitionDetail,
  AssetLibraryResourceBackedViewCard,
  AssetLibraryResourceBackedViewDetail,
} from "./assetLibraryReadModels";
import { sanitizeAssetLibraryDisplayText } from "./assetLibraryMappers";

export type AssetLibraryBrowserTab = "definitions" | "resource-views";

export type AssetLibraryFilterValue = "all" | string;

export interface AssetLibraryFiltersState {
  readonly searchText: string;
  readonly assetType: AssetLibraryFilterValue;
  readonly assetFamily: AssetLibraryFilterValue;
  readonly lifecycleStatus: AssetLibraryFilterValue;
  readonly builtIn: AssetLibraryBuiltInFilter;
}

export interface AssetLibraryFeatureState {
  readonly client: AssetLibraryClient;
  readonly activeTab: AssetLibraryBrowserTab;
  readonly filters: AssetLibraryFiltersState;
  readonly definitions: readonly AssetLibraryDefinitionCard[];
  readonly resourceBackedViews: readonly AssetLibraryResourceBackedViewCard[];
  readonly selectedDefinitionId?: string;
  readonly selectedResourceBackedViewId?: string;
  readonly selectedDetail?: AssetLibraryDefinitionDetail;
  readonly selectedResourceBackedViewDetail?: AssetLibraryResourceBackedViewDetail;
  readonly isLoadingList: boolean;
  readonly isLoadingDetail: boolean;
  readonly isLoadingValidation: boolean;
  readonly listError?: string;
  readonly detailError?: string;
  readonly validationError?: string;
  readonly hasActiveFilters: boolean;
  readonly diagnostics: readonly string[];
  readonly setSearchText: (value: string) => void;
  readonly setAssetType: (value: AssetLibraryFilterValue) => void;
  readonly setAssetFamily: (value: AssetLibraryFilterValue) => void;
  readonly setLifecycleStatus: (value: AssetLibraryFilterValue) => void;
  readonly setBuiltIn: (value: AssetLibraryBuiltInFilter) => void;
  readonly setActiveTab: (value: AssetLibraryBrowserTab) => void;
  readonly selectDefinition: (definition: AssetLibraryDefinitionCard) => Promise<void>;
  readonly selectResourceBackedView: (view: AssetLibraryResourceBackedViewCard) => Promise<void>;
  readonly loadValidationDetails: () => Promise<void>;
  readonly refresh: () => Promise<void>;
}

export const ASSET_LIBRARY_DEFAULT_FILTERS: AssetLibraryFiltersState = {
  searchText: "",
  assetType: "all",
  assetFamily: "all",
  lifecycleStatus: "all",
  builtIn: "all",
};

export const ASSET_LIBRARY_DETAIL_EXPANSIONS = [
  "aiContext",
  "configurationSchema",
  "ports",
  "requirements",
  "provenance",
  "metadata",
] as const;

export function createAssetLibraryQuery(filters: AssetLibraryFiltersState): AssetLibraryQuery {
  const searchText = filters.searchText.trim();
  return {
    limit: 50,
    ...(searchText ? { searchText } : {}),
    ...(filters.assetType !== "all" && isAssetType(filters.assetType) ? { assetTypes: [filters.assetType as AssetType] } : {}),
    ...(filters.assetFamily !== "all" && isAssetFamily(filters.assetFamily)
      ? { assetFamilies: [filters.assetFamily as AssetFamily] }
      : {}),
    ...(filters.lifecycleStatus !== "all" && isAssetLifecycleStatus(filters.lifecycleStatus)
      ? { lifecycleStatuses: [filters.lifecycleStatus as AssetLifecycleStatus] }
      : {}),
    ...(filters.builtIn !== "all" ? { builtIn: filters.builtIn } : {}),
  };
}

export function assetLibraryFiltersAreActive(filters: AssetLibraryFiltersState): boolean {
  return (
    filters.searchText.trim().length > 0 ||
    filters.assetType !== "all" ||
    filters.assetFamily !== "all" ||
    filters.lifecycleStatus !== "all" ||
    filters.builtIn !== "all"
  );
}

export function useAssetLibraryDefinitionBrowser(client: AssetLibraryClient): AssetLibraryFeatureState {
  const [filters, setFilters] = useState<AssetLibraryFiltersState>(ASSET_LIBRARY_DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<AssetLibraryBrowserTab>("definitions");
  const [definitions, setDefinitions] = useState<readonly AssetLibraryDefinitionCard[]>([]);
  const [resourceBackedViews, setResourceBackedViews] = useState<readonly AssetLibraryResourceBackedViewCard[]>([]);
  const [selectedDefinition, setSelectedDefinition] = useState<AssetLibraryDefinitionCard | undefined>();
  const [selectedResourceBackedView, setSelectedResourceBackedView] = useState<AssetLibraryResourceBackedViewCard | undefined>();
  const [selectedDetail, setSelectedDetail] = useState<AssetLibraryDefinitionDetail | undefined>();
  const [selectedResourceBackedViewDetail, setSelectedResourceBackedViewDetail] = useState<AssetLibraryResourceBackedViewDetail | undefined>();
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingValidation, setIsLoadingValidation] = useState(false);
  const [listError, setListError] = useState<string | undefined>();
  const [detailError, setDetailError] = useState<string | undefined>();
  const [validationError, setValidationError] = useState<string | undefined>();
  const [diagnostics, setDiagnostics] = useState<readonly string[]>([]);

  const query = useMemo(() => createAssetLibraryQuery(filters), [filters]);
  const hasActiveFilters = useMemo(() => assetLibraryFiltersAreActive(filters), [filters]);

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    setListError(undefined);
    const result = await client.listAssetDefinitions(query);
    const resourceResult = await client.listAssetResourceBackedViews({
      searchText: query.searchText,
      assetTypes: query.assetTypes,
      assetFamilies: query.assetFamilies,
      lifecycleStatuses: query.lifecycleStatuses,
      limit: query.limit,
      cursor: query.cursor,
    });
    if (result.ok === false) {
      setDefinitions([]);
      setResourceBackedViews(resourceResult.ok === true ? resourceResult.value.items : []);
      setDiagnostics([]);
      setListError(result.error.message || "Unable to load Asset Library.");
      setSelectedDefinition(undefined);
      setSelectedDetail(undefined);
      setIsLoadingList(false);
      return;
    }

    setDefinitions(result.value.items);
    if (resourceResult.ok === true) {
      setResourceBackedViews(resourceResult.value.items);
    } else {
      setResourceBackedViews([]);
    }
    setDiagnostics([
      ...(result.value.diagnostics ?? []).map((diagnostic) => diagnostic.message).map(safeDisplayText).filter(isString),
      ...(resourceResult.ok === true
        ? (resourceResult.value.diagnostics ?? []).map((diagnostic) => diagnostic.message).map(safeDisplayText).filter(isString)
        : [safeDisplayText(resourceResult.error.message) ?? "Unable to load resource-backed views."]),
    ]);
    setIsLoadingList(false);

    if (selectedDefinition && !result.value.items.some((item) => item.id === selectedDefinition.id)) {
      setSelectedDefinition(undefined);
      setSelectedDetail(undefined);
      setDetailError(undefined);
      setValidationError(undefined);
    }
    if (selectedResourceBackedView && resourceResult.ok === true && !resourceResult.value.items.some((item) => item.id === selectedResourceBackedView.id)) {
      setSelectedResourceBackedView(undefined);
      setSelectedResourceBackedViewDetail(undefined);
      setDetailError(undefined);
      setValidationError(undefined);
    }
  }, [client, query, selectedDefinition, selectedResourceBackedView]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const readDetail = useCallback(async (
    definition: AssetLibraryDefinitionCard,
    options: { readonly includeValidation?: boolean },
  ) => {
    return definition.version
      ? client.readAssetDefinitionVersion(
        { definitionId: definition.definitionId, version: definition.version },
        { expand: ASSET_LIBRARY_DETAIL_EXPANSIONS, ...(options.includeValidation ? { includeValidation: true } : {}) },
      )
      : client.readAssetDefinition(
        { definitionId: definition.definitionId },
        { expand: ASSET_LIBRARY_DETAIL_EXPANSIONS, ...(options.includeValidation ? { includeValidation: true } : {}) },
      );
  }, [client]);

  const selectDefinition = useCallback(async (definition: AssetLibraryDefinitionCard) => {
    setActiveTab("definitions");
    setSelectedDefinition(definition);
    setSelectedResourceBackedView(undefined);
    setSelectedResourceBackedViewDetail(undefined);
    setSelectedDetail(undefined);
    setDetailError(undefined);
    setValidationError(undefined);
    setIsLoadingDetail(true);

    const result = await readDetail(definition, {});

    if (result.ok === true) {
      setSelectedDetail(result.value);
    } else {
      setDetailError(result.error.message || "Unable to load this asset.");
    }
    setIsLoadingDetail(false);
  }, [readDetail]);

  const selectResourceBackedView = useCallback(async (view: AssetLibraryResourceBackedViewCard) => {
    setActiveTab("resource-views");
    setSelectedResourceBackedView(view);
    setSelectedDefinition(undefined);
    setSelectedDetail(undefined);
    setDetailError(undefined);
    setValidationError(undefined);
    setIsLoadingDetail(true);

    const result = await client.readAssetResourceBackedView(
      { viewId: view.viewId },
      { expand: ["metadata", "resourceBackings"] },
    );

    if (result.ok === true) {
      setSelectedResourceBackedViewDetail(result.value);
    } else {
      setDetailError(safeDisplayText(result.error.message) ?? "Unable to load this resource-backed view.");
    }
    setIsLoadingDetail(false);
  }, [client]);

  const loadValidationDetails = useCallback(async () => {
    if (!selectedDefinition) return;
    setValidationError(undefined);
    setIsLoadingValidation(true);

    const result = await readDetail(selectedDefinition, { includeValidation: true });
    if (result.ok === true) {
      setSelectedDetail(result.value);
    } else {
      setValidationError(result.error.message || "Unable to load validation details.");
    }
    setIsLoadingValidation(false);
  }, [readDetail, selectedDefinition]);

  return {
    client,
    filters,
    activeTab,
    definitions,
    resourceBackedViews,
    selectedDefinitionId: selectedDefinition?.id,
    selectedResourceBackedViewId: selectedResourceBackedView?.id,
    selectedDetail,
    selectedResourceBackedViewDetail,
    isLoadingList,
    isLoadingDetail,
    isLoadingValidation,
    listError,
    detailError,
    validationError,
    hasActiveFilters,
    diagnostics,
    setSearchText: (value) => setFilters((current) => ({ ...current, searchText: value })),
    setAssetType: (value) => setFilters((current) => ({ ...current, assetType: value })),
    setAssetFamily: (value) => setFilters((current) => ({ ...current, assetFamily: value })),
    setLifecycleStatus: (value) => setFilters((current) => ({ ...current, lifecycleStatus: value })),
    setBuiltIn: (value) => setFilters((current) => ({ ...current, builtIn: value })),
    setActiveTab,
    selectDefinition,
    selectResourceBackedView,
    loadValidationDetails,
    refresh: loadList,
  };
}

function safeDisplayText(value: unknown): string | undefined {
  return sanitizeAssetLibraryDisplayText(value);
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}
