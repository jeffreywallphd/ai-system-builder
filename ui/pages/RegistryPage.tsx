import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ExploreAssetSummary, ExploreFacet, ExploreFilterSet } from "../../application/asset-registry/ExploreAssetQueryService";
import { ExploreAssetList } from "../components/explore/ExploreAssetList";
import { ExploreFilterPanel } from "../components/explore/ExploreFilterPanel";
import { SearchBar } from "../components/registry/SearchBar";
import { RegistryService } from "../services/RegistryService";

const defaultFilterState: ExploreFilterSet = Object.freeze({
  kinds: Object.freeze([]),
  sourceTypes: Object.freeze([]),
  statuses: Object.freeze([]),
  semanticRoles: Object.freeze([]),
  behaviorKinds: Object.freeze([]),
});

function parseList<T extends string>(value: string | null): ReadonlyArray<T> {
  if (!value) {
    return [];
  }
  return value.split(",").map((entry) => entry.trim()).filter(Boolean) as ReadonlyArray<T>;
}

function parseFromSearch(params: URLSearchParams): { readonly filters: ExploreFilterSet; readonly limit: number; readonly keyword: string } {
  const parsedLimit = Number(params.get("limit"));
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
  return {
    filters: Object.freeze({
      kinds: Object.freeze(parseList(params.get("kinds"))),
      sourceTypes: Object.freeze(parseList(params.get("sourceTypes"))),
      statuses: Object.freeze(parseList(params.get("statuses"))),
      semanticRoles: Object.freeze(parseList(params.get("semanticRoles"))),
      behaviorKinds: Object.freeze(parseList(params.get("behaviorKinds"))),
    }),
    limit,
    keyword: params.get("q")?.trim() ?? "",
  };
}

function toSearchParams(filters: ExploreFilterSet, limit: number, keyword: string): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.kinds?.length) {
    params.set("kinds", filters.kinds.join(","));
  }
  if (filters.sourceTypes?.length) {
    params.set("sourceTypes", filters.sourceTypes.join(","));
  }
  if (filters.statuses?.length) {
    params.set("statuses", filters.statuses.join(","));
  }
  if (filters.semanticRoles?.length) {
    params.set("semanticRoles", filters.semanticRoles.join(","));
  }
  if (filters.behaviorKinds?.length) {
    params.set("behaviorKinds", filters.behaviorKinds.join(","));
  }
  if (keyword.trim()) {
    params.set("q", keyword.trim());
  }
  params.set("limit", String(limit));
  return params;
}

export default function RegistryPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialState = useMemo(() => parseFromSearch(searchParams), [searchParams]);
  const service = useMemo(() => new RegistryService(), []);
  const [filters, setFilters] = useState<ExploreFilterSet>(initialState.filters ?? defaultFilterState);
  const [limit, setLimit] = useState(initialState.limit ?? 100);
  const [keyword, setKeyword] = useState(initialState.keyword ?? "");
  const [assets, setAssets] = useState<ReadonlyArray<ExploreAssetSummary>>([]);
  const [facets, setFacets] = useState<ReadonlyArray<ExploreFacet>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setSearchParams(toSearchParams(filters, limit, keyword), { replace: true });
  }, [filters, limit, keyword, setSearchParams]);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      const response = await service.searchExploreAssets({
        keyword,
        filters,
        limit,
      });
      if (!active) {
        return;
      }
      if (!response.ok || !response.data) {
        setAssets([]);
        setFacets([]);
        setError(response.error?.message ?? "Failed to load registry assets.");
        setIsLoading(false);
        return;
      }
      setAssets(response.data.assets);
      setFacets(response.data.facets);
      setError(undefined);
      setIsLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [filters, limit, keyword, service]);

  return (
    <section className="ui-page ui-stack ui-stack--md" data-testid="registry-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Registry</h1>
          <p className="ui-page__subtitle">
            Explore a unified asset library across atomic, composite, and system assets with intent-friendly metadata-first filtering.
          </p>
        </div>
      </div>

      <div className="ui-grid" style={{ gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", gap: "1rem" }}>
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-stack ui-stack--2xs">
              <h2 style={{ margin: 0 }}>Explore filters</h2>
              <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
                Search and filters are applied together. Asset kind/source/status are primary; taxonomy facets are secondary in advanced filters.
              </p>
            </div>
            <SearchBar value={keyword} onChange={setKeyword} />
            <ExploreFilterPanel value={filters} facets={facets} onChange={setFilters} />
            <label className="ui-stack ui-stack--2xs">
              <span className="ui-text-small">Max results</span>
              <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>Explore results</h2>
              <span className="ui-text-small ui-text-secondary">Showing {assets.length} result(s)</span>
            </div>
            <ExploreAssetList
              assets={assets}
              isLoading={isLoading}
              error={error}
              registryContextQuery={toSearchParams(filters, limit, keyword).toString()}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
