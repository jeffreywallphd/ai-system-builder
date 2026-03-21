import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ModelBrowser from "../components/models/ModelBrowser";
import PageTabs from "../components/navigation/PageTabs";
import type { ModelSearchBarValue } from "../components/models/ModelSearchBar";
import { useUiDependencies } from "../composition/AppProviders";
import { Model, ModelArtifact } from "../../domain/models/Model";
import { ModelPresenter, type ModelDownloadFileViewModel } from "../presenters/ModelPresenter";
import { formatBytes } from "../presenters/PresenterFormatting";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { IModelStoreState, ModelStore } from "../state/ModelStore";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { RuntimeEngine } from "../../domain/models/interfaces/IModelCompatibility";
import type { UiSettingsState } from "../settings/UiSettingsStore";
import type { IRemoteModelCatalogItem } from "../../application/ports/interfaces/IRemoteModelCatalog";

type ModelsTabId = "download" | "create";

const fallbackState: IModelStoreState = Object.freeze({
  installedModels: Object.freeze([]),
  remoteModels: Object.freeze([]),
  selectedInstalledModelId: undefined,
  selectedRemoteModelId: undefined,
  installedSearchCriteria: undefined,
  remoteSearchCriteria: undefined,
  installProgressByModelId: Object.freeze({}),
  managedLibrary: undefined,
  isLoadingInstalled: false,
  isSearchingRemote: false,
  isInstalling: false,
  isRemoving: false,
  error: undefined,
});

export default function ModelsPage(): JSX.Element {
  const presenter = useMemo(() => new ModelPresenter(), []);
  const { modelStore, settingsStore } = useUiDependencies();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<IModelStoreState>(fallbackState);
  const [settingsState, setSettingsState] = useState<UiSettingsState>(() => settingsStore.getState());
  const [activeTab, setActiveTab] = useState<ModelsTabId>("download");

  useEffect(() => {
    return modelStore.subscribe(setState);
  }, [modelStore]);

  useEffect(() => settingsStore.subscribe(setSettingsState), [settingsStore]);

  const remoteSearchLimit = settingsState.settings.models.remoteSearchLimit;
  const searchValue = useMemo(() => readModelSearchValue(searchParams), [searchParams]);

  useEffect(() => {
    void modelStore.refreshInstalled();
  }, [modelStore]);

  useEffect(() => {
    void searchModels(modelStore, searchValue, remoteSearchLimit);
  }, [modelStore, remoteSearchLimit, searchValue]);

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
            Manage the model library your workflows can actually use, and keep browser-only download fallbacks clearly separated from verified local installs.
          </p>
          <p className="ui-text-secondary ui-text-small">
            Managed library root: <strong>{state.managedLibrary?.location ?? settingsState.settings.models.installDirectory}</strong>. Update this in{" "}
            <Link to={ROUTE_PATHS.settings}>Settings</Link> whenever you want AI Loom Studio to share a library with other tools.
          </p>
          <p className="ui-text-secondary ui-text-small">
            Library mode: <strong>{state.managedLibrary?.mode ?? "unknown"}</strong> — {state.managedLibrary?.detail ?? "Model library state has not been inspected yet."}
          </p>
        </div>
      </div>

      <PageTabs
        label="Model tabs"
        tabs={[
          {
            id: "download",
            label: "Download Models",
            description: "Browse remote catalogs and inspect truthful installed-model state.",
          },
          {
            id: "create",
            label: "Create Models",
            description: "Prepare fine-tuned model variants from downloaded models.",
          },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as ModelsTabId)}
      />

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div>
            <strong>Managed Model Library Truth</strong>
            <div className="ui-text-secondary ui-text-small">{state.managedLibrary?.detail ?? "Model library inspection is pending."}</div>
          </div>
          <div className="ui-text-secondary ui-text-small">
            {state.managedLibrary?.items.length
              ? state.managedLibrary.items.map((item) => `${item.name}: ${item.state}`).join(" · ")
              : "No managed model library entries have been detected yet."}
          </div>
        </div>
      </div>

      <section
        id="page-tabpanel-download"
        role="tabpanel"
        aria-labelledby="page-tab-download"
        className="ui-page-tab-panel"
        hidden={activeTab !== "download"}
      >
        <ModelBrowser
          installedModels={installedModels}
          remoteModels={remoteModels}
          compatibility={compatibility}
          searchValue={searchValue}
          installProgressByModelId={state.installProgressByModelId}
          isLoadingInstalled={state.isLoadingInstalled}
          isSearchingRemote={state.isSearchingRemote}
          isInstalling={state.isInstalling}
          onSearch={(value) => {
            setSearchParams(buildModelSearchParams(value));
          }}
          onClearSearch={() => {
            setSearchParams(new URLSearchParams());
          }}
          onDownloadRemoteFiles={(modelId, files) => {
            void installRemoteFiles(
              modelStore,
              state.remoteModels,
              settingsState.settings.models,
              modelId,
              files
            );
          }}
          onRemoveInstalled={(modelId) => {
            console.log("Remove installed model", modelId);
          }}
        />
      </section>

      <section
        id="page-tabpanel-create"
        role="tabpanel"
        aria-labelledby="page-tab-create"
        className="ui-page-tab-panel"
        hidden={activeTab !== "create"}
      >
        <div className="ui-card">
          <div className="ui-card__body ui-empty-state">
            <h2>Create Models</h2>
            <p className="ui-text-secondary">
              Fine-tuning and managed model creation will live here. The foundation now reports truthful model-library state, but training workflows are still not implemented.
            </p>
            <p className="ui-text-secondary ui-text-small">
              Download or manage your base models from the Download Models tab first so this area can build on assets already in your workspace.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}

