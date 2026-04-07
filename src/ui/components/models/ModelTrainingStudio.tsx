import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ModelCreationPathSupport, ModelCreationSupportState } from "@domain/model-training/ModelCreationSupport";
import type { ModelTrainingJobStudioSummary } from "@application/model-training/contracts";
import type { ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";
import type { ModelTrainingStore, ModelTrainingStoreState } from "../../state/ModelTrainingStore";
import { ROUTE_PATHS } from "../../routes/RouteConfig";
import ExecutionHistoryPanel from "../execution/ExecutionHistoryPanel";
import type { ExecutionHistoryService } from "../../services/ExecutionHistoryService";

const fallbackTrainingState: ModelTrainingStoreState = Object.freeze({
  jobs: Object.freeze([]),
  summary: undefined,
  selectedBaseModelId: undefined,
  selectedDatasetId: undefined,
  selectedDatasetVersionId: undefined,
  pollingActive: false,
  isLoading: false,
  isSubmitting: false,
  promotionJobIds: Object.freeze([]),
  error: undefined,
});

interface ModelTrainingStudioProps {
  readonly modelTrainingStore: ModelTrainingStore;
  readonly executionHistoryService?: ExecutionHistoryService;
}

function supportBadgeClass(state: ModelCreationSupportState): string {
  switch (state) {
    case "available":
      return "ui-badge--success";
    case "degraded":
      return "ui-badge--warning";
    default:
      return "ui-badge--danger";
  }
}

function statusBadgeClass(status: string): string {
  if (["completed", "exported-without-training"].includes(status)) return "ui-badge--success";
  if (["failed", "cancelled", "reconciliation-needed", "partially-completed"].includes(status)) return "ui-badge--warning";
  return "ui-badge--info";
}

function canCancel(status: string): boolean {
  return ["submitted", "queued", "running"].includes(status);
}

export default function ModelTrainingStudio({
  modelTrainingStore,
  executionHistoryService,
}: ModelTrainingStudioProps): JSX.Element {
  const [trainingState, setTrainingState] = useState<ModelTrainingStoreState>(fallbackTrainingState);
  const [jobName, setJobName] = useState("Local support-model run");
  const [epochs, setEpochs] = useState("3");
  const [learningRate, setLearningRate] = useState("0.0001");
  const [batchSize, setBatchSize] = useState("1");
  const [notes, setNotes] = useState("Use the selected dataset version to prepare a truthful bundle or run a narrow local training job.");
  const [executionHistory, setExecutionHistory] = useState<ReadonlyArray<ExecutionRunProjection>>([]);

  useEffect(() => modelTrainingStore.subscribe(setTrainingState), [modelTrainingStore]);

  useEffect(() => {
    void modelTrainingStore.refresh().catch(() => undefined);
  }, [modelTrainingStore]);

  const summary = trainingState.summary;
  const selectedBaseModelId = summary?.selectedBaseModelId;
  const selectedDatasetVersionId = summary?.selectedDatasetVersionId;
  const selectedDatasetId = summary?.selectedDatasetId;
  const selectedBaseModel = useMemo(
    () => summary?.baseModels.find((entry) => entry.id === selectedBaseModelId),
    [selectedBaseModelId, summary?.baseModels],
  );
  const selectedDatasetVersion = useMemo(
    () => summary?.datasetVersions.find((entry) => entry.datasetId === selectedDatasetId && entry.versionId === selectedDatasetVersionId),
    [selectedDatasetId, selectedDatasetVersionId, summary?.datasetVersions],
  );
  const pathSupportById = useMemo(
    () => new Map(summary?.capability.paths.map((entry) => [entry.path, entry]) ?? []),
    [summary?.capability.paths],
  );
  const localTrainingSupport = pathSupportById.get("local-training");
  const exportSupport = pathSupportById.get("export-preparation-only");
  const numericEpochs = Number.parseInt(epochs, 10) || 0;
  const numericLearningRate = Number.parseFloat(learningRate) || 0;
  const numericBatchSize = Number.parseInt(batchSize, 10) || 0;

  useEffect(() => {
    if (!executionHistoryService || !summary?.selectedBaseModelId || !summary.selectedDatasetId || !summary.selectedDatasetVersionId) {
      setExecutionHistory([]);
      return;
    }

    void executionHistoryService.listHistory({
      metadata: {
        baseModelId: summary.selectedBaseModelId,
        datasetId: summary.selectedDatasetId,
        datasetVersionId: summary.selectedDatasetVersionId,
      },
      limit: 8,
    }).then(setExecutionHistory).catch(() => setExecutionHistory([]));
  }, [
    executionHistoryService,
    summary?.selectedBaseModelId,
    summary?.selectedDatasetId,
    summary?.selectedDatasetVersionId,
    trainingState.jobs,
    trainingState.isSubmitting,
  ]);

  const trainingConfigError = useMemo(() => {
    if (numericEpochs < 1) return "Epochs must be at least 1.";
    if (numericLearningRate <= 0) return "Learning rate must be greater than 0.";
    if (numericBatchSize < 1) return "Batch size must be at least 1.";
    return undefined;
  }, [numericBatchSize, numericEpochs, numericLearningRate]);

  const submitJob = (executionKind: "preparation-only" | "local-gradient-training") => {
    if (!summary?.selectedBaseModelId || !summary.selectedDatasetId || !summary.selectedDatasetVersionId) {
      return;
    }
    void modelTrainingStore.submitJob({
      name: jobName,
      baseModelId: summary.selectedBaseModelId,
      datasetId: summary.selectedDatasetId,
      datasetVersionId: summary.selectedDatasetVersionId,
      createdBy: "studio-user",
      executionKind,
      configuration: {
        epochs: Math.max(numericEpochs, 1),
        learningRate: Math.max(numericLearningRate, 0.000001),
        batchSize: Math.max(numericBatchSize, 1),
        notes,
      },
    });
  };

  return (
    <section className="ui-stack ui-stack--md" data-testid="model-training-studio">
      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div>
            <h2>Create a local model</h2>
            <p className="ui-text-secondary">
              Choose between a <strong>bundle-only preparation run</strong> and <strong>real local training</strong>. The studio only shows actions that this
              runtime mode can actually perform right now.
            </p>
          </div>
          {summary ? (
            <div className="ui-panel ui-stack ui-stack--2xs">
              <div className="ui-row ui-row--between ui-row--wrap">
                <strong>{summary.runtimeHeadline}</strong>
                <span className={`ui-badge ${supportBadgeClass(summary.capability.state)}`}>{summary.runtimeStatus}</span>
              </div>
              <p className="ui-text-secondary">{summary.runtimeDetail}</p>
              {summary.runtimeMode === "browser-development" ? (
                <p className="ui-text-secondary ui-text-small">Browser fallback mode is guided and limited. Use the desktop app for full local training and promotion.</p>
              ) : null}
              {summary.modeWarnings.length > 0 ? (
                <ul className="ui-text-secondary ui-text-small">
                  {summary.modeWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="ui-text-secondary">Loading model-creation readinessâ€¦</p>
          )}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap">
            <div>
              <h3>Readiness and prerequisites</h3>
              <p className="ui-text-secondary ui-text-small">
                Check what is ready, what is limited in this mode, and what to do next.
              </p>
            </div>
            <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={() => void modelTrainingStore.refresh()}>
              Refresh studio
            </button>
          </div>
          {summary?.readinessChecks.length ? (
            <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
              {summary.readinessChecks.map((check) => (
                <article key={check.id} className="ui-panel ui-stack ui-stack--2xs">
                  <div className="ui-row ui-row--between ui-row--wrap">
                    <strong>{check.title}</strong>
                    <span className={`ui-badge ${supportBadgeClass(check.state)}`}>{check.state}</span>
                  </div>
                  <p className="ui-text-secondary ui-text-small">{check.detail}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="ui-empty-state">
              <p className="ui-text-secondary">The studio is still gathering readiness details.</p>
            </div>
          )}
          {summary?.recommendedNextSteps.length ? (
            <div className="ui-stack ui-stack--2xs">
              <strong>Recommended next steps</strong>
              <ul className="ui-text-secondary ui-text-small">
                {summary.recommendedNextSteps.map((step) => (
                  <li key={step.id}>
                    <strong>{step.label}</strong> â€” {step.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div>
            <h3>Choose your creation path</h3>
            <p className="ui-text-secondary ui-text-small">
              The studio keeps bundle preparation separate from real training, so you always know what the output actually means.
            </p>
          </div>
          <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
            {summary?.capability.paths.map((path) => (
              <PathSupportCard key={path.path} support={path} />
            ))}
          </div>
        </div>
      </div>

      <ExecutionHistoryPanel
        title="Execution history"
        subtitle="Durable execution-engine runs for truthful bundle preparation and local training lifecycles."
        items={executionHistory}
        emptyMessage="No durable execution-engine runs have been recorded for this model-training selection yet."
        executionHistoryService={executionHistoryService}
      />

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div>
            <h3>Configure your job</h3>
            <p className="ui-text-secondary ui-text-small">
              Pick the base model and dataset version first. The form stays available, but the action buttons only enable the paths that are truly supported.
            </p>
          </div>
          <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
            <label className="ui-field">
              <span className="ui-field__label">Job name</span>
              <input className="ui-input" value={jobName} onChange={(event) => setJobName(event.target.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Base model</span>
              <select
                className="ui-input"
                value={selectedBaseModelId ?? ""}
                onChange={(event) => {
                  const nextBaseModelId = event.target.value;
                  void modelTrainingStore.updateSelection({ selectedBaseModelId: nextBaseModelId });
                }}
              >
                {(summary?.baseModels ?? []).map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
              {!summary?.baseModels.length ? (
                <span className="ui-text-secondary ui-text-small">
                  No installed base models yet. <Link to={ROUTE_PATHS.models}>Use Download Models</Link> to add one first.
                </span>
              ) : selectedBaseModel?.localTrainingReason ? (
                <span className="ui-text-secondary ui-text-small">{selectedBaseModel.localTrainingReason}</span>
              ) : null}
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Dataset version</span>
              <select
                className="ui-input"
                value={selectedDatasetVersionId ?? ""}
                onChange={(event) => {
                  const versionId = event.target.value;
                  const next = summary?.datasetVersions.find((entry) => entry.versionId === versionId);
                  if (!next) return;
                  void modelTrainingStore.updateSelection({
                    selectedDatasetId: next.datasetId,
                    selectedDatasetVersionId: next.versionId,
                  });
                }}
              >
                {(summary?.datasetVersions ?? []).map((option) => (
                  <option key={`${option.datasetId}:${option.versionId}`} value={option.versionId}>
                    {option.datasetName} Â· {option.versionLabel} Â· {option.taskType}
                  </option>
                ))}
              </select>
              {!summary?.datasetVersions.length ? (
                <span className="ui-text-secondary ui-text-small">
                  No dataset versions are ready yet. <Link to={`${ROUTE_PATHS.context}?tab=fine-tuning-dataset`}>Open the dataset studio</Link> to create one.
                </span>
              ) : selectedDatasetVersion?.localTrainingReason ? (
                <span className="ui-text-secondary ui-text-small">{selectedDatasetVersion.localTrainingReason}</span>
              ) : null}
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
            <span className="ui-field__label">Notes</span>
            <textarea className="ui-input" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {trainingConfigError ? <p className="ui-text-danger">{trainingConfigError}</p> : null}
          <div className="ui-row ui-row--wrap" style={{ gap: "0.75rem" }}>
            <button
              className="ui-button ui-button--primary"
              type="button"
              disabled={Boolean(trainingConfigError) || trainingState.isSubmitting || localTrainingSupport?.state === "unavailable"}
              onClick={() => submitJob("local-gradient-training")}
            >
              {trainingState.isSubmitting ? "Startingâ€¦" : "Start local training"}
            </button>
            <button
              className="ui-button ui-button--secondary"
              type="button"
              disabled={Boolean(trainingConfigError) || trainingState.isSubmitting || exportSupport?.state === "unavailable"}
              onClick={() => submitJob("preparation-only")}
            >
              Prepare bundle only
            </button>
            <button className="ui-button ui-button--secondary" type="button" onClick={() => void modelTrainingStore.refreshActiveJobs()}>
              {trainingState.pollingActive ? "Refresh active jobs (auto-refresh on)" : "Refresh active jobs"}
            </button>
          </div>
          {localTrainingSupport?.state === "unavailable" ? <BlockerList blockers={localTrainingSupport.blockers} /> : null}
          {trainingState.error ? <p className="ui-text-danger">{trainingState.error}</p> : null}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap">
            <div>
              <h3>Job history and outputs</h3>
              <p className="ui-text-secondary ui-text-small">
                Review what finished, inspect the output artifact, and add completed local results to the installed model library when this mode supports it.
              </p>
            </div>
            <div className="ui-text-secondary ui-text-small">
              {trainingState.isLoading ? "Loadingâ€¦" : `${trainingState.jobs.length} jobs`}
              {trainingState.pollingActive ? " Â· auto-refreshing active jobs" : ""}
            </div>
          </div>

          {summary?.jobs.length ? (
            <div className="ui-stack ui-stack--sm">
              {summary.jobs.map((entry) => (
                <JobCard
                  key={entry.job.id}
                  entry={entry}
                  isPromoting={trainingState.promotionJobIds.includes(entry.job.id)}
                  onRefresh={() => void modelTrainingStore.refreshJob(entry.job.id)}
                  onReconcile={() => void modelTrainingStore.reconcileJob(entry.job.id)}
                  onCancel={() => void modelTrainingStore.cancelJob(entry.job.id)}
                  onPromote={() => void modelTrainingStore.promoteJob(entry.job.id)}
                />
              ))}
            </div>
          ) : (
            <div className="ui-empty-state ui-stack ui-stack--2xs">
              <h4>No jobs yet</h4>
              <p className="ui-text-secondary">
                Once you start a bundle-preparation run or a local training job, the output history will appear here.
              </p>
              <p className="ui-text-secondary ui-text-small">
                Tip: if you are just getting started, choose a base model, pick a dataset version, and try <strong>Prepare bundle only</strong> first.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PathSupportCard({ support }: { readonly support: ModelCreationPathSupport }): JSX.Element {
  return (
    <article className="ui-panel ui-stack ui-stack--2xs">
      <div className="ui-row ui-row--between ui-row--wrap">
        <strong>{support.title}</strong>
        <span className={`ui-badge ${supportBadgeClass(support.state)}`}>{support.state}</span>
      </div>
      <p className="ui-text-secondary ui-text-small">{support.summary}</p>
      <BlockerList blockers={support.blockers} />
      {support.warnings.length > 0 ? (
        <ul className="ui-text-secondary ui-text-small">
          {support.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
    </article>
  );
}

function BlockerList({ blockers }: { readonly blockers: ReadonlyArray<{ readonly code: string; readonly message: string; readonly detail?: string }> }): JSX.Element | null {
  if (!blockers.length) {
    return null;
  }

  return (
    <div className="ui-stack ui-stack--2xs">
      <strong>What is blocking this path</strong>
      <ul className="ui-text-secondary ui-text-small">
        {blockers.map((blocker) => (
          <li key={`${blocker.code}:${blocker.message}`}>
            <strong>{blocker.message}</strong>
            {blocker.detail ? ` â€” ${blocker.detail}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobCard(props: {
  readonly entry: ModelTrainingJobStudioSummary;
  readonly isPromoting: boolean;
  readonly onRefresh: () => void;
  readonly onReconcile: () => void;
  readonly onCancel: () => void;
  readonly onPromote: () => void;
}): JSX.Element {
  const { entry, isPromoting, onCancel, onPromote, onReconcile, onRefresh } = props;
  return (
    <article className="ui-panel ui-stack ui-stack--sm">
      <div className="ui-row ui-row--between ui-row--wrap">
        <div>
          <strong>{entry.job.name}</strong>
          <div className="ui-text-secondary ui-text-small">{entry.userFacingStatus}</div>
        </div>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          <span className={`ui-badge ${entry.job.executionKind === "preparation-only" ? "ui-badge--warning" : "ui-badge--info"}`}>
            {entry.job.executionKind === "preparation-only" ? "bundle only" : "local training"}
          </span>
          <span className={`ui-badge ${statusBadgeClass(entry.job.status)}`}>{entry.job.status}</span>
        </div>
      </div>

      <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
        <div className="ui-stack ui-stack--2xs">
          <strong>Output summary</strong>
          <div className="ui-text-secondary ui-text-small">{entry.job.summary ?? "No summary from the runtime yet."}</div>
          {entry.primaryArtifact ? (
            <div className="ui-text-secondary ui-text-small">
              Primary output: <strong>{entry.primaryArtifact.label}</strong>
              {entry.primaryArtifact.location ? ` â€” ${entry.primaryArtifact.location}` : ""}
            </div>
          ) : (
            <div className="ui-text-secondary ui-text-small">No output artifact has been recorded yet.</div>
          )}
          <div className="ui-text-secondary ui-text-small">Post-training next step: {entry.promotion.detail}</div>
        </div>
        <div className="ui-stack ui-stack--2xs">
          <strong>Progress</strong>
          {entry.job.progress ? (
            <div className="ui-text-secondary ui-text-small">
              {entry.job.progress.percent}%
              {entry.job.progress.currentEpoch ? ` Â· epoch ${entry.job.progress.currentEpoch}/${entry.job.progress.totalEpochs ?? entry.job.configuration.epochs}` : ""}
              {entry.job.progress.latestMetricName ? ` Â· ${entry.job.progress.latestMetricName}: ${entry.job.progress.latestMetricValue}` : ""}
            </div>
          ) : (
            <div className="ui-text-secondary ui-text-small">No live progress details are available for this job.</div>
          )}
          {entry.job.diagnostics.length > 0 ? (
            <div className="ui-stack ui-stack--2xs">
              <strong>User-facing diagnostics</strong>
              {entry.job.diagnostics.map((diagnostic) => (
                <div key={`${entry.job.id}:${diagnostic.code}:${diagnostic.detail ?? ""}`} className="ui-text-secondary ui-text-small">
                  {diagnostic.message}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={onRefresh}>Refresh</button>
        <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={onReconcile}>Reconcile</button>
        {canCancel(entry.job.status) ? (
          <button className="ui-button ui-button--secondary ui-button--sm" type="button" onClick={onCancel}>Cancel</button>
        ) : null}
        <button
          className="ui-button ui-button--secondary ui-button--sm"
          type="button"
          disabled={entry.promotion.state !== "available" || isPromoting}
          onClick={onPromote}
        >
          {isPromoting ? "Adding to libraryâ€¦" : entry.promotion.label}
        </button>
      </div>

      <details>
        <summary>Technical details</summary>
        <div className="ui-stack ui-stack--2xs" style={{ marginTop: "0.75rem" }}>
          <div className="ui-text-secondary ui-text-small">{entry.technicalSummary}</div>
          <div className="ui-text-secondary ui-text-small">Runtime path: {entry.job.provenance.path}</div>
          <div className="ui-grid ui-grid--2col" style={{ gap: "1rem" }}>
            <div>
              <strong>Artifacts</strong>
              <ul>
                {entry.job.artifacts.map((artifact) => (
                  <li key={artifact.id}>{artifact.kind} Â· {artifact.label}{artifact.location ? ` â€” ${artifact.location}` : ""}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Checkpoints</strong>
              <ul>
                {entry.job.checkpoints.map((checkpoint) => (
                  <li key={checkpoint.id}>{checkpoint.label} Â· epoch {checkpoint.epoch}{checkpoint.metricName ? ` Â· ${checkpoint.metricName}: ${checkpoint.metricValue}` : ""}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </details>
    </article>
  );
}

