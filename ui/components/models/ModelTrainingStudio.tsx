import { useEffect, useMemo, useState } from "react";
import type { IModelStoreState } from "../../state/ModelStore";
import type { ModelTrainingStore, ModelTrainingStoreState } from "../../state/ModelTrainingStore";
import type { TuningDatasetStore, TuningDatasetStoreState } from "../../state/TuningDatasetStore";

const fallbackTrainingState: ModelTrainingStoreState = Object.freeze({
  jobs: Object.freeze([]),
  isLoading: false,
  isSubmitting: false,
  error: undefined,
});

const fallbackDatasetState: TuningDatasetStoreState = Object.freeze({
  datasets: Object.freeze([]),
  selectedDatasetId: undefined,
  selectedVersionId: undefined,
  selectedDataset: undefined,
  examples: Object.freeze([]),
  selectedExampleIds: Object.freeze([]),
  sourceDocuments: Object.freeze([]),
  validation: undefined,
  statistics: undefined,
  exports: Object.freeze([]),
  duplicates: Object.freeze([]),
  workflow: undefined,
  wizard: { steps: Object.freeze([]), currentStepId: "dataset_definition" } as never,
  currentWorkflowStage: "dataset_definition",
  isLoading: false,
  isMutating: false,
  error: undefined,
});

interface ModelTrainingStudioProps {
  readonly modelState: IModelStoreState;
  readonly modelTrainingStore: ModelTrainingStore;
  readonly tuningDatasetStore: TuningDatasetStore;
}

