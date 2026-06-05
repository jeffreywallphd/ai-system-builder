import { useEffect, useMemo, useState } from "react";

import type { DesktopArtifactBrowserClient } from "../../artifact-browser/api/desktopArtifactBrowserClient";
import { useArtifactBrowserClient } from "../../artifact-browser/hooks/useArtifactBrowserClient";
import { SettingsPanel, useApplicationSettings } from "../../settings";
import type {
  DesktopHuggingFaceDatasetParquetFile,
  DesktopHuggingFaceFilesImportResult,
  DesktopHuggingFaceNamespaceDataset,
} from "../../../lib/desktopApi";

interface ArtifactHuggingFaceFormProps {
  client?: DesktopArtifactBrowserClient;
  onRegistered?: (storageKey: string) => void;
}

interface ViewState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
}

type FilesByRepository = Record<string, { files: DesktopHuggingFaceDatasetParquetFile[]; state: ViewState }>;

export function ArtifactHuggingFaceForm({ client, onRegistered }: ArtifactHuggingFaceFormProps) {
  const artifactClient = useArtifactBrowserClient(client);
  const settings = useApplicationSettings({ keys: ["huggingface.defaultNamespace"] });
  const [viewState, setViewState] = useState<ViewState>({ status: "idle" });
  const [namespace, setNamespace] = useState("");
  const [revision, setRevision] = useState("main");
  const [datasets, setDatasets] = useState<DesktopHuggingFaceNamespaceDataset[]>([]);
  const [selectedRepositories, setSelectedRepositories] = useState<Set<string>>(() => new Set());
  const [filesByRepository, setFilesByRepository] = useState<FilesByRepository>({});
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(() => new Set());
  const [importResult, setImportResult] = useState<DesktopHuggingFaceFilesImportResult | undefined>();

  useEffect(() => {
    const configuredNamespace = settings.valuesByKey.get("huggingface.defaultNamespace")?.value;
    if (namespace.trim().length === 0 && typeof configuredNamespace === "string" && configuredNamespace.trim().length > 0) {
      setNamespace(configuredNamespace);
    }
  }, [namespace, settings.valuesByKey]);

  const selectedRepositoryList = useMemo(
    () => datasets.filter((dataset) => selectedRepositories.has(dataset.repository)),
    [datasets, selectedRepositories],
  );
  const loadedFiles = useMemo(
    () => Object.values(filesByRepository).flatMap((entry) => entry.files),
    [filesByRepository],
  );
  const selectedFileList = useMemo(
    () => loadedFiles.filter((file) => selectedFiles.has(fileKey(file))),
    [loadedFiles, selectedFiles],
  );

  async function loadNamespace(): Promise<void> {
    setViewState({ status: "loading", message: "Finding datasets..." });
    setImportResult(undefined);
    try {
      if (!artifactClient.browseHuggingFaceNamespaceDatasets) {
        throw new Error("Namespace browsing is unavailable for this client.");
      }
      const loadedDatasets = await artifactClient.browseHuggingFaceNamespaceDatasets({ namespace });
      setDatasets(loadedDatasets);
      setSelectedRepositories(new Set());
      setFilesByRepository({});
      setSelectedFiles(new Set());
      setViewState({
        status: "success",
        message: loadedDatasets.length > 0
          ? `Found ${loadedDatasets.length} dataset(s).`
          : "No datasets were found for that namespace.",
      });
    } catch (error) {
      setViewState({ status: "error", message: error instanceof Error ? error.message : "Failed to load Hugging Face datasets." });
    }
  }

  async function loadSelectedFiles(): Promise<void> {
    setViewState({ status: "loading", message: "Loading files for selected datasets..." });
    setImportResult(undefined);
    try {
      if (!artifactClient.browseHuggingFaceDatasetParquetFiles) {
        throw new Error("Dataset file browsing is unavailable for this client.");
      }
      const browseFiles = artifactClient.browseHuggingFaceDatasetParquetFiles;
      const loadedEntries = await Promise.all(selectedRepositoryList.map(async (dataset) => {
        const files = await browseFiles({
          repository: dataset.repository,
          revision,
        });
        return [dataset.repository, { files, state: { status: "success" as const, message: `Loaded ${files.length} file(s).` } }] as const;
      }));
      setFilesByRepository((current) => ({ ...current, ...Object.fromEntries(loadedEntries) }));
      setSelectedFiles(new Set());
      setViewState({ status: "success", message: `Loaded files for ${loadedEntries.length} dataset(s).` });
    } catch (error) {
      setViewState({ status: "error", message: error instanceof Error ? error.message : "Failed to load selected dataset files." });
    }
  }

  async function importSelectedRepositories(): Promise<void> {
    await importFiles({
      repositories: selectedRepositoryList.map((dataset) => ({ repository: dataset.repository, revision })),
    });
  }

  async function importSelectedFiles(): Promise<void> {
    await importFiles({
      files: selectedFileList.map((file) => ({
        repository: file.repository,
        path: file.path,
        revision: file.revision,
      })),
    });
  }

  async function importFiles(input: Parameters<NonNullable<DesktopArtifactBrowserClient["importHuggingFaceFiles"]>>[0]): Promise<void> {
    setViewState({ status: "loading", message: "Importing selected Hugging Face files..." });
    setImportResult(undefined);
    try {
      if (!artifactClient.importHuggingFaceFiles) {
        throw new Error("Batch Hugging Face import is unavailable for this client.");
      }
      const result = await artifactClient.importHuggingFaceFiles(input);
      setImportResult(result);
      for (const file of result.repositories.flatMap((repository) => repository.files)) {
        if (file.status === "registered" && file.artifactId) {
          onRegistered?.(file.artifactId);
        }
      }
      setViewState({
        status: result.summary.failed > 0 ? "error" : "success",
        message: `Imported ${result.summary.succeeded} of ${result.summary.attempted} file(s).`,
      });
    } catch (error) {
      setViewState({ status: "error", message: error instanceof Error ? error.message : "Failed to import Hugging Face files." });
    }
  }

  return (
    <section className="ui-stack ui-stack--sm">
      <SettingsPanel
        compact
        title="Hugging Face settings"
        keys={["huggingface.token", "huggingface.defaultNamespace"]}
      />

      <p role="note">Private or gated Hugging Face repositories may require a desktop-host token.</p>

      <div className="ui-grid ui-grid--two">
        <label className="ui-stack ui-stack--sm">
          <span>Namespace</span>
          <input className="ui-input" value={namespace} onChange={(event) => setNamespace(event.target.value)} placeholder="user or organization" required />
        </label>
        <label className="ui-stack ui-stack--sm">
          <span>Revision</span>
          <input className="ui-input" value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="main" />
        </label>
      </div>

      <button className="ui-button" type="button" disabled={viewState.status === "loading" || namespace.trim().length === 0} onClick={() => void loadNamespace()}>
        {viewState.status === "loading" ? "Working..." : "Find datasets"}
      </button>

      {datasets.length > 0 ? (
        <section className="ui-stack ui-stack--sm">
          <div className="ui-grid ui-grid--two">
            <h4>Datasets</h4>
            <button className="ui-button" type="button" onClick={() => setSelectedRepositories(new Set(datasets.map((dataset) => dataset.repository)))}>
              Select all
            </button>
          </div>
          <ul className="ui-stack ui-stack--sm">
            {datasets.map((dataset) => (
              <li key={dataset.repository} className="ui-panel ui-stack ui-stack--sm">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedRepositories.has(dataset.repository)}
                    onChange={(event) => setSelectedRepositories(toggleSet(selectedRepositories, dataset.repository, event.target.checked))}
                  />{" "}
                  {dataset.repository}
                </label>
              </li>
            ))}
          </ul>
          <div className="ui-grid ui-grid--two">
            <button className="ui-button" type="button" disabled={viewState.status === "loading" || selectedRepositoryList.length === 0} onClick={() => void loadSelectedFiles()}>
              Load files
            </button>
            <button className="ui-button" type="button" disabled={viewState.status === "loading" || selectedRepositoryList.length === 0} onClick={() => void importSelectedRepositories()}>
              Import all from selected
            </button>
          </div>
        </section>
      ) : null}

      {loadedFiles.length > 0 ? (
        <section className="ui-stack ui-stack--sm">
          <div className="ui-grid ui-grid--two">
            <h4>Files</h4>
            <button className="ui-button" type="button" onClick={() => setSelectedFiles(new Set(loadedFiles.map(fileKey)))}>
              Select all files
            </button>
          </div>
          <ul className="ui-stack ui-stack--sm">
            {Object.entries(filesByRepository).map(([repository, entry]) => (
              <li key={repository} className="ui-panel ui-stack ui-stack--sm">
                <strong>{repository}</strong>
                {entry.state.message ? <p role={entry.state.status === "error" ? "alert" : "status"}>{entry.state.message}</p> : null}
                {entry.files.map((file) => (
                  <label key={fileKey(file)}>
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(fileKey(file))}
                      onChange={(event) => setSelectedFiles(toggleSet(selectedFiles, fileKey(file), event.target.checked))}
                    />{" "}
                    {file.path}
                  </label>
                ))}
              </li>
            ))}
          </ul>
          <button className="ui-button" type="button" disabled={viewState.status === "loading" || selectedFileList.length === 0} onClick={() => void importSelectedFiles()}>
            Import selected files
          </button>
        </section>
      ) : null}

      {viewState.message ? <p role={viewState.status === "error" ? "alert" : "status"}>{viewState.message}</p> : null}
      {importResult ? <ImportResultSummary result={importResult} /> : null}
    </section>
  );
}

function ImportResultSummary({ result }: { result: DesktopHuggingFaceFilesImportResult }) {
  return (
    <section className="ui-stack ui-stack--sm">
      <h4>Import result</h4>
      <p>{result.summary.succeeded} imported, {result.summary.failed} failed.</p>
      <ul className="ui-stack ui-stack--sm">
        {result.repositories.map((repository) => (
          <li key={`${repository.repository}:${repository.revision}`} className="ui-panel ui-stack ui-stack--sm">
            <strong>{repository.repository}</strong>
            {repository.message ? <p role="alert">{repository.message}</p> : null}
            {repository.files.map((file) => (
              <span key={`${file.repository}:${file.revision}:${file.path}`}>
                {file.status === "registered" ? "Imported" : "Failed"}: {file.path}{file.message ? ` (${file.message})` : ""}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function toggleSet<T>(current: Set<T>, value: T, checked: boolean): Set<T> {
  const next = new Set(current);
  if (checked) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return next;
}

function fileKey(file: DesktopHuggingFaceDatasetParquetFile): string {
  return `${file.repository}:${file.revision}:${file.path}`;
}
