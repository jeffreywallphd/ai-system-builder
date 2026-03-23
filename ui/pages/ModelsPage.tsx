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
import type { UiSettingsState } from "../settings/UiSettingsStore";
import type { IRemoteModelCatalogItem } from "../../application/ports/interfaces/IRemoteModelCatalog";
import type { ManagedModelLibraryItem } from "../../application/models/ManagedModelLibrary";
import ModelTrainingStudio from "../components/models/ModelTrainingStudio";

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
  const { modelStore, settingsStore, modelTrainingStore } = useUiDependencies();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<IModelStoreState>(fallbackState);
  const [settingsState, setSettingsState] = useState<UiSettingsState>(() => settingsStore.getState());
  const [activeTab, setActiveTab] = useState<ModelsTabId>("download");

  useEffect(() => modelStore.subscribe(setState), [modelStore]);
  useEffect(() => settingsStore.subscribe(setSettingsState), [settingsStore]);

  const remoteSearchLimit = settingsState.settings.models.remoteSearchLimit;
  const searchValue = useMemo(() => readModelSearchValue(searchParams), [searchParams]);
  const libraryItemsById = useMemo(
    () => new Map((state.managedLibrary?.items ?? []).map((item) => [item.id, item])),
    [state.managedLibrary?.items],
  );

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
            Manage installed models, download new ones, and create local model outputs from the base models and dataset versions that are actually available in this runtime mode.
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
            description: "Browse remote catalogs, reconcile installs, and run real uninstall/remove actions.",
          },
          {
            id: "create",
            label: "Create Models",
            description: "Prepare bundle-only outputs or run real local training when this mode supports it.",
          },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as ModelsTabId)}
      />

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap">
            <div>
              <strong>Installed model library status</strong>
              <div className="ui-text-secondary ui-text-small">{state.managedLibrary?.detail ?? "The installed model library has not been checked yet."}</div>
            </div>
            <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => void modelStore.refreshInstalled()}>
              Refresh library
            </button>
          </div>
          <div className="ui-text-secondary ui-text-small">
            Source of truth: <strong>{state.managedLibrary?.sourceOfTruth ?? "unknown"}</strong>
            {state.managedLibrary?.recordedAt ? ` · Checked ${state.managedLibrary.recordedAt.toLocaleString()}` : ""}
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
            const item = libraryItemsById.get(modelId);
            if (!item) {
              return;
            }
            const action = defaultRemovalAction(item);
            if (typeof window !== "undefined" && !window.confirm(action.confirmationText)) {
              return;
            }
            void modelStore.removeModel({
              modelId,
              removeArtifacts: action.removeArtifacts,
              unregisterOnly: action.unregisterOnly,
            });
          }}
        />

        <div className="ui-card" style={{ marginTop: "1rem" }}>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-row ui-row--between ui-row--wrap">
              <div>
                <h2>Installation diagnostics</h2>
                <p className="ui-text-secondary ui-text-small">
                  Inspect reconciliation state, verification results, and the exact removal path that is safe for each model entry.
                </p>
              </div>
            </div>

            {(state.managedLibrary?.items ?? []).length === 0 ? (
              <div className="ui-empty-state">
                <p className="ui-text-secondary">No managed library entries are available to inspect yet.</p>
              </div>
            ) : (
              <div className="ui-stack ui-stack--sm">
                {(state.managedLibrary?.items ?? []).map((item) => {
                  const action = defaultRemovalAction(item);
                  return (
                    <article key={item.id} className="ui-panel ui-stack ui-stack--sm">
                      <div className="ui-row ui-row--between ui-row--wrap">
                        <div>
                          <strong>{item.name}</strong>
                          <div className="ui-text-secondary ui-text-small">{item.location ?? "No artifact path recorded"}</div>
                        </div>
                        <span className={`ui-badge ${badgeClassForLibraryState(item.state)}`}>{item.state}</span>
                      </div>
                      <div className="ui-text-secondary">{item.detail}</div>
                      <div className="ui-text-secondary ui-text-small">
                        Registration: <strong>{item.registered ? "catalog present" : "catalog missing"}</strong> · Verification: <strong>{item.verified ? "verified" : "not verified"}</strong> · Source: <strong>{item.sourceOfTruth}</strong>
                      </div>
                      <div className="ui-text-secondary ui-text-small">
                        Artifacts: <strong>{item.presentArtifactCount ?? 0}</strong> present / <strong>{item.artifactCount ?? 0}</strong> recorded
                        {item.missingArtifactCount ? ` · Missing ${item.missingArtifactCount}` : ""}
                      </div>
                      {item.verificationErrors && item.verificationErrors.length > 0 ? (
                        <ul className="ui-text-secondary ui-text-small">
                          {item.verificationErrors.map((error) => <li key={error}>{error}</li>)}
                        </ul>
                      ) : null}
                      <div className="ui-row ui-row--wrap">
                        <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => void modelStore.refreshInstalled()}>
                          Reconcile
                        </button>
                        <button
                          className="ui-button ui-button--danger ui-button--sm"
                          type="button"
                          disabled={!item.registered}
                          onClick={() => {
                            if (typeof window !== "undefined" && !window.confirm(action.confirmationText)) {
                              return;
                            }
                            void modelStore.removeModel({
                              modelId: item.id,
                              removeArtifacts: action.removeArtifacts,
                              unregisterOnly: action.unregisterOnly,
                            });
                          }}
                        >
                          {action.label}
                        </button>
                        {item.registered && !action.unregisterOnly ? (
                          <button
                            className="ui-button ui-button--ghost ui-button--sm"
                            type="button"
                            onClick={() => {
                              if (typeof window !== "undefined" && !window.confirm(`Remove only the '${item.name}' catalog entry and keep any managed files on disk?`)) {
                                return;
                              }
                              void modelStore.removeModel({ modelId: item.id, unregisterOnly: true, removeArtifacts: false });
                            }}
                          >
                            Remove metadata only
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        id="page-tabpanel-create"
        role="tabpanel"
        aria-labelledby="page-tab-create"
        className="ui-page-tab-panel"
        hidden={activeTab !== "create"}
      >
        <ModelTrainingStudio
          modelTrainingStore={modelTrainingStore}
        />
      </section>
    </section>
  );
}

function defaultRemovalAction(item: ManagedModelLibraryItem): {
  readonly label: string;
  readonly unregisterOnly: boolean;
  readonly removeArtifacts: boolean;
  readonly confirmationText: string;
} {
  switch (item.state) {
    case "registered-metadata-only":
    case "missing-on-disk":
    case "browser-fallback-downloaded-only":
      return {
        label: "Remove metadata registration",
        unregisterOnly: true,
        removeArtifacts: false,
        confirmationText: `Remove the '${item.name}' catalog entry? No managed local files will be deleted.`,
      };
    case "downloaded-but-unregistered":
      return {
        label: "Unregistered file only",
        unregisterOnly: true,
        removeArtifacts: false,
        confirmationText: `The file '${item.name}' is not registered in the catalog. Reconcile again after manually removing the orphaned file if needed.`,
      };
    default:
      return {
        label: "Remove files and registration",
        unregisterOnly: false,
        removeArtifacts: true,
        confirmationText: `Remove '${item.name}' from the installed-model catalog and delete its managed local files?`,
      };
  }
}

function badgeClassForLibraryState(state: ManagedModelLibraryItem["state"]): string {
  switch (state) {
    case "installed-and-verified":
      return "ui-badge--success";
    case "installed-but-unverified":
      return "ui-badge--info";
    case "missing-on-disk":
    case "partially-installed":
    case "browser-fallback-downloaded-only":
      return "ui-badge--warning";
    case "corrupted-checksum-mismatch":
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
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
    mode: searchParams.get("mode") === "installed" || searchParams.get("mode") === "remote" ? searchParams.get("mode") as "installed" | "remote" : undefined,
    kind: searchParams.get("kind") ?? undefined,
    runtime: searchParams.get("runtime") ?? undefined,
  });
}

async function searchModels(
  modelStore: ModelStore,
  searchValue: ModelSearchBarValue,
  remoteSearchLimit: number
): Promise<void> {
  await modelStore.searchRemote({
    query: searchValue.query.trim() || undefined,
    providers: searchValue.provider ? [searchValue.provider] : undefined,
    kinds: searchValue.kind ? [searchValue.kind as never] : undefined,
    runtimes: searchValue.runtime ? [searchValue.runtime as never] : undefined,
    limit: remoteSearchLimit,
  });
}

function buildDownloadFileViewModels(model: IRemoteModelCatalogItem["model"]): ReadonlyArray<ModelDownloadFileViewModel> {
  const artifacts = [model.artifact, ...model.additionalArtifacts];
  return Object.freeze(artifacts.map((artifact, index) => Object.freeze({
    id: `${model.id}::${index}::${artifact.name}`,
    name: artifact.name,
    format: artifact.format,
    extension: artifact.name.includes(".") ? artifact.name.slice(artifact.name.lastIndexOf(".") + 1).toLowerCase() : artifact.format,
    sizeBytes: artifact.sizeBytes,
    sizeLabel: formatBytes(artifact.sizeBytes),
    isPrimary: index === 0,
  })));
}

function createInstallationModel(
  model: IRemoteModelCatalogItem["model"],
  files: ReadonlyArray<ModelDownloadFileViewModel>
): IRemoteModelCatalogItem["model"] {
  const selectedArtifacts = files.map((file) => new ModelArtifact({
    name: file.name,
    accessMethod: "remote-download",
    location: file.name,
    format: file.format as never,
    sizeBytes: file.sizeBytes,
  }));
  const [primaryArtifact, ...additionalArtifacts] = selectedArtifacts;

  return new Model({
    ...model,
    artifact: primaryArtifact ?? model.artifact,
    additionalArtifacts: additionalArtifacts.length > 0 ? additionalArtifacts : model.additionalArtifacts,
  });
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-");
}
