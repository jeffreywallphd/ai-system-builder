import type { AssetLibraryBuiltInFilter } from "../../../../../../modules/ui/shared/asset-library";
import type { AssetLibraryFilterValue, AssetLibraryFiltersState } from "../hooks/useAssetLibraryFeature";

interface AssetLibraryFiltersProps {
  readonly filters: AssetLibraryFiltersState;
  readonly onSearchTextChange: (value: string) => void;
  readonly onAssetTypeChange: (value: AssetLibraryFilterValue) => void;
  readonly onAssetFamilyChange: (value: AssetLibraryFilterValue) => void;
  readonly onLifecycleStatusChange: (value: AssetLibraryFilterValue) => void;
  readonly onBuiltInChange: (value: AssetLibraryBuiltInFilter) => void;
  readonly onRefresh: () => void;
  readonly isRefreshing: boolean;
}

const ASSET_TYPE_OPTIONS = [
  "adapter-binding",
  "data-source",
  "dataset",
  "document",
  "feature",
  "image",
  "model",
  "page",
  "policy",
  "prompt-template",
  "schema",
  "subsystem",
  "system",
  "test",
  "tool",
  "ui-component",
  "workflow",
  "workflow-step",
] as const;

const ASSET_FAMILY_OPTIONS = [
  "behavioral",
  "composition",
  "context",
  "resource-backed",
  "structural",
] as const;

const LIFECYCLE_STATUS_OPTIONS = [
  "archived",
  "deprecated",
  "draft",
  "failed-validation",
  "published",
  "validated",
] as const;

function formatLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AssetLibraryFilters({
  filters,
  onSearchTextChange,
  onAssetTypeChange,
  onAssetFamilyChange,
  onLifecycleStatusChange,
  onBuiltInChange,
  onRefresh,
  isRefreshing,
}: AssetLibraryFiltersProps) {
  return (
    <form className="asset-library-toolbar" onSubmit={(event) => event.preventDefault()}>
      <label className="ui-stack ui-stack--sm">
        <span className="ui-label">Search assets</span>
        <input
          className="ui-input asset-library-toolbar__search"
          type="search"
          value={filters.searchText}
          placeholder="Search by name or summary"
          onChange={(event) => onSearchTextChange(event.currentTarget.value)}
        />
      </label>

      <label className="ui-stack ui-stack--sm">
        <span className="ui-label">Type</span>
        <select className="ui-input" value={filters.assetType} onChange={(event) => onAssetTypeChange(event.currentTarget.value)}>
          <option value="all">All types</option>
          {ASSET_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>{formatLabel(option)}</option>
          ))}
        </select>
      </label>

      <label className="ui-stack ui-stack--sm">
        <span className="ui-label">Family</span>
        <select className="ui-input" value={filters.assetFamily} onChange={(event) => onAssetFamilyChange(event.currentTarget.value)}>
          <option value="all">All families</option>
          {ASSET_FAMILY_OPTIONS.map((option) => (
            <option key={option} value={option}>{formatLabel(option)}</option>
          ))}
        </select>
      </label>

      <label className="ui-stack ui-stack--sm">
        <span className="ui-label">Status</span>
        <select className="ui-input" value={filters.lifecycleStatus} onChange={(event) => onLifecycleStatusChange(event.currentTarget.value)}>
          <option value="all">All statuses</option>
          {LIFECYCLE_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>{formatLabel(option)}</option>
          ))}
        </select>
      </label>

      <label className="ui-stack ui-stack--sm">
        <span className="ui-label">Source</span>
        <select
          className="ui-input"
          value={filters.builtIn}
          onChange={(event) => onBuiltInChange(event.currentTarget.value as AssetLibraryBuiltInFilter)}
        >
          <option value="all">Built-in and custom</option>
          <option value="built-in">Built-in</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      <button className="ui-button asset-library-toolbar__refresh" type="button" onClick={onRefresh} disabled={isRefreshing}>
        Refresh
      </button>
    </form>
  );
}
