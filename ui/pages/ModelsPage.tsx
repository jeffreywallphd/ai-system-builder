import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ModelBrowser from "../components/models/ModelBrowser";
import type { ModelSearchBarValue } from "../components/models/ModelSearchBar";
import { useUiDependencies } from "../composition/AppProviders";
import { Model, ModelArtifact } from "../../domain/models/Model";
import { ModelPresenter, type ModelDownloadFileViewModel } from "../presenters/ModelPresenter";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { IModelStoreState, ModelStore } from "../state/ModelStore";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { RuntimeEngine } from "../../domain/models/interfaces/IModelCompatibility";
import type { UiSettingsState } from "../settings/UiSettingsStore";
import type { IRemoteModelCatalogItem } from "../../application/ports/interfaces/IRemoteModelCatalog";

const fallbackState: IModelStoreState = Object.freeze({
  installedModels: Object.freeze([]),
  remoteModels: Object.freeze([]),
  selectedInstalledModelId: undefined,
  selectedRemoteModelId: undefined,
  installedSearchCriteria: undefined,
  remoteSearchCriteria: undefined,
  installProgressByModelId: Object.freeze({}),
  isLoadingInstalled: false,
  isSearchingRemote: false,
  isInstalling: false,
  isRemoving: false,
  error: undefined,
});

export default function ModelsPage(): JSX.Element {
  const presenter = useMemo(() => new ModelPresenter(), []);
  const { modelStore, settingsStore } = useUiDependencies();
  const [state, setState] = useState<IModelStoreState>(fallbackState);
  const [settingsState, setSettingsState] = useState<UiSettingsState>(() => settingsStore.getState());

  useEffect(() => {
    return modelStore.subscribe(setState);
  }, [modelStore]);

  useEffect(() => settingsStore.subscribe(setSettingsState), [settingsStore]);

  useEffect(() => {
    void modelStore.refreshInstalled();
    void modelStore.searchRemote({ limit: 16 });
  }, [modelStore]);

  const installedModels = useMemo(
    () => presenter.presentList(state.installedModels),
    [presenter, state.installedModels]
  );
  const remoteModels = useMemo(
    () => presenter.presentRemoteList(state.remoteModels),
    [presenter, state.remoteModels]
  );

  const compatibility = undefined;

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Models</h1>
          <p className="ui-page__subtitle">
            Search remote models, manage installed assets, and inspect compatibility.
          </p>
          <p className="ui-text-secondary ui-text-small">
            New downloads currently install to <strong>{settingsState.settings.models.installDirectory}</strong>. Update this in{" "}
            <Link to={ROUTE_PATHS.settings}>Settings</Link> whenever you want AI Loom Studio to share a library with other tools.
          </p>
        </div>
      </div>

      <ModelBrowser
        installedModels={installedModels}
        remoteModels={remoteModels}
        compatibility={compatibility}
        isLoadingInstalled={state.isLoadingInstalled}
        isSearchingRemote={state.isSearchingRemote}
        isInstalling={state.isInstalling}
        onSearch={(value) => {
          void searchModels(modelStore, value);
        }}
        onClearSearch={() => {
          void modelStore.searchRemote({ limit: 16 });
        }}
        onInstallRemoteFiles={(modelId, files) => {
          void installRemoteFiles(
            modelStore,
            state.remoteModels,
            settingsState.settings.models.installDirectory,
            modelId,
            files
          );
        }}
        onRemoveInstalled={(modelId) => {
          console.log("Remove installed model", modelId);
        }}
      />
    </section>
  );
}

async function installRemoteFiles(
  modelStore: ModelStore,
  remoteModels: ReadonlyArray<IRemoteModelCatalogItem>,
  installBaseDirectory: string,
  modelId: string,
  files: ReadonlyArray<ModelDownloadFileViewModel>
): Promise<void> {
  const remoteModel = remoteModels.find(
    (item) => item.remoteId === modelId || item.model.id === modelId
  );

  if (!remoteModel) {
    throw new Error(`Remote model '${modelId}' could not be found in the current catalog results.`);
  }

  const installTargets =
    files.length > 0
      ? files
      : [
          {
            name: remoteModel.model.artifact.name,
            id: `${remoteModel.model.id}::artifact`,
          } as ModelDownloadFileViewModel,
        ];

  const modelForInstallation = createInstallationModel(remoteModel.model, installTargets);

  await modelStore.installModel({
    model: modelForInstallation,
    provider: remoteModel.provider,
    destination: `${installBaseDirectory}/${sanitizePathSegment(remoteModel.remoteId ?? remoteModel.model.id)}`,
    overwrite: false,
    verifyIntegrity: true,
    registerInstalled: true,
  });
}

function createInstallationModel(
  model: IModel,
  files: ReadonlyArray<ModelDownloadFileViewModel>
): IModel {
  const selectedLocations = new Set(files.map((file) => file.name));
  const selectedArtifacts = [model.artifact, ...model.additionalArtifacts].filter((artifact) =>
    selectedLocations.has(artifact.name)
  );
  const [primaryArtifact, ...additionalArtifacts] = selectedArtifacts;

  if (!primaryArtifact) {
    throw new Error(`No downloadable files were selected for '${model.id}'.`);
  }

  const cloned = Model.from(model);

  return new Model({
    id: cloned.id,
    name: cloned.name,
    version: cloned.version,
    variant: cloned.variant,
    publisher: cloned.publisher,
    kind: cloned.kind,
    isRunnable: cloned.isRunnable,
    status: cloned.status,
    source: cloned.source,
    artifact: new ModelArtifact({
      name: primaryArtifact.name,
      accessMethod: primaryArtifact.accessMethod,
      location: primaryArtifact.location,
      format: primaryArtifact.format,
      sizeBytes: primaryArtifact.sizeBytes,
      sha256: primaryArtifact.sha256,
      contentType: primaryArtifact.contentType,
    }),
    additionalArtifacts: additionalArtifacts.map(
      (artifact) =>
        new ModelArtifact({
          name: artifact.name,
          accessMethod: artifact.accessMethod,
          location: artifact.location,
          format: artifact.format,
          sizeBytes: artifact.sizeBytes,
          sha256: artifact.sha256,
          contentType: artifact.contentType,
        })
    ),
    dependencies: cloned.dependencies,
    precision: cloned.precision,
    architectureFamily: cloned.architectureFamily,
    architecture: cloned.architecture,
    compatibility: cloned.compatibility,
    requirements: cloned.requirements,
    resourceProfile: cloned.resourceProfile,
    description: cloned.description,
    tags: cloned.tags,
    license: cloned.license,
    languageCodes: cloned.languageCodes,
    requiresAuth: cloned.requiresAuth,
  });
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "_") || "model";
}

async function searchModels(
  modelStore: ModelStore,
  value: ModelSearchBarValue
): Promise<void> {
  if (value.mode === "installed") {
    await modelStore.refreshInstalled({
      query: value.query || undefined,
      kinds: value.kind ? [value.kind as IModel["kind"]] : undefined,
    });

    return;
  }

  await modelStore.searchRemote({
    query: value.query || undefined,
    providers: value.provider ? [value.provider] : undefined,
    kinds: value.kind ? [value.kind as IModel["kind"]] : undefined,
    runtimes: value.runtime ? [value.runtime as RuntimeEngine] : undefined,
    limit: 24,
  });

  if (value.mode === "all") {
    await modelStore.refreshInstalled({
      query: value.query || undefined,
      kinds: value.kind ? [value.kind as IModel["kind"]] : undefined,
      runtimes: value.runtime ? [value.runtime as RuntimeEngine] : undefined,
    });
  }
}
