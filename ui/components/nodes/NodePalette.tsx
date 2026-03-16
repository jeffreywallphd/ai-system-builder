import { useMemo, useState, type FormEvent } from "react";
import type { NodePaletteItemViewModel } from "../../presenters/NodePresenter";
import NodePaletteItem from "./NodePaletteItem";

export interface NodePaletteProps {
  readonly items: ReadonlyArray<NodePaletteItemViewModel>;
  readonly categories?: ReadonlyArray<string>;
  readonly selectedDefinitionId?: string;
  readonly isLoading?: boolean;
  readonly onSelect?: (definitionId: string) => void;
  readonly onAdd?: (definitionId: string) => void;
  readonly onSearch?: (query: string, category?: string) => void;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export default function NodePalette({
  items,
  categories,
  selectedDefinitionId,
  isLoading,
  onSelect,
  onAdd,
  onSearch,
}: NodePaletteProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const effectiveCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories;
    }

    return [...new Set(items.map((item) => item.category))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [categories, items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query);
    const normalizedCategory = normalize(categoryFilter);

    return items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        normalize(item.title).includes(normalizedQuery) ||
        normalize(item.type).includes(normalizedQuery) ||
        normalize(item.category).includes(normalizedQuery) ||
        normalize(item.executionKind).includes(normalizedQuery) ||
        normalize(item.description ?? "").includes(normalizedQuery);

      const matchesCategory = !normalizedCategory || normalize(item.category) === normalizedCategory;

      return matchesQuery && matchesCategory;
    });
  }, [items, query, categoryFilter]);

  const submitSearch = (event: FormEvent): void => {
    event.preventDefault();
    onSearch?.(query.trim(), categoryFilter || undefined);
  };

  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Node Palette</div>
          <div className="ui-panel__subtitle">Browse and add available node definitions.</div>
        </div>
      </div>

      <div className="ui-panel__body ui-stack ui-stack--md">
        <form className="ui-stack ui-stack--sm" onSubmit={submitSearch}>
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="node-palette-search">
              Search Nodes
            </label>
            <input
              id="node-palette-search"
              className="ui-input"
              type="text"
              value={query}
              placeholder="Search by title, type, category, or description"
              onChange={(event) => setQuery(event.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="ui-row ui-row--wrap">
            <div className="ui-field" style={{ minWidth: "180px", flex: "1 1 180px" }}>
              <label className="ui-field__label" htmlFor="node-palette-category">
                Category
              </label>
              <select
                id="node-palette-category"
                className="ui-select"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                disabled={isLoading}
              >
                <option value="">All Categories</option>
                {effectiveCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-row ui-row--wrap" style={{ alignSelf: "end" }}>
              <button
                type="submit"
                className={`ui-button ui-button--secondary ui-button--md${
                  isLoading ? " ui-button--loading" : ""
                }`}
                disabled={isLoading}
              >
                <span className="ui-button__label">
                  {isLoading ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
                  Filter
                </span>
              </button>

              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--md"
                disabled={isLoading}
                onClick={() => {
                  setQuery("");
                  setCategoryFilter("");
                  onSearch?.("", undefined);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </form>

        <div className="ui-row ui-row--between ui-row--wrap">
          <span className="ui-text-secondary ui-text-small">
            {isLoading ? "Loading nodes…" : `${filteredItems.length} node definitions`}
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">No node definitions match the current filters.</p>
          </div>
        ) : (
          <div className="ui-stack ui-stack--sm">
            {filteredItems.map((item) => (
              <NodePaletteItem
                key={item.id}
                item={item}
                isSelected={selectedDefinitionId === item.id}
                onSelect={onSelect}
                onAdd={onAdd}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
