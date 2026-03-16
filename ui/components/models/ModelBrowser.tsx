import type {
  ModelCompatibilityViewModel,
  ModelDetailViewModel,
  ModelListItemViewModel,
  RemoteModelListItemViewModel,
} from "../../presenters/ModelPresenter";
import ModelCard from "./ModelCard";
import ModelCompatibilityPanel from "./ModelCompatibilityPanel";
import ModelDetailsPanel from "./ModelDetailsPanel";
import ModelSearchBar, { type ModelSearchBarValue } from "./ModelSearchBar";

export interface ModelBrowserProps {
  readonly installedModels: ReadonlyArray<ModelListItemViewModel>;
  readonly remoteModels: ReadonlyArray<RemoteModelListItemViewModel>;
  readonly selectedInstalledModelId?: string;
  readonly selectedRemoteModelId?: string;
  readonly selectedModel?: ModelDetailViewModel;
  readonly compatibility?: ModelCompatibilityViewModel;
  readonly installProgressByModelId?: Readonly<Record<string, string>>;
  readonly isLoadingInstalled?: boolean;
  readonly isSearchingRemote?: boolean;
  readonly isInstalling?: boolean;
  readonly onSearch: (value: ModelSearchBarValue) => void;
  readonly onClearSearch?: () => void;
  readonly onSelectInstalled?: (modelId: string) => void;
  readonly onSelectRemote?: (modelId: string) => void;
  readonly onInstallRemote?: (modelId: string) => void;
  readonly onRemoveInstalled?: (modelId: string) => void;
  readonly onInspectModel?: (modelId: string) => void;
}

export default function ModelBrowser({
  installedModels,
  remoteModels,
  selectedInstalledModelId,
  selectedRemoteModelId,
  selectedModel,
  compatibility,
  installProgressByModelId,
  isLoadingInstalled,
  isSearchingRemote,
  isInstalling,
  onSearch,
  onClearSearch,
  onSelectInstalled,
  onSelectRemote,
  onInstallRemote,
  onRemoveInstalled,
  onInspectModel,
}: ModelBrowserProps): JSX.Element {
  return (
    <section className="ui-model-browser">
      <ModelSearchBar
        isBusy={isSearchingRemote || isInstalling}
        onSearch={onSearch}
        onClear={onClearSearch}
      />

      <div className="ui-model-browser__sections">
        <div className="ui-stack ui-stack--md">
          <section className="ui-panel ui-model-browser__list">
            <div className="ui-panel__header">
              <div className="ui-row ui-row--between ui-row--wrap" style={{ width: "100%" }}>
                <div>
                  <div className="ui-panel__title">Installed Models</div>
                  <div className="ui-panel__subtitle">Local models available to workflows.</div>
                </div>
                <div className="ui-subtle ui-text-small">
                  {isLoadingInstalled ? "Loading…" : `${installedModels.length} models`}
                </div>
              </div>
            </div>

            <div className="ui-panel__body">
              {installedModels.length === 0 ? (
                <div className="ui-empty-state">
                  <p className="ui-text-secondary">No installed models are currently available.</p>
                </div>
              ) : (
                <div className="ui-grid ui-grid--2">
                  {installedModels.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      mode="installed"
                      isSelected={selectedInstalledModelId === model.id}
                      onSelect={onSelectInstalled}
                      onInspect={onInspectModel}
                      onRemove={onRemoveInstalled}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="ui-panel ui-model-browser__list">
            <div className="ui-panel__header">
              <div className="ui-row ui-row--between ui-row--wrap" style={{ width: "100%" }}>
                <div>
                  <div className="ui-panel__title">Remote Catalog</div>
                  <div className="ui-panel__subtitle">
                    Search and install supported remote models.
                  </div>
                </div>
                <div className="ui-subtle ui-text-small">
                  {isSearchingRemote ? "Searching…" : `${remoteModels.length} results`}
                </div>
              </div>
            </div>

            <div className="ui-panel__body">
              {remoteModels.length === 0 ? (
                <div className="ui-empty-state">
                  <p className="ui-text-secondary">
                    No remote models match the current search criteria.
                  </p>
                </div>
              ) : (
                <div className="ui-grid ui-grid--2">
                  {remoteModels.map((model) => (
                    <ModelCard
                      key={model.remoteId ?? model.id}
                      model={model}
                      mode="remote"
                      isSelected={selectedRemoteModelId === (model.remoteId ?? model.id)}
                      installProgressLabel={installProgressByModelId?.[model.remoteId ?? model.id]}
                      onSelect={onSelectRemote}
                      onInspect={onInspectModel}
                      onInstall={onInstallRemote}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="ui-stack ui-stack--md">
          <ModelDetailsPanel model={selectedModel} />
          <ModelCompatibilityPanel compatibility={compatibility} />
        </div>
      </div>
    </section>
  );
}
