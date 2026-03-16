import { useMemo, useState } from "react";
import ModelBrowser from "../components/models/ModelBrowser";
import type { ModelSearchBarValue } from "../components/models/ModelSearchBar";
import { ModelPresenter } from "../presenters/ModelPresenter";

export default function ModelsPage(): JSX.Element {
  const presenter = useMemo(() => new ModelPresenter(), []);
  const [selectedInstalledModelId, setSelectedInstalledModelId] = useState<string>();
  const [selectedRemoteModelId, setSelectedRemoteModelId] = useState<string>();
  const [lastSearch, setLastSearch] = useState<ModelSearchBarValue>({
    query: "",
    mode: "all",
  });

  const installedModels = useMemo(() => presenter.presentList([]), [presenter]);
  const remoteModels = useMemo(() => presenter.presentRemoteList([]), [presenter]);

  const selectedModel = undefined;
  const compatibility = undefined;

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Models</h1>
          <p className="ui-page__subtitle">
            Search remote models, manage installed assets, and inspect compatibility.
          </p>
        </div>
      </div>

      <ModelBrowser
        installedModels={installedModels}
        remoteModels={remoteModels}
        selectedInstalledModelId={selectedInstalledModelId}
        selectedRemoteModelId={selectedRemoteModelId}
        selectedModel={selectedModel}
        compatibility={compatibility}
        isLoadingInstalled={false}
        isSearchingRemote={false}
        isInstalling={false}
        onSearch={(value) => {
          setLastSearch(value);
          console.log("Model search requested", value);
        }}
        onClearSearch={() => {
          setLastSearch({
            query: "",
            mode: "all",
          });
          console.log("Model search cleared");
        }}
        onSelectInstalled={(modelId) => {
          setSelectedInstalledModelId(modelId);
          setSelectedRemoteModelId(undefined);
        }}
        onSelectRemote={(modelId) => {
          setSelectedRemoteModelId(modelId);
          setSelectedInstalledModelId(undefined);
        }}
        onInspectModel={(modelId) => {
          console.log("Inspect model", modelId, lastSearch);
        }}
        onInstallRemote={(modelId) => {
          console.log("Install remote model", modelId);
        }}
        onRemoveInstalled={(modelId) => {
          console.log("Remove installed model", modelId);
        }}
      />
    </section>
  );
}
