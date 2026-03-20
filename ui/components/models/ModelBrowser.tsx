import { useState } from "react";
import type { IModelInstallProgress } from "../../../application/ports/interfaces/IModelInstaller";
import type {
  ModelCompatibilityViewModel,
  ModelDownloadFileViewModel,
  ModelListItemViewModel,
  RemoteModelListItemViewModel,
} from "../../presenters/ModelPresenter";
import ModelCard from "./ModelCard";
import ModelCompatibilityPanel from "./ModelCompatibilityPanel";
import ModelSearchBar, { type ModelSearchBarValue } from "./ModelSearchBar";

export interface ModelBrowserProps {
  readonly installedModels: ReadonlyArray<ModelListItemViewModel>;
  readonly remoteModels: ReadonlyArray<RemoteModelListItemViewModel>;
  readonly compatibility?: ModelCompatibilityViewModel;
  readonly searchValue?: Partial<ModelSearchBarValue>;
  readonly installProgressByModelId?: Readonly<Record<string, IModelInstallProgress>>;
  readonly isLoadingInstalled?: boolean;
  readonly isSearchingRemote?: boolean;
  readonly isInstalling?: boolean;
  readonly onSearch: (value: ModelSearchBarValue) => void;
  readonly onClearSearch?: () => void;
  readonly onDownloadRemoteFiles?: (
    modelId: string,
    files: ReadonlyArray<ModelDownloadFileViewModel>
  ) => void;
  readonly onRemoveInstalled?: (modelId: string) => void;
}

export default function ModelBrowser({
  installedModels,
  remoteModels,
  compatibility,
  searchValue,
  installProgressByModelId,
  isLoadingInstalled,
  isSearchingRemote,
  isInstalling,
  onSearch,
  onClearSearch,
  onDownloadRemoteFiles,
  onRemoveInstalled,
}: ModelBrowserProps): JSX.Element {
  const [expandedModelIds, setExpandedModelIds] = useState<ReadonlyArray<string>>([]);
  const [selectedFilesByModelId, setSelectedFilesByModelId] = useState<
    Readonly<Record<string, ReadonlyArray<string>>>
  >({});
  const [isInstalledExpanded, setInstalledExpanded] = useState<boolean>(false);

  const toggleExpanded = (modelId: string) => {
    setExpandedModelIds((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId]
    );
  };

  const toggleFileSelection = (modelId: string, fileId: string) => {
    setSelectedFilesByModelId((current) => {
      const modelSelections = current[modelId] ?? [];
      const updatedSelections = modelSelections.includes(fileId)
        ? modelSelections.filter((id) => id !== fileId)
        : [...modelSelections, fileId];

      return {
        ...current,
        [modelId]: updatedSelections,
      };
    });
  };

  return (
    <section className="ui-model-browser">
      <ModelSearchBar
        value={searchValue}
        isBusy={isSearchingRemote || isInstalling}
        onSearch={onSearch}
        onClear={onClearSearch}
      />

      <div className="ui-model-browser__sections">
        <section className="ui-panel ui-model-browser__list">
          <div className="ui-panel__header">
            <div className="ui-row ui-row--between ui-row--wrap" style={{ width: "100%" }}>
              <div>
                <div className="ui-panel__title">Installed Models</div>
                {isInstalledExpanded ? (
                  <div className="ui-panel__subtitle">Local models available to workflows.</div>
                ) : null}
              </div>
              <div className="ui-row ui-row--sm ui-row--wrap" style={{ alignItems: "center" }}>
                <div className="ui-subtle ui-text-small">
                  {isLoadingInstalled ? "Loading…" : `${installedModels.length} models`}
                </div>
                <button
                  className="ui-button ui-button--secondary ui-button--sm"
                  type="button"
                  onClick={() => setInstalledExpanded((current) => !current)}
                >
                  {isInstalledExpanded ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          {isInstalledExpanded ? (
            <div className="ui-panel__body">
              {installedModels.length === 0 ? (
                <div className="ui-empty-state">
                  <p className="ui-text-secondary">No installed models are currently available.</p>
                </div>
              ) : (
                <div className="ui-stack ui-stack--sm">
                  {installedModels.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      mode="installed"
                      onRemove={onRemoveInstalled}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <ModelCompatibilityPanel compatibility={compatibility} />

        <section className="ui-panel ui-model-browser__list ui-model-browser__list--remote">
          <div className="ui-panel__header">
            <div className="ui-row ui-row--between ui-row--wrap" style={{ width: "100%" }}>
              <div>
                <div className="ui-panel__title">Remote Catalog</div>
                <div className="ui-panel__subtitle">
                  Search and download supported remote models.
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
              <div className="ui-stack ui-stack--md">
                {remoteModels.map((model) => (
                  <ModelCard
                    key={model.remoteId ?? model.id}
                    model={model}
                    mode="remote"
                    isDetailsExpanded={expandedModelIds.includes(model.id)}
                    selectedFileIds={selectedFilesByModelId[model.id] ?? []}
                    installProgress={
                      installProgressByModelId?.[model.remoteId ?? model.id] ??
                      installProgressByModelId?.[model.id]
                    }
                    onToggleDetails={toggleExpanded}
                    onToggleFileSelection={toggleFileSelection}
                    onDownloadFile={(modelId, file) => {
                      onDownloadRemoteFiles?.(modelId, [file]);
                    }}
                    onDownloadFiles={onDownloadRemoteFiles}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
