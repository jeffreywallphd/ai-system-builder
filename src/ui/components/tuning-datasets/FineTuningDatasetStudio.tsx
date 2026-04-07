import { useEffect, useMemo, useState } from "react";
import { EXPORT_FORMATS, type ChatCompletionMessage, type ExampleStatus, type SplitType } from "@domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import { buildDatasetWorkflowWizard } from "@application/tuning-datasets/buildDatasetWorkflowWizard";
import { ChatCompletionExample, QuestionAnsweringExample } from "@domain/tuning-datasets/TuningDatasetEntities";
import { useUiDependencies } from "../../composition/AppProviders";
import ExecutionHistoryPanel from "../execution/ExecutionHistoryPanel";
import LinearWizard from "../wizard/LinearWizard";
import type { TuningDatasetStoreState } from "../../state/TuningDatasetStore";
import type { ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";

const fallbackState: TuningDatasetStoreState = Object.freeze({
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
  generationBatches: Object.freeze([]),
  duplicates: Object.freeze([]),
  workflow: undefined,
  wizard: buildDatasetWorkflowWizard({ currentStage: "dataset_definition" }),
  currentWorkflowStage: "dataset_definition",
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

function parseChatMessages(value: string): ReadonlyArray<ChatCompletionMessage> {
  const messages: ChatCompletionMessage[] = [];
  for (const line of value.split(/\n+/).map((entry) => entry.trim()).filter(Boolean)) {
    const [rolePart, ...contentParts] = line.split(":");
    const role = rolePart?.trim();
    const content = contentParts.join(":").trim() || line;
    if (role === "system" || role === "user" || role === "assistant") {
      messages.push({ role, content });
    } else {
      messages.push({ role: "user", content: line });
    }
  }
  return Object.freeze(messages);
}

export default function FineTuningDatasetStudio(): JSX.Element {
  const { tuningDatasetStore, executionHistoryService } = useUiDependencies();
  const [state, setState] = useState<TuningDatasetStoreState>(() => tuningDatasetStore.getState() || fallbackState);
  const [datasetName, setDatasetName] = useState("");
  const [datasetDescription, setDatasetDescription] = useState("");
  const [datasetType, setDatasetType] = useState<"question_answering" | "chat_completion">("question_answering");
  const [sourceName, setSourceName] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<ReadonlyArray<string>>([]);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [chatDraft, setChatDraft] = useState("system: You are a grounded assistant.\nuser: Summarize the source.\nassistant: ");
  const [qaDraft, setQaDraft] = useState({ question: "", answer: "", context: "" });
  const [bulkNote, setBulkNote] = useState("Bulk reviewed in dataset studio");
  const [draftEdits, setDraftEdits] = useState<Record<string, { question?: string; answer?: string; context?: string; status: ExampleStatus; split: SplitType; messagesText?: string }>>({});
  const [executionHistory, setExecutionHistory] = useState<ReadonlyArray<ExecutionRunProjection>>([]);

  useEffect(() => tuningDatasetStore.subscribe(setState), [tuningDatasetStore]);

  useEffect(() => {
    void tuningDatasetStore.initialize().catch(() => undefined);
  }, [tuningDatasetStore]);

  useEffect(() => {
    setSelectedSourceIds((current) => current.filter((id) => state.sourceDocuments.some((document) => document.id === id)));
  }, [state.sourceDocuments]);

  const selectedVersion = state.selectedDataset?.selectedVersion;

  useEffect(() => {
    if (!state.selectedDataset?.dataset.id || !selectedVersion?.id) {
      setExecutionHistory([]);
      return;
    }

    void executionHistoryService.listHistory({
      executionKind: "dataset-generation",
      metadata: {
        datasetId: state.selectedDataset.dataset.id,
        versionId: selectedVersion.id,
      },
      limit: 6,
    }).then(setExecutionHistory).catch(() => setExecutionHistory([]));
  }, [executionHistoryService, selectedVersion?.id, state.isMutating, state.selectedDataset?.dataset.id]);
  const selectedDataset = state.selectedDataset?.dataset;
  const workflow = state.workflow;
  const taskType = selectedDataset?.taskType ?? datasetType;
  const wizard = state.wizard;
  const generationBatches = state.generationBatches;

  const exportOptions = useMemo(() => (taskType === "chat_completion"
    ? EXPORT_FORMATS.filter((format) => ["canonical_json", "canonical_jsonl", "openai_chat_jsonl"].includes(format))
    : EXPORT_FORMATS.filter((format) => ["canonical_json", "canonical_jsonl", "qa_jsonl"].includes(format))), [taskType]);

  const renderWizardStep = (): JSX.Element => {
    switch (state.currentWorkflowStage) {
      case "dataset_definition":
        return (
          <div className="ui-stack ui-stack--md">
            <div className="ui-grid ui-grid--2col" style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <label className="ui-field ui-stack ui-stack--2xs">
                <span className="ui-field__label">Dataset name</span>
                <input className="ui-input" value={datasetName} onChange={(event) => setDatasetName(event.target.value)} placeholder="Customer support QA" />
              </label>
              <label className="ui-field ui-stack ui-stack--2xs">
                <span className="ui-field__label">Task type</span>
                <select className="ui-input" value={datasetType} onChange={(event) => setDatasetType(event.target.value as "question_answering" | "chat_completion") }>
                  <option value="question_answering">Question Answering / Generative QA</option>
                  <option value="chat_completion">Chat Completion</option>
                </select>
              </label>
            </div>
            <label className="ui-field ui-stack ui-stack--2xs">
              <span className="ui-field__label">Description</span>
              <textarea className="ui-input" rows={4} value={datasetDescription} onChange={(event) => setDatasetDescription(event.target.value)} placeholder="Describe the dataset scope, source provenance, and intended assistant behavior." />
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
            {selectedDataset ? (
              <div className="ui-meta-grid">
                <div className="ui-meta-item"><span className="ui-meta-label">Task type</span><span className="ui-meta-value">{selectedDataset.taskType}</span></div>
                <div className="ui-meta-item"><span className="ui-meta-label">Selected version</span><span className="ui-meta-value">v{selectedVersion?.versionNumber ?? "â€”"}</span></div>
                <div className="ui-meta-item"><span className="ui-meta-label">Version status</span><span className="ui-meta-value">{selectedVersion?.status ?? "draft"}</span></div>
                <div className="ui-meta-item"><span className="ui-meta-label">Workflow stage</span><span className="ui-meta-value">{workflow?.currentStage ?? "dataset_definition"}</span></div>
              </div>
            ) : null}
          </div>
        );
      case "source_ingestion":
        return !selectedVersion ? <p className="ui-text-secondary">Create or select a dataset version first.</p> : (
          <div className="ui-stack ui-stack--md">
            <div className="ui-grid ui-grid--2col" style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <label className="ui-field ui-stack ui-stack--2xs">
                <span className="ui-field__label">Source document name</span>
                <input className="ui-input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Product FAQ excerpt" />
              </label>
              <label className="ui-field ui-stack ui-stack--2xs">
                <span className="ui-field__label">Upload text file</span>
                <input
                  className="ui-input"
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setSourceName(file.name);
                      setSourceContent(String(reader.result ?? ""));
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
            <label className="ui-field ui-stack ui-stack--2xs">
              <span className="ui-field__label">Source text</span>
              <textarea className="ui-input" rows={8} value={sourceContent} onChange={(event) => setSourceContent(event.target.value)} placeholder="Paste source content used to generate examples or messages." />
            </label>
            <div className="ui-page__actions">
              <button
                type="button"
                className="ui-button ui-button--primary"
                disabled={state.isMutating || !sourceName.trim() || !sourceContent.trim()}
                onClick={() => {
                  void tuningDatasetStore.importSources(selectedDataset!.id, selectedVersion.id, "ui-user", [{ name: sourceName, content: sourceContent, sourceType: "manual_text" }]).then(() => {
                    setSourceName("");
                    setSourceContent("");
                  }).catch(() => undefined);
                }}
              >
                Add source document
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
                        <span className="ui-text-secondary ui-text-small">{document.sourceType} Â· {document.segments.length} segments</span>
                        <span className="ui-text-secondary ui-text-small">{document.content.slice(0, 220)}{document.content.length > 220 ? "â€¦" : ""}</span>
                      </div>
                      <input type="checkbox" checked={checked} onChange={(event) => setSelectedSourceIds((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))} />
                    </div>
                  </label>
                );
              }) : <p className="ui-text-secondary">No sources imported yet.</p>}
            </div>
          </div>
        );
      case "example_generation":
        return !selectedVersion ? <p className="ui-text-secondary">Create or select a dataset version first.</p> : (
          <div className="ui-stack ui-stack--md">
            <div className="ui-row ui-row--between ui-row--wrap">
              <p className="ui-text-secondary">Provider/model-backed generation is preferred when configured and available. If that path is unavailable, the app records whether examples came from the explicit python-runtime-local generator or a heuristic fallback, along with provider/model identity, diagnostics, and fallback reasons.</p>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                disabled={state.isMutating || selectedSourceIds.length === 0}
                onClick={() => { void tuningDatasetStore.generateExamples(selectedDataset!.id, selectedVersion.id, "ui-user", selectedSourceIds).catch(() => undefined); }}
              >
                {taskType === "chat_completion" ? "Generate chat examples" : "Generate QA examples"}
              </button>
            </div>
            <ExecutionHistoryPanel
              title="Generation execution history"
              subtitle="Durable execution-engine records for dataset example generation."
              items={executionHistory}
              emptyMessage="No dataset-generation execution runs have been recorded yet."
              executionHistoryService={executionHistoryService}
            />
            {generationBatches.length > 0 ? (
              <div className="ui-stack ui-stack--sm">
                <h4>Generation run history</h4>
                {generationBatches.map((batch) => (
                  <div key={batch.id} className="ui-card">
                    <div className="ui-card__body ui-stack ui-stack--2xs">
                      <div className="ui-row ui-row--between ui-row--wrap">
                        <strong>{batch.id}</strong>
                        <span className={`ui-badge ${batch.provenance.mode === "provider-model-backed" ? "ui-badge--success" : batch.provenance.mode === "python-runtime-local" ? "ui-badge--info" : "ui-badge--warning"}`}>{batch.provenance.mode}</span>
                      </div>
                      <div className="ui-text-secondary ui-text-small">Provider: {batch.provenance.provider} Â· Model: {batch.provenance.modelDisplayName ?? batch.provenance.modelId ?? "â€”"} Â· Examples: {batch.generatedCount} Â· Status: {batch.status} Â· Path: {batch.provenance.path}</div>
                      {batch.provenance.detail ? <div className="ui-text-secondary ui-text-small">{batch.provenance.detail}</div> : null}
                      <div className="ui-text-secondary ui-text-small">Execution kind: {batch.provenance.executionKind} Â· Fallback: {batch.provenance.isFallback ? "yes" : "no"} Â· Degraded: {batch.provenance.isDegraded ? "yes" : "no"}</div>
                      {batch.provenance.fallback ? <div className="ui-text-secondary ui-text-small">Fallback: {batch.provenance.fallback.fromMode ?? "provider-model-backed"} â†’ {batch.provenance.mode} Â· {batch.provenance.fallback.reason}</div> : null}
                      {batch.provenance.diagnostics.length > 0 ? <div className="ui-text-secondary ui-text-small">Diagnostics: {batch.provenance.diagnostics.map((diagnostic) => `${diagnostic.level}: ${diagnostic.message}${diagnostic.detail ? ` (${diagnostic.detail})` : ""}`).join(" Â· ")}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {taskType === "chat_completion" ? (
              <div className="ui-stack ui-stack--sm">
                <label className="ui-field ui-stack ui-stack--2xs">
                  <span className="ui-field__label">Add manual chat example</span>
                  <textarea className="ui-input" rows={6} value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} />
                </label>
                <div className="ui-page__actions">
                  <button type="button" className="ui-button ui-button--secondary" onClick={() => {
                    void tuningDatasetStore.addExample({
                      taskType: "chat_completion",
                      datasetId: selectedDataset!.id,
                      versionId: selectedVersion.id,
                      messages: parseChatMessages(chatDraft),
                      createdBy: "ui-user",
                    }).catch(() => undefined);
                  }}>Add chat example</button>
                </div>
              </div>
            ) : (
              <div className="ui-grid ui-grid--3col" style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <input className="ui-input" value={qaDraft.question} onChange={(event) => setQaDraft((current) => ({ ...current, question: event.target.value }))} placeholder="Question" />
                <input className="ui-input" value={qaDraft.answer} onChange={(event) => setQaDraft((current) => ({ ...current, answer: event.target.value }))} placeholder="Answer" />
                <input className="ui-input" value={qaDraft.context} onChange={(event) => setQaDraft((current) => ({ ...current, context: event.target.value }))} placeholder="Context" />
                <button type="button" className="ui-button ui-button--secondary" onClick={() => {
                  void tuningDatasetStore.addExample({
                    taskType: "question_answering",
                    datasetId: selectedDataset!.id,
                    versionId: selectedVersion.id,
                    question: qaDraft.question,
                    answer: qaDraft.answer,
                    context: qaDraft.context,
                    createdBy: "ui-user",
                  }).then(() => setQaDraft({ question: "", answer: "", context: "" })).catch(() => undefined);
                }}>Add QA example</button>
              </div>
            )}
          </div>
        );
      case "review_editing":
        return (
          <div className="ui-stack ui-stack--md">
            <div className="ui-row ui-row--between ui-row--wrap">
              <p className="ui-text-secondary">Use bulk review operations, split updates, and annotations to prepare for governed release.</p>
              <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-xs)" }}>
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled={state.selectedExampleIds.length === 0} onClick={() => void tuningDatasetStore.bulkUpdateSelection({ status: "accepted", annotationNote: bulkNote, updatedBy: "reviewer" }).catch(() => undefined)}>Bulk accept</button>
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled={state.selectedExampleIds.length === 0} onClick={() => void tuningDatasetStore.bulkUpdateSelection({ status: "needs_review", annotationNote: bulkNote, updatedBy: "reviewer" }).catch(() => undefined)}>Bulk needs review</button>
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled={state.selectedExampleIds.length === 0} onClick={() => void tuningDatasetStore.bulkUpdateSelection({ split: "validation", annotationNote: bulkNote, updatedBy: "reviewer" }).catch(() => undefined)}>Bulk set validation split</button>
              </div>
            </div>
            <label className="ui-field ui-stack ui-stack--2xs">
              <span className="ui-field__label">Batch review note application</span>
              <input className="ui-input" value={bulkNote} onChange={(event) => setBulkNote(event.target.value)} />
            </label>
            {state.examples.length === 0 || !selectedVersion ? <p className="ui-text-secondary">Generate examples from imported sources to begin review.</p> : state.examples.map((example) => {
              const draft = draftEdits[example.id] ?? {
                status: example.status,
                split: example.split,
                question: example instanceof QuestionAnsweringExample ? example.question : undefined,
                answer: example instanceof QuestionAnsweringExample ? example.answer : undefined,
                context: example instanceof QuestionAnsweringExample ? example.context : undefined,
                messagesText: example instanceof ChatCompletionExample ? example.messages.map((message) => `${message.role}: ${message.content}`).join("\n") : undefined,
              };
              return (
                <div key={example.id} className="ui-card">
                  <div className="ui-card__body ui-stack ui-stack--sm">
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-sm)", alignItems: "center" }}>
                        <input type="checkbox" checked={state.selectedExampleIds.includes(example.id)} onChange={() => tuningDatasetStore.toggleExampleSelection(example.id)} />
                        <div className="ui-stack ui-stack--2xs">
                          <strong>{example.id}</strong>
                          <span className="ui-text-secondary ui-text-small">{example.taskType} Â· {example.status} Â· {example.split}</span>
                        </div>
                      </div>
                      <div className="ui-row ui-row--wrap" style={{ gap: "var(--space-xs)" }}>
                        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => void tuningDatasetStore.reviewExample(selectedDataset!.id, selectedVersion.id, example.id, "accepted", "reviewer", "Accepted for release").catch(() => undefined)}>Accept</button>
                        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => void tuningDatasetStore.reviewExample(selectedDataset!.id, selectedVersion.id, example.id, "needs_review", "reviewer", "Needs follow-up review").catch(() => undefined)}>Needs review</button>
                        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => void tuningDatasetStore.reviewExample(selectedDataset!.id, selectedVersion.id, example.id, "rejected", "reviewer", "Rejected during review").catch(() => undefined)}>Reject</button>
                        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => void tuningDatasetStore.deleteExample(selectedDataset!.id, selectedVersion.id, example.id).catch(() => undefined)}>Delete</button>
                      </div>
                    </div>

                    {example instanceof QuestionAnsweringExample ? (
                      <>
                        <label className="ui-field ui-stack ui-stack--2xs"><span className="ui-field__label">Question</span><textarea className="ui-input" rows={2} value={draft.question ?? ""} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, question: event.target.value } }))} /></label>
                        <label className="ui-field ui-stack ui-stack--2xs"><span className="ui-field__label">Answer</span><textarea className="ui-input" rows={3} value={draft.answer ?? ""} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, answer: event.target.value } }))} /></label>
                        <label className="ui-field ui-stack ui-stack--2xs"><span className="ui-field__label">Context</span><textarea className="ui-input" rows={4} value={draft.context ?? ""} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, context: event.target.value } }))} /></label>
                      </>
                    ) : (
                      <label className="ui-field ui-stack ui-stack--2xs"><span className="ui-field__label">Messages</span><textarea className="ui-input" rows={6} value={draft.messagesText ?? ""} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, messagesText: event.target.value } }))} /></label>
                    )}

                    <div className="ui-grid ui-grid--2col" style={{ display: "grid", gap: "var(--space-md)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                      <label className="ui-field ui-stack ui-stack--2xs"><span className="ui-field__label">Status</span><select className="ui-input" value={draft.status} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, status: event.target.value as ExampleStatus } }))}><option value="draft">draft</option><option value="accepted">accepted</option><option value="rejected">rejected</option><option value="needs_review">needs_review</option></select></label>
                      <label className="ui-field ui-stack ui-stack--2xs"><span className="ui-field__label">Split</span><select className="ui-input" value={draft.split} onChange={(event) => setDraftEdits((current) => ({ ...current, [example.id]: { ...draft, split: event.target.value as SplitType } }))}><option value="train">train</option><option value="validation">validation</option><option value="test">test</option></select></label>
                    </div>
                    <div className="ui-page__actions">
                      <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => {
                        void tuningDatasetStore.updateExample(example instanceof QuestionAnsweringExample ? {
                          datasetId: selectedDataset!.id,
                          versionId: selectedVersion.id,
                          exampleId: example.id,
                          question: draft.question,
                          answer: draft.answer,
                          context: draft.context,
                          split: draft.split,
                          status: draft.status,
                          updatedBy: "ui-user",
                          annotationNote: "Edited example in dataset studio",
                        } : {
                          datasetId: selectedDataset!.id,
                          versionId: selectedVersion.id,
                          exampleId: example.id,
                          messages: parseChatMessages(draft.messagesText ?? ""),
                          split: draft.split,
                          status: draft.status,
                          updatedBy: "ui-user",
                          annotationNote: "Edited chat example in dataset studio",
                        }).then(() => setDraftEdits((current) => {
                          const next = { ...current };
                          delete next[example.id];
                          return next;
                        })).catch(() => undefined);
                      }}>Save changes</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      case "validation":
        return (
          <div className="ui-stack ui-stack--md">
            <div className="ui-row ui-row--between ui-row--wrap">
              <p className="ui-text-secondary">Run validation to inspect readiness, duplicate detection, and release blockers.</p>
              {selectedVersion ? <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => void tuningDatasetStore.validateDataset(selectedDataset!.id, selectedVersion.id).catch(() => undefined)}>Run validation</button> : null}
            </div>
            {state.validation ? (
              <div className="ui-stack ui-stack--sm">
                <div className="ui-meta-grid">
                  <div className="ui-meta-item"><span className="ui-meta-label">Blocking errors</span><span className="ui-meta-value">{state.validation.blockingIssueCount}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Warnings</span><span className="ui-meta-value">{state.validation.warningCount}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Review ready</span><span className="ui-meta-value">{String(state.validation.readiness.reviewReady)}</span></div>
                  <div className="ui-meta-item"><span className="ui-meta-label">Split ready</span><span className="ui-meta-value">{String(state.validation.readiness.splitReady)}</span></div>
                </div>
                {state.duplicates.length > 0 ? (
                  <div className="ui-card"><div className="ui-card__body ui-stack ui-stack--2xs"><strong>Duplicate detection integration</strong>{state.duplicates.map((duplicate) => <span key={duplicate.fingerprint} className="ui-text-secondary ui-text-small">{duplicate.fingerprint} Â· {duplicate.exampleIds.join(", ")}</span>)}</div></div>
                ) : null}
                {state.validation.issues.map((issue) => (
                  <div key={issue.id} className="ui-card"><div className="ui-card__body ui-stack ui-stack--2xs"><strong>{issue.severity.toUpperCase()} Â· {issue.code}</strong><span className="ui-text-secondary">{issue.message}</span></div></div>
                ))}
              </div>
            ) : <p className="ui-text-secondary">No validation run yet.</p>}
          </div>
        );
      case "split_assignment":
        return (
          <div className="ui-stack ui-stack--md">
            <div className="ui-row ui-row--between ui-row--wrap">
              <p className="ui-text-secondary">Auto-assign dataset splits and fine tune individual assignments as needed.</p>
              {selectedVersion ? <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => void tuningDatasetStore.assignSplits(selectedDataset!.id, selectedVersion.id, "ui-user").catch(() => undefined)}>Auto-assign splits</button> : null}
            </div>
            {state.examples.length > 0 ? state.examples.map((example) => (
              <div key={`${example.id}-split`} className="ui-row ui-row--between ui-row--wrap" style={{ gap: "var(--space-sm)" }}>
                <span>{example.id}</span>
                <select className="ui-input" value={example.split} onChange={(event) => selectedVersion && void tuningDatasetStore.updateSplit(selectedDataset!.id, selectedVersion.id, example.id, event.target.value as SplitType, "ui-user").catch(() => undefined)}>
                  <option value="train">train</option>
                  <option value="validation">validation</option>
                  <option value="test">test</option>
                </select>
              </div>
            )) : <p className="ui-text-secondary">No examples available to split yet.</p>}
          </div>
        );
      case "release":
        return (
          <div className="ui-stack ui-stack--md">
            <div className="ui-row ui-row--between ui-row--wrap">
              <p className="ui-text-secondary">Promote the working version once validation and review signals satisfy the release policy.</p>
              {selectedVersion ? <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => void tuningDatasetStore.releaseVersion(selectedDataset!.id, selectedVersion.id, releaseNotes).catch(() => undefined)}>Release version</button> : null}
            </div>
            <label className="ui-field ui-stack ui-stack--2xs">
              <span className="ui-field__label">Release notes</span>
              <textarea className="ui-input" rows={3} value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} />
            </label>
            {selectedVersion ? <p className="ui-text-secondary">Current version status: {selectedVersion.status}. Release correctness is enforced in the inner layers, not just the UI.</p> : null}
          </div>
        );
      case "export":
      default:
        return (
          <div className="ui-stack ui-stack--md">
            <p className="ui-text-secondary">Download released artifacts in task-type-aware formats.</p>
            {selectedVersion ? (
              <div className="ui-grid ui-grid--3col" style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                {exportOptions.map((format) => (
                  <button key={format} type="button" className="ui-button ui-button--secondary" onClick={() => {
                    void tuningDatasetStore.exportVersion(selectedDataset!.id, selectedVersion.id, format).then((artifact) => {
                      downloadArtifact(artifact.fileName, artifact.content, artifact.contentType);
                    }).catch(() => undefined);
                  }}>
                    {format}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="ui-stack ui-stack--sm">
              {state.exports.map((artifact) => (
                <div key={artifact.id} className="ui-card"><div className="ui-card__body ui-row ui-row--between ui-row--wrap"><div className="ui-stack ui-stack--2xs"><strong>{artifact.fileName}</strong><span className="ui-text-secondary ui-text-small">{artifact.format} Â· {artifact.byteLength} bytes</span></div><button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => downloadArtifact(artifact.fileName, artifact.content, artifact.contentType)}>Download</button></div></div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <section className="ui-stack ui-stack--md" data-testid="fine-tuning-dataset-studio">
      <div className="ui-card">
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-row ui-row--between ui-row--wrap">
            <div className="ui-stack ui-stack--2xs">
              <h2>Fine-Tuning Dataset Studio</h2>
              <p className="ui-text-secondary">
                Guided supervised tuning workflow with version-aware governance, source ingestion, truthful generation provenance, bulk review, release invariants, and chat_completion support.
              </p>
            </div>
            <div className="ui-meta-grid" style={{ minWidth: "320px" }}>
              <div className="ui-meta-item"><span className="ui-meta-label">Datasets</span><span className="ui-meta-value">{state.datasets.length}</span></div>
              <div className="ui-meta-item"><span className="ui-meta-label">Examples</span><span className="ui-meta-value">{state.statistics?.exampleCount ?? state.examples.length}</span></div>
              <div className="ui-meta-item"><span className="ui-meta-label">Sources</span><span className="ui-meta-value">{state.sourceDocuments.length}</span></div>
              <div className="ui-meta-item"><span className="ui-meta-label">Workflow</span><span className="ui-meta-value">{workflow?.currentStage ?? "dataset_definition"}</span></div>
            </div>
          </div>
          {state.error ? <p className="ui-text-secondary">{state.error}</p> : null}
        </div>
      </div>

      <div className="ui-context-browser">
        <aside className="ui-context-browser__sidebar ui-stack ui-stack--md">
          <div className="ui-card">
            <div className="ui-card__body ui-stack ui-stack--sm">
              <div className="ui-row ui-row--between ui-row--wrap">
                <h3>Dataset catalog</h3>
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => void tuningDatasetStore.selectDataset(undefined)}>Reset</button>
              </div>
              {state.datasets.length > 0 ? state.datasets.map((summary) => (
                <button
                  key={summary.dataset.id}
                  type="button"
                  className={`ui-card ui-card--interactive${summary.dataset.id === state.selectedDatasetId ? " is-selected" : ""}`}
                  style={{ textAlign: "left" }}
                  onClick={() => { void tuningDatasetStore.selectDataset(summary.dataset.id, summary.selectedVersion?.id).catch(() => undefined); }}
                >
                  <div className="ui-card__body ui-stack ui-stack--2xs">
                    <strong>{summary.dataset.name}</strong>
                    <span className="ui-text-secondary ui-text-small">{summary.dataset.taskType}</span>
                    <span className="ui-text-secondary ui-text-small">Selected version: v{summary.selectedVersion?.versionNumber ?? summary.latestVersion?.versionNumber ?? "â€”"}</span>
                    <span className="ui-text-secondary ui-text-small">Status: {summary.selectedVersion?.status ?? summary.dataset.status}</span>
                  </div>
                </button>
              )) : (
                <div className="ui-empty-state">
                  <h3>No fine-tuning datasets yet</h3>
                  <p className="ui-text-secondary">Create a question answering or chat completion dataset to start the wizard.</p>
                </div>
              )}
            </div>
          </div>

          {state.selectedDataset ? (
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--sm">
                <div className="ui-row ui-row--between ui-row--wrap">
                  <h3>Version management</h3>
                  {selectedVersion?.status === "released" ? (
                    <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => void tuningDatasetStore.createSuccessorVersion(selectedVersion.id, "ui-user").catch(() => undefined)}>
                      New successor draft
                    </button>
                  ) : null}
                </div>
                <label className="ui-field ui-stack ui-stack--2xs">
                  <span className="ui-field__label">Selected working version</span>
                  <select className="ui-input" value={state.selectedVersionId} onChange={(event) => void tuningDatasetStore.selectVersion(event.target.value).catch(() => undefined)}>
                    {state.selectedDataset.versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        v{version.versionNumber} Â· {version.kind} Â· {version.status}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="ui-stack ui-stack--2xs">
                  {state.selectedDataset.versions.map((version) => (
                    <div key={version.id} className="ui-card">
                      <div className="ui-card__body ui-stack ui-stack--2xs">
                        <strong>v{version.versionNumber}</strong>
                        <span className="ui-text-secondary ui-text-small">{version.kind} Â· {version.status}</span>
                        <span className="ui-text-secondary ui-text-small">{version.comparisonLabel ?? (version.parentVersionId ? `Derived from ${version.parentVersionId}` : "Initial version")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        <section className="ui-context-browser__editor ui-stack ui-stack--md">
          <LinearWizard
            wizard={wizard}
            title="Wizard progress"
            description="Linear wizard-style dataset creation workflow with resumable progress, integrated steps, and guarded transitions."
            stepContent={renderWizardStep()}
            isBusy={state.isMutating}
            isDisabled={!selectedDataset || !selectedVersion}
            onStepSelect={(stage) => selectedDataset && selectedVersion && void tuningDatasetStore.moveWorkflowStage(selectedDataset.id, selectedVersion.id, stage).catch(() => undefined)}
            onBack={() => void tuningDatasetStore.goToPreviousWorkflowStage().catch(() => undefined)}
            onNext={() => void tuningDatasetStore.goToNextWorkflowStage().catch(() => undefined)}
          />
        </section>
      </div>
    </section>
  );
}

