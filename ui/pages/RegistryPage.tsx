import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { RegistryFilterParams } from "../../application/asset-registry/RegistryQueryService";
import type { RegistryAsset } from "../../domain/asset-registry/RegistryAsset";
import { AssetFilterPanel, type RegistryFilterState } from "../components/registry/AssetFilterPanel";
import { AssetList } from "../components/registry/AssetList";
import { SearchBar } from "../components/registry/SearchBar";
import { RegistryService } from "../services/RegistryService";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds, type TaxonomyBehaviorKind, type TaxonomySemanticRole, type TaxonomyStructuralKind } from "../../domain/taxonomy/CompositionTaxonomy";

const defaultFilterState: RegistryFilterState = Object.freeze({
  structuralKinds: Object.freeze([]),
  semanticRoles: Object.freeze([]),
  behaviorKinds: Object.freeze([]),
});

function toFilterParams(filters: RegistryFilterState, limit: number): RegistryFilterParams {
  return Object.freeze({
    structuralKinds: filters.structuralKinds.length > 0 ? filters.structuralKinds : undefined,
    semanticRoles: filters.semanticRoles.length > 0 ? filters.semanticRoles : undefined,
    behaviorKinds: filters.behaviorKinds.length > 0 ? filters.behaviorKinds : undefined,
    limit,
  });
}

const allowedStructuralKinds = new Set<TaxonomyStructuralKind>(Object.values(TaxonomyStructuralKinds));
const allowedSemanticRoles = new Set<TaxonomySemanticRole>(Object.values(TaxonomySemanticRoles));
const allowedBehaviorKinds = new Set<TaxonomyBehaviorKind>(Object.values(TaxonomyBehaviorKinds));

function parseList<T extends string>(value: string | null, allowed: ReadonlySet<T>): ReadonlyArray<T> {
  if (!value) {
    return [];
  }
  return value.split(",").map((entry) => entry.trim()).filter((entry): entry is T => allowed.has(entry as T));
}

function parseFromSearch(params: URLSearchParams): { readonly filters: RegistryFilterState; readonly limit: number; readonly keyword: string } {
  const parsedLimit = Number(params.get("limit"));
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
  return {
    filters: Object.freeze({
      structuralKinds: Object.freeze(parseList(params.get("structuralKinds"), allowedStructuralKinds)),
      semanticRoles: Object.freeze(parseList(params.get("semanticRoles"), allowedSemanticRoles)),
      behaviorKinds: Object.freeze(parseList(params.get("behaviorKinds"), allowedBehaviorKinds)),
    }),
    limit,
    keyword: params.get("q")?.trim() ?? "",
  };
}

function toSearchParams(filters: RegistryFilterState, limit: number, keyword: string): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.structuralKinds.length) {
    params.set("structuralKinds", filters.structuralKinds.join(","));
  }
  if (filters.semanticRoles.length) {
    params.set("semanticRoles", filters.semanticRoles.join(","));
  }
  if (filters.behaviorKinds.length) {
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
  const [filters, setFilters] = useState<RegistryFilterState>(initialState.filters ?? defaultFilterState);
  const [limit, setLimit] = useState(initialState.limit ?? 100);
  const [keyword, setKeyword] = useState(initialState.keyword ?? "");
  const [assets, setAssets] = useState<ReadonlyArray<RegistryAsset>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setSearchParams(toSearchParams(filters, limit, keyword), { replace: true });
  }, [filters, limit, keyword, setSearchParams]);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      const response = keyword.trim()
        ? await service.searchAssets({
          keyword,
          structuralKinds: filters.structuralKinds.length > 0 ? filters.structuralKinds : undefined,
          semanticRoles: filters.semanticRoles.length > 0 ? filters.semanticRoles : undefined,
          behaviorKinds: filters.behaviorKinds.length > 0 ? filters.behaviorKinds : undefined,
          limit,
        })
        : await service.filterAssets(toFilterParams(filters, limit));
      if (!active) {
        return;
      }
      if (!response.ok || !response.data) {
        setAssets([]);
        setError(response.error?.message ?? "Failed to load registry assets.");
        setIsLoading(false);
        return;
      }
      setAssets(response.data);
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
            Browse cross-studio assets through the shared registry API with clear taxonomy filters.
          </p>
        </div>
      </div>

      <div className="ui-grid" style={{ gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", gap: "1rem" }}>
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-stack ui-stack--2xs">
              <h2 style={{ margin: 0 }}>Filters</h2>
              <p className="ui-text-small ui-text-secondary" style={{ margin: 0 }}>
                Structural kind is always visible; semantic role and behavior are in advanced filters.
              </p>
            </div>
            <SearchBar value={keyword} onChange={setKeyword} disabled={isLoading} />
            <AssetFilterPanel value={filters} onChange={setFilters} disabled={isLoading} />
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
              <h2 style={{ margin: 0 }}>Assets</h2>
              <span className="ui-text-small ui-text-secondary">Showing {assets.length} result(s)</span>
            </div>
            <AssetList
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
