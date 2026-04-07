import { useMemo, useState, type KeyboardEvent } from "react";
import { AssetSelectorSelectionModes } from "@domain/studio-shell/AssetSelectorContract";
import type { AssetSelectorSessionState } from "@application/studio-entry/AssetSelectorSessionStore";
import type { AssetSelectorResultItem } from "../../../studio-shell/asset-selector/AssetSelectorDataProvider";

export interface AssetSelectorShellProps {
  readonly title: string;
  readonly state: AssetSelectorSessionState;
  readonly searchTerm: string;
  readonly items: ReadonlyArray<AssetSelectorResultItem>;
  readonly loading: boolean;
  readonly error?: string;
  readonly onSearchTermChange: (searchTerm: string) => void;
  readonly onToggleSelection: (item: AssetSelectorResultItem) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly onCreateNew: () => void;
  readonly onRetry?: () => void;
  readonly renderItemMeta?: (item: AssetSelectorResultItem) => JSX.Element | undefined;
}

function getSelectionCountLabel(count: number): string {
  return count === 1 ? "1 selected" : `${count} selected`;
}

export default function AssetSelectorShell({
  title,
  state,
  searchTerm,
  items,
  loading,
  error,
  onSearchTermChange,
  onToggleSelection,
  onConfirm,
  onCancel,
  onCreateNew,
  onRetry,
  renderItemMeta,
}: AssetSelectorShellProps): JSX.Element {
  const [focusedResultIndex, setFocusedResultIndex] = useState(0);
  const selectedAssetIds = useMemo(
    () => new Set(state.pendingSelections.map((entry) => entry.assetId)),
    [state.pendingSelections],
  );
  const isMultiSelect = state.request.selectionMode === AssetSelectorSelectionModes.multiSelect;
  const selectedCount = state.pendingSelections.length;
  const minimumSelections = state.request.constraints.minSelections ?? (state.request.constraints.required ? 1 : 0);
  const confirmDisabled = selectedCount < minimumSelections;
  const showEmptyState = !loading && !error && items.length === 0;

  const handleResultsKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (items.length === 0) {
      if (event.key === "Escape") {
        onCancel();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedResultIndex((current) => (current + 1) % items.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedResultIndex((current) => (current - 1 + items.length) % items.length);
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!confirmDisabled) {
        onConfirm();
      }
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const focusedItem = items[focusedResultIndex];
      if (focusedItem) {
        onToggleSelection(focusedItem);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
  };

  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--sm ui-asset-selector-shell" data-testid="asset-selector-shell">
      <header className="ui-row ui-row--between ui-row--wrap">
        <div className="ui-stack ui-stack--2xs">
          <strong>{title}</strong>
          <span className="ui-text-small ui-text-secondary">
            {getSelectionCountLabel(selectedCount)} | {isMultiSelect ? "Multi-select" : "Single-select"}
          </span>
        </div>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={onCreateNew}
          data-testid="asset-selector-create-new"
        >
          Create new
        </button>
      </header>

      <label className="ui-field">
        <span className="ui-field__label">Search assets</span>
        <input
          className="ui-input"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Search assets"
          data-testid="asset-selector-search"
        />
      </label>

      {loading ? (
        <div className="ui-card ui-card--padded ui-asset-selector-shell__state" data-testid="asset-selector-loading">
          Loading assets...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="ui-card ui-card--padded ui-asset-selector-shell__state" data-testid="asset-selector-error">
          <p className="ui-text-danger">{error}</p>
          {onRetry ? (
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {showEmptyState ? (
        <div className="ui-card ui-card--padded ui-asset-selector-shell__state" data-testid="asset-selector-empty">
          No assets match the current selector criteria.
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul
          className="ui-stack ui-stack--2xs ui-asset-selector-shell__results"
          role="listbox"
          aria-multiselectable={isMultiSelect}
          tabIndex={0}
          onKeyDown={handleResultsKeyDown}
          data-testid="asset-selector-results"
        >
          {items.map((item, index) => {
            const selected = selectedAssetIds.has(item.asset.assetId);
            const focused = index === focusedResultIndex;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`ui-button ui-button--ghost ui-asset-selector-shell__result ${selected ? "ui-asset-selector-shell__result--selected" : ""}`}
                  onClick={() => {
                    setFocusedResultIndex(index);
                    onToggleSelection(item);
                  }}
                  aria-selected={selected}
                  data-focused={focused ? "1" : "0"}
                  data-testid={`asset-selector-item-${index}`}
                >
                  <span className="ui-asset-selector-shell__result-copy">
                    <span className="ui-asset-selector-shell__result-title">{item.title}</span>
                    {item.subtitle ? <span className="ui-text-small ui-text-secondary">{item.subtitle}</span> : null}
                    {item.description ? <span className="ui-text-small ui-text-muted">{item.description}</span> : null}
                    {item.badges && item.badges.length > 0 ? (
                      <span className="ui-chips">
                        {item.badges.map((badge) => (
                          <span key={`${item.id}:${badge}`} className="ui-badge">{badge}</span>
                        ))}
                      </span>
                    ) : null}
                    {renderItemMeta ? renderItemMeta(item) : null}
                  </span>
                  <span className={`ui-badge ${selected ? "ui-badge--success" : ""}`}>
                    {selected ? "Selected" : "Select"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {state.validationErrors.length > 0 ? (
        <ul className="ui-stack ui-stack--2xs" data-testid="asset-selector-validation-errors">
          {state.validationErrors.map((entry, index) => (
            <li key={`${entry.code}:${index}`} className="ui-text-small ui-text-danger">{entry.message}</li>
          ))}
        </ul>
      ) : null}

      <footer className="ui-row ui-row--between ui-row--wrap ui-asset-selector-shell__actions">
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--sm"
          onClick={onCancel}
          data-testid="asset-selector-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className="ui-button ui-button--primary ui-button--sm"
          onClick={onConfirm}
          disabled={confirmDisabled}
          data-testid="asset-selector-confirm"
        >
          Confirm selection
        </button>
      </footer>
    </section>
  );
}

