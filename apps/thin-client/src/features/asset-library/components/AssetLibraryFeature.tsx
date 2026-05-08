import type { AssetLibraryClient } from "../../../../../../modules/ui/shared/asset-library";
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

      <div className="asset-library-layout">
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
      </div>
    </section>
  );
}
