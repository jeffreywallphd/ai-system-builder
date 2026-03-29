import { ExploreAssetKinds, type ExploreFacet, type ExploreFilterSet } from "../../../application/asset-registry/ExploreAssetQueryService";

export interface ExploreFilterPanelProps {
  readonly value: ExploreFilterSet;
  readonly facets: ReadonlyArray<ExploreFacet>;
  readonly onChange: (next: ExploreFilterSet) => void;
  readonly disabled?: boolean;
}

const emptyFilterSet: ExploreFilterSet = Object.freeze({
  kinds: Object.freeze([]),
  sourceTypes: Object.freeze([]),
  statuses: Object.freeze([]),
  semanticRoles: Object.freeze([]),
  behaviorKinds: Object.freeze([]),
});

function toggleValue<T extends string>(values: ReadonlyArray<T> | undefined, value: T): ReadonlyArray<T> {
  const current = values ?? [];
  return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
}

function resolveFacetOptions(facets: ReadonlyArray<ExploreFacet>, key: ExploreFacet["key"]): ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }> {
  return facets.find((facet) => facet.key === key)?.options ?? [];
}

function FilterGroup(props: {
  readonly title: string;
  readonly selected: ReadonlyArray<string> | undefined;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }>;
  readonly disabled?: boolean;
  readonly onToggle: (value: string) => void;
}): JSX.Element {
  return (
    <fieldset className="ui-stack ui-stack--2xs" style={{ border: "none", margin: 0, padding: 0 }}>
      <legend className="ui-text-small" style={{ fontWeight: 600 }}>{props.title}</legend>
      {props.options.map((option) => (
        <label key={option.value} className="ui-row ui-row--wrap" style={{ alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={(props.selected ?? []).includes(option.value)}
            onChange={() => props.onToggle(option.value)}
            disabled={props.disabled}
          />
          <span>{option.label} <span className="ui-text-small ui-text-secondary">({option.count})</span></span>
        </label>
      ))}
    </fieldset>
  );
}

export function ExploreFilterPanel({ value, facets, onChange, disabled }: ExploreFilterPanelProps): JSX.Element {
  const kindFacetOptions = resolveFacetOptions(facets, "kind").map((entry) => ({
    ...entry,
    label: entry.value === ExploreAssetKinds.atomic
      ? "Atomic"
      : entry.value === ExploreAssetKinds.composite
        ? "Composite"
        : entry.value === ExploreAssetKinds.system
          ? "System"
          : "Unknown",
  }));
  const sourceFacetOptions = resolveFacetOptions(facets, "sourceType");
  const statusFacetOptions = resolveFacetOptions(facets, "status");
  const roleFacetOptions = resolveFacetOptions(facets, "semanticRole");
  const behaviorFacetOptions = resolveFacetOptions(facets, "behaviorKind");
  const activeFilterCount = (value.kinds?.length ?? 0)
    + (value.sourceTypes?.length ?? 0)
    + (value.statuses?.length ?? 0)
    + (value.semanticRoles?.length ?? 0)
    + (value.behaviorKinds?.length ?? 0);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="explore-filter-panel">
      <div className="ui-row ui-row--wrap" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="ui-text-small ui-text-secondary">{activeFilterCount} active filter(s)</span>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--small"
          onClick={() => onChange(emptyFilterSet)}
          disabled={disabled || activeFilterCount === 0}
        >
          Clear filters
        </button>
      </div>

      <FilterGroup
        title="Asset kind"
        selected={value.kinds as ReadonlyArray<string> | undefined}
        options={kindFacetOptions}
        disabled={disabled}
        onToggle={(entry) => onChange({ ...value, kinds: toggleValue(value.kinds, entry as typeof ExploreAssetKinds[keyof typeof ExploreAssetKinds]) })}
      />

      <FilterGroup
        title="Source"
        selected={value.sourceTypes}
        options={sourceFacetOptions}
        disabled={disabled}
        onToggle={(entry) => onChange({ ...value, sourceTypes: toggleValue(value.sourceTypes, entry) })}
      />

      <FilterGroup
        title="Status"
        selected={value.statuses}
        options={statusFacetOptions}
        disabled={disabled}
        onToggle={(entry) => onChange({ ...value, statuses: toggleValue(value.statuses, entry) })}
      />

      <details>
        <summary>Advanced metadata filters</summary>
        <div className="ui-stack ui-stack--sm" style={{ marginTop: "0.5rem" }}>
          <FilterGroup
            title="Taxonomy role"
            selected={value.semanticRoles as ReadonlyArray<string> | undefined}
            options={roleFacetOptions}
            disabled={disabled}
            onToggle={(entry) => onChange({ ...value, semanticRoles: toggleValue(value.semanticRoles, entry as never) })}
          />
          <FilterGroup
            title="Taxonomy behavior"
            selected={value.behaviorKinds as ReadonlyArray<string> | undefined}
            options={behaviorFacetOptions}
            disabled={disabled}
            onToggle={(entry) => onChange({ ...value, behaviorKinds: toggleValue(value.behaviorKinds, entry as never) })}
          />
        </div>
      </details>
    </div>
  );
}
