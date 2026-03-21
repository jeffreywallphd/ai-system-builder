import { useEffect, useMemo, useState } from "react";
import { EXPORT_FORMATS, type ExampleStatus, type SplitType } from "../../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import { useUiDependencies } from "../../composition/AppProviders";
import PageTabs from "../navigation/PageTabs";
import type { TuningDatasetStoreState } from "../../state/TuningDatasetStore";

const fallbackState: TuningDatasetStoreState = Object.freeze({
  datasets: Object.freeze([]),
  selectedDatasetId: undefined,
  selectedDataset: undefined,
  examples: Object.freeze([]),
  sourceDocuments: Object.freeze([]),
  validation: undefined,
  statistics: undefined,
  exports: Object.freeze([]),
  duplicates: Object.freeze([]),
  activeWorkspaceTab: "overview",
  isLoading: false,
  isMutating: false,
  error: undefined,
});

function downloadArtifact(fileName: string, content: string, contentType: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function FineTuningDatasetStudio(): JSX.Element {
  const { tuningDatasetStore } = useUiDependencies();
  const [state, setState] = useState<TuningDatasetStoreState>(() => tuningDatasetStore.getState() || fallbackState);
  const [datasetName, setDatasetName] = useState("");
  const [datasetDescription, setDatasetDescription] = useState("");
  const [datasetType, setDatasetType] = useState<"question_answering">("question_answering");
  const [sourceName, setSourceName] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<ReadonlyArray<string>>([]);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [draftEdits, setDraftEdits] = useState<Record<string, { question: string; answer: string; context: string; status: ExampleStatus; split: SplitType }>>({});

  useEffect(() => tuningDatasetStore.subscribe(setState), [tuningDatasetStore]);

  useEffect(() => {
    void tuningDatasetStore.initialize().catch(() => undefined);
  }, [tuningDatasetStore]);

  useEffect(() => {
    setSelectedSourceIds((current) => current.filter((id) => state.sourceDocuments.some((document) => document.id === id)));
  }, [state.sourceDocuments]);

  const latestVersion = state.selectedDataset?.latestVersion;
  const datasetTaskOptions = useMemo(
    () => [
      { value: "question_answering", label: "Question Answering / Generative QA", available: true },
      { value: "chat_completion", label: "Chat Completion", available: false },
      { value: "instruction_response", label: "Instruction Response", available: false },
      { value: "classification", label: "Classification", available: false },
      { value: "extraction", label: "Extraction", available: false },
      { value: "preference", label: "Preference", available: false },
      { value: "tool_calling", label: "Tool Calling", available: false },
    ],
    [],
  );

  const workspaceTabs = [
    { id: "overview", label: "Overview", description: "Dataset summary and creation." },
    { id: "sources", label: "Sources", description: "Import and select source material." },
    { id: "examples", label: "Examples", description: "Review and edit generated QA pairs." },
    { id: "validation", label: "Validation", description: "Inspect quality checks and issues." },
    { id: "splits", label: "Splits", description: "Assign train/validation/test." },
    { id: "versions", label: "Versions", description: "Release and version history." },
    { id: "exports", label: "Exports", description: "Download released artifacts." },
  ] as const;

  return (
    <section className="ui-stack ui-stack--md" data-testid="fine-tuning-dataset-studio">
      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap">
            <div className="ui-stack ui-stack--2xs">
              <h2>Fine-Tuning Dataset Studio</h2>
              <p className="ui-text-secondary">
                Build governed supervised-tuning datasets with versioning, validation, review workflow, split management, and export controls.
              </p>
            </div>
            <div className="ui-meta-grid" style={{ minWidth: "280px" }}>
              <div className="ui-meta-item">
                <span className="ui-meta-label">Datasets</span>
                <span className="ui-meta-value">{state.datasets.length}</span>
              </div>
              <div className="ui-meta-item">
                <span className="ui-meta-label">Examples</span>
                <span className="ui-meta-value">{state.statistics?.exampleCount ?? state.examples.length}</span>
              </div>
              <div className="ui-meta-item">
                <span className="ui-meta-label">Sources</span>
                <span className="ui-meta-value">{state.sourceDocuments.length}</span>
              </div>
              <div className="ui-meta-item">
                <span className="ui-meta-label">Status</span>
                <span className="ui-meta-value">{state.selectedDataset?.dataset.status ?? "No dataset selected"}</span>
              </div>
            </div>
          </div>
          {state.error ? <p className="ui-text-secondary">{state.error}</p> : null}
        </div>
      </div>

      <div className="ui-context-browser">
        <aside className="ui-context-browser__sidebar">
          <div className="ui-card">
            <div className="ui-card__body ui-stack ui-stack--sm">
              <div className="ui-row ui-row--between ui-row--wrap">
                <h3>Dataset catalog</h3>
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => tuningDatasetStore.setActiveWorkspaceTab("overview")}>Create</button>
              </div>
              {state.datasets.length > 0 ? state.datasets.map((summary) => (
                <button
                  key={summary.dataset.id}
                  type="button"
                  className={`ui-card ui-card--interactive${summary.dataset.id === state.selectedDatasetId ? " is-selected" : ""}`}
                  style={{ textAlign: "left" }}
                  onClick={() => {
                    void tuningDatasetStore.selectDataset(summary.dataset.id).catch(() => undefined);
                  }}
                >
                  <div className="ui-card__body ui-stack ui-stack--2xs">
                    <strong>{summary.dataset.name}</strong>
                    <span className="ui-text-secondary ui-text-small">{summary.dataset.taskType}</span>
                    <span className="ui-text-secondary ui-text-small">Status: {summary.dataset.status}</span>
                    <span className="ui-text-secondary ui-text-small">Version: {summary.latestVersion?.versionNumber ?? "—"} · Examples: {summary.exampleCount}</span>
                  </div>
                </button>
              )) : (
                <div className="ui-empty-state">
                  <h3>No fine-tuning datasets yet</h3>
                  <p className="ui-text-secondary">Create a question answering dataset to start importing sources and generating QA pairs.</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="ui-context-browser__editor ui-stack ui-stack--md">
          <PageTabs
            label="Fine-tuning dataset workspace tabs"
            tabs={workspaceTabs}
            activeTabId={state.activeWorkspaceTab}
            onChange={(tabId) => tuningDatasetStore.setActiveWorkspaceTab(tabId as TuningDatasetStoreState["activeWorkspaceTab"])}
          />

          <section id="page-tabpanel-overview" role="tabpanel" aria-labelledby="page-tab-overview" className="ui-page-tab-panel" hidden={state.activeWorkspaceTab !== "overview"}>
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--md">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div>
                    <h3>Create dataset</h3>
                    <p className="ui-text-secondary">Model multiple supervised task types at the domain level, with full UI/storage/export support for Generative QA in this release.</p>
                  </div>
                  {state.selectedDataset ? (
                    <button
                      type="button"
                      className="ui-button ui-button--secondary ui-button--sm"
                      onClick={() => {
                        void tuningDatasetStore.selectDataset(state.selectedDataset?.dataset.id).catch(() => undefined);
                      }}
                    >
                      Refresh details
                    </button>
                  ) : null}
                </div>

                <div className="ui-grid ui-grid--2col" style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  <label className="ui-field ui-stack ui-stack--2xs">
                    <span className="ui-field__label">Dataset name</span>
                    <input className="ui-input" value={datasetName} onChange={(event) => setDatasetName(event.target.value)} placeholder="Customer support QA" />
                  </label>
                  <label className="ui-field ui-stack ui-stack--2xs">
                    <span className="ui-field__label">Dataset type</span>
                    <select className="ui-input" value={datasetType} onChange={(event) => setDatasetType(event.target.value as "question_answering") }>
                      {datasetTaskOptions.map((option) => (
                        <option key={option.value} value={option.value} disabled={!option.available}>
                          {option.label}{option.available ? "" : " (modeled for later)"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="ui-field ui-stack ui-stack--2xs">
                  <span className="ui-field__label">Description</span>
                  <textarea className="ui-input" rows={4} value={datasetDescription} onChange={(event) => setDatasetDescription(event.target.value)} placeholder="Describe scope, intended model behavior, and source provenance." />
                </label>

                <div className="ui-page__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--primary"
                    disabled={state.isMutating || !datasetName.trim()}
                    onClick={() => {
                      void tuningDatasetStore.createDataset({
                        name: datasetName,
                        description: datasetDescription,
                        taskType: datasetType,
                        createdBy: "ui-user",
                      }).then(() => {
                        setDatasetName("");
                        setDatasetDescription("");
                      }).catch(() => undefined);
                    }}
                  >
                    Create dataset
                  </button>
                </div>

                {state.selectedDataset ? (
                  <div className="ui-stack ui-stack--sm">
                    <h3>{state.selectedDataset.dataset.name}</h3>
                    <div className="ui-meta-grid">
                      <div className="ui-meta-item"><span className="ui-meta-label">Task type</span><span className="ui-meta-value">{state.selectedDataset.dataset.taskType}</span></div>
                      <div className="ui-meta-item"><span className="ui-meta-label">Latest version</span><span className="ui-meta-value">{latestVersion ? `v${latestVersion.versionNumber}` : "Not created"}</span></div>
                      <div className="ui-meta-item"><span className="ui-meta-label">Version status</span><span className="ui-meta-value">{latestVersion?.status ?? "draft"}</span></div>
                      <div className="ui-meta-item"><span className="ui-meta-label">Examples</span><span className="ui-meta-value">{state.statistics?.exampleCount ?? state.examples.length}</span></div>
                    </div>
                    <p className="ui-text-secondary">{state.selectedDataset.dataset.description || "No description yet."}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section id="page-tabpanel-sources" role="tabpanel" aria-labelledby="page-tab-sources" className="ui-page-tab-panel" hidden={state.activeWorkspaceTab !== "sources"}>
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--md">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div>
                    <h3>Source ingestion</h3>
                    <p className="ui-text-secondary">Paste or upload source text to anchor QA examples to governed source material.</p>
                  </div>
                  <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={!latestVersion} onClick={() => latestVersion && tuningDatasetStore.setActiveWorkspaceTab("examples")}>Review examples</button>
                </div>

                {!latestVersion ? <p className="ui-text-secondary">Create or select a dataset first to import sources.</p> : (
                  <>
                    <div className="ui-grid ui-grid--2col" style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                      <label className="ui-field ui-stack ui-stack--2xs">
                        <span className="ui-field__label">Source document name</span>
                        <input className="ui-input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Product FAQ excerpt" />
                      </label>
                    </div>
                    <label className="ui-field ui-stack ui-stack--2xs">
                      <span className="ui-field__label">Source text</span>
                      <textarea className="ui-input" rows={10} value={sourceContent} onChange={(event) => setSourceContent(event.target.value)} placeholder="Paste source content used to generate QA examples." />
                    </label>
                    <div className="ui-page__actions">
                      <button
                        type="button"
                        className="ui-button ui-button--primary"
                        disabled={state.isMutating || !sourceName.trim() || !sourceContent.trim()}
                        onClick={() => {
                          void tuningDatasetStore.importSources(state.selectedDataset!.dataset.id, latestVersion.id, "ui-user", [{ name: sourceName, content: sourceContent }]).then(() => {
                            setSourceName("");
                            setSourceContent("");
                          }).catch(() => undefined);
                        }}
                      >
                        Add source document
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button--secondary"
                        disabled={state.isMutating || selectedSourceIds.length === 0}
                        onClick={() => {
                          void tuningDatasetStore.generateQaExamples(state.selectedDataset!.dataset.id, latestVersion.id, "ui-user", selectedSourceIds).catch(() => undefined);
                        }}
                      >
                        Generate QA examples
                      </button>
                    </div>

                    <div className="ui-stack ui-stack--sm">
                      <h4>Imported sources</h4>
                      {state.sourceDocuments.length > 0 ? state.sourceDocuments.map((document) => {
                        const checked = selectedSourceIds.includes(document.id);
                        return (
                          <label key={document.id} className="ui-card" style={{ cursor: "pointer" }}>
                            <div className="ui-card__body ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                              <div className="ui-stack ui-stack--2xs" style={{ flex: 1 }}>
                                <span><strong>{document.name}</strong></span>
                                <span className="ui-text-secondary ui-text-small">{document.content.slice(0, 220)}{document.content.length > 220 ? "…" : ""}</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => setSelectedSourceIds((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))}
                              />
                            </div>
                          </label>
                        );
                      }) : <p className="ui-text-secondary">No sources imported yet.</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          <section id="page-tabpanel-examples" role="tabpanel" aria-labelledby="page-tab-examples" className="ui-page-tab-panel" hidden={state.activeWorkspaceTab !== "examples"}>
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--md">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div>
                    <h3>QA examples</h3>
                    <p className="ui-text-secondary">Review, edit, accept, reject, or delete generated question-answer pairs before release.</p>
                  </div>
                  {latestVersion ? (
                    <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => tuningDatasetStore.setActiveWorkspaceTab("validation")}>View validation</button>
                  ) : null}
                </div>

                {state.examples.length === 0 || !latestVersion ? <p className="ui-text-secondary">Generate examples from imported sources to begin review.</p> : state.examples.map((example) => {
                  const draft = draftEdits[example.id] ?? {
                    question: example.question,
                    answer: example.answer,
                    context: example.context,
                    status: example.status,
                    split: example.split,
                  };
                  return (
                    <div key={example.id} className="ui-card">
                      <div className="ui-card__body ui-stack ui-stack--sm">
                        <div className="ui-row ui-row--between ui-row--wrap">
                          <div className="ui-stack ui-stack--2xs">
                            <strong>{example.id}</strong>
                            <span className="ui-text-secondary ui-text-small">Source: {example.sourceMetadata?.sourceName ? String(example.sourceMetadata.sourceName) : example.sourceDocumentId ?? "manual"}</span>
                          </div>
                          <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-xs)" }}>
                            <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => {
                              void tuningDatasetStore.reviewExample(state.selectedDataset!.dataset.id, latestVersion.id, example.id, "accepted", "reviewer", "Accepted for release").catch(() => undefined);
                            }}>Accept</button>
                            <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => {
                              void tuningDatasetStore.reviewExample(state.selectedDataset!.dataset.id, latestVersion.id, example.id, "needs_review", "reviewer", "Needs follow-up review").catch(() => undefined);
                            }}>Needs review</button>
                            <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => {
                              void tuningDatasetStore.reviewExample(state.selectedDataset!.dataset.id, latestVersion.id, example.id, "rejected", "reviewer", "Rejected during review").catch(() => undefined);
                            }}>Reject</button>
                            <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => {
                              void tuningDatasetStore.deleteExample(state.selectedDataset!.dataset.id, latestVersion.id, example.id).catch(() => undefined);
                            }}>Delete</button>
                          </div>
                        </div>

                        <label className="ui-field ui-stack ui-stack--2xs">
                          <span className="ui-field__label">Question</span>
                          <textarea className="ui-input" rows={2} value={draft.question} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, question: event.target.value } }))} />
                        </label>
                        <label className="ui-field ui-stack ui-stack--2xs">
                          <span className="ui-field__label">Answer</span>
                          <textarea className="ui-input" rows={4} value={draft.answer} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, answer: event.target.value } }))} />
                        </label>
                        <label className="ui-field ui-stack ui-stack--2xs">
                          <span className="ui-field__label">Context</span>
                          <textarea className="ui-input" rows={5} value={draft.context} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, context: event.target.value } }))} />
                        </label>
                        <div className="ui-grid ui-grid--2col" style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                          <label className="ui-field ui-stack ui-stack--2xs">
                            <span className="ui-field__label">Status</span>
                            <select className="ui-input" value={draft.status} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, status: event.target.value as ExampleStatus } }))}>
                              <option value="draft">draft</option>
                              <option value="accepted">accepted</option>
                              <option value="rejected">rejected</option>
                              <option value="needs_review">needs_review</option>
                            </select>
                          </label>
                          <label className="ui-field ui-stack ui-stack--2xs">
                            <span className="ui-field__label">Split</span>
                            <select className="ui-input" value={draft.split} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, split: event.target.value as SplitType } }))}>
                              <option value="train">train</option>
                              <option value="validation">validation</option>
                              <option value="test">test</option>
                            </select>
                          </label>
                        </div>
                        <div className="ui-page__actions">
                          <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => {
                            void tuningDatasetStore.updateExample(state.selectedDataset!.dataset.id, latestVersion.id, example.id, { ...draft, updatedBy: "ui-user", annotationNote: "Edited example in dataset studio" }).then(() => {
                              setDraftEdits((current) => {
                                const next = { ...current };
                                delete next[example.id];
                                return next;
                              });
                            }).catch(() => undefined);
                          }}>Save example</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="page-tabpanel-validation" role="tabpanel" aria-labelledby="page-tab-validation" className="ui-page-tab-panel" hidden={state.activeWorkspaceTab !== "validation"}>
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--md">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div>
                    <h3>Validation</h3>
                    <p className="ui-text-secondary">Run dataset checks for required fields, duplicates, and review readiness.</p>
                  </div>
                  {latestVersion ? <button type="button" className="ui-button ui-button--primary" onClick={() => {
                    void tuningDatasetStore.validateDataset(state.selectedDataset!.dataset.id, latestVersion.id).catch(() => undefined);
                  }}>Run validation</button> : null}
                </div>
                <div className="ui-meta-grid">
                  <div className="ui-meta-item"><span className="ui-meta-label">Blocking errors</span><span className="ui-meta-value">{state.validation?.blockingIssueCount ?? 0}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Warnings</span><span className="ui-meta-value">{state.validation?.warningCount ?? 0}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Duplicates</span><span className="ui-meta-value">{state.duplicates.length}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Validated at</span><span className="ui-meta-value">{state.validation?.validatedAt ? new Date(state.validation.validatedAt).toLocaleString() : "Not run"}</span></div>
                </div>
                {state.validation?.issues?.length ? state.validation.issues.map((issue) => (
                  <div key={issue.id} className="ui-card">
                    <div className="ui-card__body ui-stack ui-stack--2xs">
                      <div className="ui-row ui-row--between ui-row--wrap">
                        <strong>{issue.code}</strong>
                        <span className="ui-text-secondary ui-text-small">{issue.severity}{issue.exampleId ? ` · example ${issue.exampleId}` : ""}</span>
                      </div>
                      <span>{issue.message}</span>
                    </div>
                  </div>
                )) : <p className="ui-text-secondary">No validation issues recorded yet.</p>}
              </div>
            </div>
          </section>

          <section id="page-tabpanel-splits" role="tabpanel" aria-labelledby="page-tab-splits" className="ui-page-tab-panel" hidden={state.activeWorkspaceTab !== "splits"}>
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--md">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div>
                    <h3>Split management</h3>
                    <p className="ui-text-secondary">Automatically assign or manually override train, validation, and test splits.</p>
                  </div>
                  {latestVersion ? <button type="button" className="ui-button ui-button--primary" onClick={() => {
                    void tuningDatasetStore.assignSplits(state.selectedDataset!.dataset.id, latestVersion.id, "ui-user").catch(() => undefined);
                  }}>Auto-assign splits</button> : null}
                </div>
                <div className="ui-meta-grid">
                  <div className="ui-meta-item"><span className="ui-meta-label">Train</span><span className="ui-meta-value">{state.statistics?.splitCounts.train ?? 0}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Validation</span><span className="ui-meta-value">{state.statistics?.splitCounts.validation ?? 0}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Test</span><span className="ui-meta-value">{state.statistics?.splitCounts.test ?? 0}</span></div>
                </div>
                {state.examples.map((example) => (
                  <div key={`split-${example.id}`} className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)", alignItems: "center" }}>
                    <div className="ui-stack ui-stack--2xs" style={{ flex: 1 }}>
                      <strong>{example.question}</strong>
                      <span className="ui-text-secondary ui-text-small">{example.id}</span>
                    </div>
                    <select className="ui-input" style={{ maxWidth: "180px" }} value={example.split} onChange={(event) => {
                      void tuningDatasetStore.updateSplit(state.selectedDataset!.dataset.id, latestVersion!.id, example.id, event.target.value as SplitType, "ui-user").catch(() => undefined);
                    }}>
                      <option value="train">train</option>
                      <option value="validation">validation</option>
                      <option value="test">test</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="page-tabpanel-versions" role="tabpanel" aria-labelledby="page-tab-versions" className="ui-page-tab-panel" hidden={state.activeWorkspaceTab !== "versions"}>
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--md">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div>
                    <h3>Versions and release</h3>
                    <p className="ui-text-secondary">Release a validated immutable version before exporting artifacts.</p>
                  </div>
                  {state.selectedDataset && latestVersion ? (
                    <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                      <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => {
                        void tuningDatasetStore.validateDataset(state.selectedDataset!.dataset.id, latestVersion.id).catch(() => undefined);
                      }}>Validate current version</button>
                      <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={state.validation?.blockingIssueCount ? state.validation.blockingIssueCount > 0 : false} onClick={() => {
                        void tuningDatasetStore.releaseVersion(state.selectedDataset!.dataset.id, latestVersion.id, releaseNotes).catch(() => undefined);
                      }}>Release version</button>
                    </div>
                  ) : null}
                </div>
                <label className="ui-field ui-stack ui-stack--2xs">
                  <span className="ui-field__label">Release notes</span>
                  <textarea className="ui-input" rows={3} value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} placeholder="Summarize source coverage, review completion, and known caveats." />
                </label>
                {state.selectedDataset?.versions?.length ? state.selectedDataset.versions.map((version) => (
                  <div key={version.id} className="ui-card">
                    <div className="ui-card__body ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                      <div className="ui-stack ui-stack--2xs">
                        <strong>Version {version.versionNumber}</strong>
                        <span className="ui-text-secondary ui-text-small">Status: {version.status}</span>
                        <span className="ui-text-secondary ui-text-small">Created by {version.createdBy} on {new Date(version.createdAt).toLocaleString()}</span>
                      </div>
                      {version.releasedAt ? <span className="ui-text-secondary ui-text-small">Released {new Date(version.releasedAt).toLocaleString()}</span> : null}
                    </div>
                  </div>
                )) : <p className="ui-text-secondary">No versions created yet.</p>}
              </div>
            </div>
          </section>

          <section id="page-tabpanel-exports" role="tabpanel" aria-labelledby="page-tab-exports" className="ui-page-tab-panel" hidden={state.activeWorkspaceTab !== "exports"}>
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--md">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div>
                    <h3>Exports</h3>
                    <p className="ui-text-secondary">Generate canonical and QA-specific export artifacts from released versions.</p>
                  </div>
                </div>
                {latestVersion ? (
                  <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                    {EXPORT_FORMATS.filter((format) => ["canonical_json", "canonical_jsonl", "qa_jsonl"].includes(format)).map((format) => (
                      <button
                        key={format}
                        type="button"
                        className="ui-button ui-button--secondary ui-button--sm"
                        onClick={() => {
                          void tuningDatasetStore.exportVersion(state.selectedDataset!.dataset.id, latestVersion.id, format as "canonical_json" | "canonical_jsonl" | "qa_jsonl").then((artifact) => {
                            downloadArtifact(artifact.fileName, artifact.content, artifact.contentType);
                          }).catch(() => undefined);
                        }}
                      >
                        Export {format}
                      </button>
                    ))}
                  </div>
                ) : null}
                {state.exports.length ? state.exports.map((artifact) => (
                  <div key={artifact.id} className="ui-card">
                    <div className="ui-card__body ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                      <div className="ui-stack ui-stack--2xs">
                        <strong>{artifact.fileName}</strong>
                        <span className="ui-text-secondary ui-text-small">{artifact.format} · {artifact.byteLength} bytes · checksum {artifact.checksum}</span>
                      </div>
                      <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => downloadArtifact(artifact.fileName, artifact.content, artifact.contentType)}>Download</button>
                    </div>
                  </div>
                )) : <p className="ui-text-secondary">No export artifacts generated yet.</p>}
              </div>
            </div>
          </section>
        </section>
      </div>
    </section>
  );
}
