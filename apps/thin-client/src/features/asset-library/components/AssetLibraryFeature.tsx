import type { AssetLibraryClient } from "../../../../../../modules/ui/shared/asset-library";
import {
  getAssetLibraryFamilyLabel,
  getAssetLibraryLifecycleStatusLabel,
  getAssetLibraryTypeLabel,
  type AssetLibraryResourceBackedViewCard,
  type AssetLibraryResourceBackedViewDetail,
} from "../../../../../../modules/ui/shared/asset-library";
import { AssetDefinitionDetailPanel } from "./AssetDefinitionDetailPanel";
import { AssetDefinitionList } from "./AssetDefinitionList";
import { AssetLibraryFilters } from "./AssetLibraryFilters";
import { useAssetLibraryFeature } from "../hooks/useAssetLibraryFeature";

interface AssetLibraryFeatureProps {
  readonly client?: AssetLibraryClient;
}

export function AssetLibraryFeature({ client }: AssetLibraryFeatureProps) {
  const state = useAssetLibraryFeature(client);

  return (
    <section className="asset-library-feature ui-stack ui-stack--lg">
      <AssetLibraryFilters
        filters={state.filters}
        onSearchTextChange={state.setSearchText}
        onAssetTypeChange={state.setAssetType}
        onAssetFamilyChange={state.setAssetFamily}
        onLifecycleStatusChange={state.setLifecycleStatus}
        onBuiltInChange={state.setBuiltIn}
        onRefresh={() => {
          void state.refresh();
        }}
        isRefreshing={state.isLoadingList}
      />

      {state.isLoadingList ? <div className="ui-status" role="status">Loading asset definitions...</div> : null}
      {state.listError ? <div className="ui-status" role="alert">{state.listError}</div> : null}
      {state.diagnostics.length > 0 ? (
        <div className="ui-status" role="status">
          {state.diagnostics.join(" ")}
        </div>
      ) : null}

      <div className="asset-library-tabs" role="tablist" aria-label="Asset Library views">
        <button type="button" role="tab" aria-selected={state.activeTab === "definitions"} onClick={() => state.setActiveTab("definitions")}>
          Definitions
        </button>
        <button type="button" role="tab" aria-selected={state.activeTab === "resource-views"} onClick={() => state.setActiveTab("resource-views")}>
          Resource views
        </button>
      </div>

      <div className="asset-library-layout">
        {state.activeTab === "definitions" ? (
          <>
            <AssetDefinitionList
              definitions={state.definitions}
              selectedDefinitionId={state.selectedDefinitionId}
              hasActiveFilters={state.hasActiveFilters}
              onSelectDefinition={(definition) => {
                void state.selectDefinition(definition);
              }}
            />
            <AssetDefinitionDetailPanel
              detail={state.selectedDetail}
              isLoading={state.isLoadingDetail}
              isLoadingValidation={state.isLoadingValidation}
              error={state.detailError}
              validationError={state.validationError}
              onLoadValidationDetails={() => {
                void state.loadValidationDetails();
              }}
            />
          </>
        ) : (
          <>
            <ResourceBackedViewList
              views={state.resourceBackedViews}
              selectedViewId={state.selectedResourceBackedViewId}
              hasActiveFilters={state.hasActiveFilters}
              onSelectView={(view) => {
                void state.selectResourceBackedView(view);
              }}
            />
            <ResourceBackedViewDetailPanel
              detail={state.selectedResourceBackedViewDetail}
              isLoading={state.isLoadingDetail}
              error={state.detailError}
            />
          </>
        )}
      </div>
    </section>
  );
}

function ResourceBackedViewList({
  views,
  selectedViewId,
  hasActiveFilters,
  onSelectView,
}: {
  readonly views: readonly AssetLibraryResourceBackedViewCard[];
  readonly selectedViewId?: string;
  readonly hasActiveFilters: boolean;
  readonly onSelectView: (view: AssetLibraryResourceBackedViewCard) => void;
}) {
  if (views.length === 0) {
    return (
      <section className="ui-panel asset-library-empty">
        <h2>{hasActiveFilters ? "No resource views match the current filters." : "No resource-backed views are visible yet."}</h2>
        <p>Resource-backed views appear when safe descriptor seams are wired for this host.</p>
      </section>
    );
  }
  return (
    <section className="asset-library-list" aria-label="Resource views">
      {views.map((view) => {
        const isSelected = view.id === selectedViewId;
        return (
          <button
            key={view.id}
            type="button"
            className={`asset-definition-card${isSelected ? " asset-definition-card--selected" : ""}`}
            aria-pressed={isSelected}
            onClick={() => onSelectView(view)}
          >
            <span className="asset-definition-card__header">
              <span className="asset-definition-card__title">{view.displayName}</span>
              <span className="asset-library-badge asset-library-badge--system">{view.viewKindLabel}</span>
            </span>
            {view.summary ? <span className="asset-definition-card__summary">{view.summary}</span> : null}
            <span className="asset-library-cues" aria-label="Resource view cues">
              <span>{getAssetLibraryTypeLabel(view)}</span>
              <span>{getAssetLibraryFamilyLabel(view)}</span>
              <span>{getAssetLibraryLifecycleStatusLabel(view)}</span>
              <span>{view.registrationStatusLabel}</span>
            </span>
            {view.diagnostics?.length ? <span className="asset-definition-card__updated">{view.diagnostics.join(" ")}</span> : null}
          </button>
        );
      })}
    </section>
  );
}

function ResourceBackedViewDetailPanel({
  detail,
  isLoading,
  error,
}: {
  readonly detail?: AssetLibraryResourceBackedViewDetail;
  readonly isLoading: boolean;
  readonly error?: string;
}) {
  if (isLoading) return <section className="ui-panel" role="status">Loading resource view...</section>;
  if (error) return <section className="ui-panel" role="alert">{error}</section>;
  if (!detail) return <section className="ui-panel asset-library-empty"><h2>Select a resource view.</h2></section>;
  return (
    <section className="ui-panel asset-library-detail" aria-label="Resource view detail">
      <h2>{detail.displayName}</h2>
      {detail.summary ? <p>{detail.summary}</p> : null}
      <dl className="asset-library-detail__facts">
        <dt>View kind</dt><dd>{detail.viewKindLabel}</dd>
        <dt>Status</dt><dd>{detail.registrationStatusLabel}</dd>
        <dt>Type</dt><dd>{getAssetLibraryTypeLabel(detail)}</dd>
        <dt>Family</dt><dd>{getAssetLibraryFamilyLabel(detail)}</dd>
        {detail.sourceKind ? <><dt>Source</dt><dd>{detail.sourceKind}</dd></> : null}
        {detail.resourceBackingSummary?.resourceKind ? <><dt>Backing</dt><dd>{detail.resourceBackingSummary.resourceKind}</dd></> : null}
      </dl>
      {detail.diagnostics?.length ? <div className="ui-status" role="status">{detail.diagnostics.join(" ")}</div> : null}
    </section>
  );
}