async function installRemoteFiles(
  modelStore: ModelStore,
  remoteModels: ReadonlyArray<IRemoteModelCatalogItem>,
  modelSettings: UiSettingsState["settings"]["models"],
  modelId: string,
  files: ReadonlyArray<ModelDownloadFileViewModel>
): Promise<void> {
  const remoteModel = remoteModels.find(
    (item) => item.remoteId === modelId || item.model.id === modelId
  );

  if (!remoteModel) {
    throw new Error(`Remote model '${modelId}' could not be found in the current catalog results.`);
  }

  const installTargets = files.length > 0 ? files : buildDownloadFileViewModels(remoteModel.model);

  const modelForInstallation = createInstallationModel(remoteModel.model, installTargets);

  await modelStore.installModel({
    model: modelForInstallation,
    modelId: remoteModel.model.id,
    remoteId: remoteModel.remoteId ?? remoteModel.model.id,
    provider: remoteModel.provider,
    destination: `${modelSettings.installDirectory}/${sanitizePathSegment(remoteModel.remoteId ?? remoteModel.model.id)}`,
    overwrite: modelSettings.allowOverwrite,
    verifyIntegrity: modelSettings.verifyDownloads,
    authToken: modelSettings.authToken || undefined,
    registerInstalled: modelSettings.registerInstalledModels,
  });
}

function buildModelSearchParams(value: ModelSearchBarValue): URLSearchParams {
  const params = new URLSearchParams();

  if (value.query.trim()) {
    params.set("query", value.query.trim());
  }

  if (value.provider) {
    params.set("provider", value.provider);
  }

  if (value.mode) {
    params.set("mode", value.mode);
  }

  if (value.kind) {
    params.set("kind", value.kind);
  }

  if (value.runtime) {
    params.set("runtime", value.runtime);
  }

  return params;
}

function readModelSearchValue(searchParams: URLSearchParams): ModelSearchBarValue {
  return Object.freeze({
    query: searchParams.get("query") ?? "",
    provider: searchParams.get("provider") ?? undefined,
    mode: (searchParams.get("mode") as ModelSearchBarValue["mode"]) ?? "all",
    kind: searchParams.get("kind") ?? undefined,
    runtime: searchParams.get("runtime") ?? undefined,
  });
}

function buildDownloadFileViewModels(model: IModel): ReadonlyArray<ModelDownloadFileViewModel> {
  return Object.freeze(
    [model.artifact, ...model.additionalArtifacts].map((artifact, index) => ({
      id: `${model.id}::${index}::${artifact.name}`,
      name: artifact.name,
      format: artifact.format,
      extension: artifact.name.includes(".")
        ? artifact.name.slice(artifact.name.lastIndexOf(".") + 1).toLowerCase()
        : artifact.format,
      sizeBytes: artifact.sizeBytes,
      sizeLabel: formatBytes(artifact.sizeBytes),
      isPrimary: index === 0,
    }))
  );
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
  value: ModelSearchBarValue,
  remoteSearchLimit: number
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
    limit: remoteSearchLimit,
  });

  if (value.mode === "all") {
    await modelStore.refreshInstalled({
      query: value.query || undefined,
      kinds: value.kind ? [value.kind as IModel["kind"]] : undefined,
      runtimes: value.runtime ? [value.runtime as RuntimeEngine] : undefined,
    });
  }
}