export default function ModelTrainingStudio({
  modelState,
  modelTrainingStore,
  tuningDatasetStore,
}: ModelTrainingStudioProps): JSX.Element {
  const [trainingState, setTrainingState] = useState<ModelTrainingStoreState>(fallbackTrainingState);
  const [datasetState, setDatasetState] = useState<TuningDatasetStoreState>(fallbackDatasetState);
  const [jobName, setJobName] = useState("Managed fine-tune job");
  const [baseModelId, setBaseModelId] = useState("");
  const [datasetVersionKey, setDatasetVersionKey] = useState("");
  const [epochs, setEpochs] = useState("3");
  const [learningRate, setLearningRate] = useState("0.0001");
  const [batchSize, setBatchSize] = useState("2");
  const [notes, setNotes] = useState("Produce a provider-ready adapter bundle and manifest for managed review.");

  useEffect(() => modelTrainingStore.subscribe(setTrainingState), [modelTrainingStore]);
  useEffect(() => tuningDatasetStore.subscribe(setDatasetState), [tuningDatasetStore]);

  useEffect(() => {
    void modelTrainingStore.refresh().catch(() => undefined);
    void tuningDatasetStore.initialize().catch(() => undefined);
  }, [modelTrainingStore, tuningDatasetStore]);

  const baseModelOptions = useMemo(
    () => modelState.installedModels.filter((model) => model.isAvailable()),
    [modelState.installedModels],
  );

  useEffect(() => {
    if (!baseModelId && baseModelOptions[0]) {
      setBaseModelId(baseModelOptions[0].id);
    }
  }, [baseModelId, baseModelOptions]);

  const datasetVersionOptions = useMemo(
    () => datasetState.datasets.flatMap((entry) =>
      entry.selectedVersion
        ? [{
            key: `${entry.dataset.id}::${entry.selectedVersion.id}`,
            datasetId: entry.dataset.id,
            datasetName: entry.dataset.name,
            versionId: entry.selectedVersion.id,
            versionLabel: `v${entry.selectedVersion.versionNumber}`,
          }]
        : []),
    [datasetState.datasets],
  );

  useEffect(() => {
    if (!datasetVersionKey && datasetVersionOptions[0]) {
      setDatasetVersionKey(datasetVersionOptions[0].key);
    }
  }, [datasetVersionKey, datasetVersionOptions]);

  const selectedDatasetVersion = datasetVersionOptions.find((option) => option.key === datasetVersionKey);

  return (
    <section className="ui-stack ui-stack--md" data-testid="model-training-studio">
      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div>
            <h2>Fine-tune a managed model</h2>
            <p className="ui-text-secondary">
              This first supported path submits a truthful fine-tuning job to the Python runtime manifest backend, persists the job durably, and records diagnostics, checkpoints, and output artifacts for review.
            </p>
          </div>
          <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
            <label className="ui-field">
              <span className="ui-field__label">Job name</span>
              <input className="ui-input" value={jobName} onChange={(event) => setJobName(event.target.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Base model</span>
              <select className="ui-input" value={baseModelId} onChange={(event) => setBaseModelId(event.target.value)}>
                {baseModelOptions.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Dataset version</span>
              <select className="ui-input" value={datasetVersionKey} onChange={(event) => setDatasetVersionKey(event.target.value)}>
                {datasetVersionOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.datasetName} · {option.versionLabel}</option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Epochs</span>
              <input className="ui-input" type="number" min={1} value={epochs} onChange={(event) => setEpochs(event.target.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Learning rate</span>
              <input className="ui-input" type="number" step="0.0001" min={0.0001} value={learningRate} onChange={(event) => setLearningRate(event.target.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Batch size</span>
              <input className="ui-input" type="number" min={1} value={batchSize} onChange={(event) => setBatchSize(event.target.value)} />
            </label>
          </div>
          <label className="ui-field">
            <span className="ui-field__label">Training notes</span>
            <textarea className="ui-input" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="ui-row ui-row--wrap">
            <button
              className="ui-button ui-button--primary"
              type="button"
              disabled={!baseModelId || !selectedDatasetVersion || trainingState.isSubmitting}
              onClick={() => {
                if (!selectedDatasetVersion) {
                  return;
                }
                void modelTrainingStore.submitJob({
                  name: jobName,
                  baseModelId,
                  datasetId: selectedDatasetVersion.datasetId,
                  datasetVersionId: selectedDatasetVersion.versionId,
                  createdBy: "studio-user",
                  configuration: {
                    epochs: Number.parseInt(epochs, 10) || 1,
                    learningRate: Number.parseFloat(learningRate) || 0.0001,
                    batchSize: Number.parseInt(batchSize, 10) || 1,
                    notes,
                  },
                });
              }}
            >
              {trainingState.isSubmitting ? "Submitting…" : "Submit fine-tuning job"}
            </button>
            <button className="ui-button ui-button--secondary" type="button" onClick={() => void modelTrainingStore.refresh()}>
              Refresh job state
            </button>
          </div>
          {trainingState.error ? <p className="ui-text-danger">{trainingState.error}</p> : null}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap">
            <div>
              <h3>Fine-tuning jobs</h3>
              <p className="ui-text-secondary ui-text-small">
                Jobs are persisted durably and mirror the Python runtime backend response rather than optimistic UI-only state.
              </p>
            </div>
            <div className="ui-text-secondary ui-text-small">{trainingState.isLoading ? "Loading…" : `${trainingState.jobs.length} jobs`}</div>
          </div>

          {trainingState.jobs.length === 0 ? (
            <div className="ui-empty-state">
              <p className="ui-text-secondary">No fine-tuning jobs have been submitted yet.</p>
            </div>
          ) : (
            <div className="ui-stack ui-stack--sm">
              {trainingState.jobs.map((job) => (
                <article key={job.id} className="ui-panel ui-stack ui-stack--sm">
                  <div className="ui-row ui-row--between ui-row--wrap">
                    <div>
                      <strong>{job.name}</strong>
                      <div className="ui-text-secondary ui-text-small">{job.outputModelName ?? job.baseModelId}</div>
                    </div>
                    <span className={`ui-badge ${job.status === "completed" ? "ui-badge--success" : job.status === "failed" ? "ui-badge--danger" : "ui-badge--info"}`}>{job.status}</span>
                  </div>
                  <div className="ui-text-secondary ui-text-small">
                    Backend: <strong>{job.backend}</strong> · Dataset version: <strong>{job.datasetVersionId}</strong>
                  </div>
                  {job.summary ? <p className="ui-text-secondary">{job.summary}</p> : null}
                  {job.diagnostics.length > 0 ? (
                    <div className="ui-stack ui-stack--2xs">
                      <strong>Diagnostics</strong>
                      {job.diagnostics.map((diagnostic) => (
                        <div key={`${job.id}:${diagnostic.code}`} className="ui-text-secondary ui-text-small">
                          {diagnostic.level.toUpperCase()} · {diagnostic.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
                    <div>
                      <strong>Artifacts</strong>
                      <ul>
                        {job.artifacts.map((artifact) => (
                          <li key={artifact.id}>{artifact.label}{artifact.location ? ` — ${artifact.location}` : ""}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>Checkpoints</strong>
                      <ul>
                        {job.checkpoints.map((checkpoint) => (
                          <li key={checkpoint.id}>{checkpoint.label} · epoch {checkpoint.epoch}{checkpoint.metricName ? ` · ${checkpoint.metricName}: ${checkpoint.metricValue}` : ""}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
