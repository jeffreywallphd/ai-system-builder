import { useMemo, useState } from "react";
import type { StudioShellExtensionContext } from "../../studio-shell/StudioShellExtensions";
import { StudioShellService } from "../../services/StudioShellService";

function readDefaultReferenceValues(content: string): {
  readonly workflowBindingId?: string;
  readonly workflowAssetId?: string;
  readonly workflowVersionId?: string;
  readonly datasetInstanceId?: string;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
} {
  try {
    const parsed = JSON.parse(content) as {
      readonly systemSpec?: {
        readonly serialization?: {
          readonly runtime?: {
            readonly workflowBindings?: ReadonlyArray<{
              readonly bindingId: string;
              readonly workflowAssetId: string;
              readonly workflowVersionId?: string;
            }>;
            readonly datasetInstances?: ReadonlyArray<{
              readonly instanceId: string;
              readonly datasetAssetId?: string;
              readonly datasetVersionId?: string;
            }>;
          };
        };
      };
    };
    const firstWorkflowBinding = parsed.systemSpec?.serialization?.runtime?.workflowBindings?.[0];
    const firstDatasetBinding = parsed.systemSpec?.serialization?.runtime?.datasetInstances?.[0];
    return Object.freeze({
      workflowBindingId: firstWorkflowBinding?.bindingId,
      workflowAssetId: firstWorkflowBinding?.workflowAssetId,
      workflowVersionId: firstWorkflowBinding?.workflowVersionId,
      datasetInstanceId: firstDatasetBinding?.instanceId,
      datasetAssetId: firstDatasetBinding?.datasetAssetId,
      datasetVersionId: firstDatasetBinding?.datasetVersionId,
    });
  } catch {
    return Object.freeze({});
  }
}

export function SystemStudioWorkManagementPanel({ context }: { readonly context: StudioShellExtensionContext }): JSX.Element {
  const service = useMemo(() => new StudioShellService(), []);
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const defaults = useMemo(() => (draft ? readDefaultReferenceValues(draft.content) : Object.freeze({})), [draft?.content]);
  const [status, setStatus] = useState<string>();
  const [renameDraftTitle, setRenameDraftTitle] = useState(draft?.metadata.title ?? "");
  const [openDraftId, setOpenDraftId] = useState("");
  const [copyTitle, setCopyTitle] = useState("");
  const [workflowBindingId, setWorkflowBindingId] = useState(defaults.workflowBindingId ?? "");
  const [workflowAssetId, setWorkflowAssetId] = useState(defaults.workflowAssetId ?? "");
  const [workflowVersionId, setWorkflowVersionId] = useState(defaults.workflowVersionId ?? "");
  const [datasetInstanceId, setDatasetInstanceId] = useState(defaults.datasetInstanceId ?? "");
  const [datasetAssetId, setDatasetAssetId] = useState(defaults.datasetAssetId ?? "");
  const [datasetVersionId, setDatasetVersionId] = useState(defaults.datasetVersionId ?? "");

  if (!draft || !sessionId) {
    return <p className="ui-text-small ui-text-secondary">Open a setup draft to save, reopen, copy, or rename.</p>;
  }

  return (
    <section className="ui-stack ui-stack--sm" data-testid="system-studio-work-management-panel">
      <p className="ui-text-small ui-text-secondary">Save your work, reopen a saved setup as an editable copy, make copies, and rename from one place.</p>
      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        <button
          type="button"
          className="ui-button ui-button--primary"
          onClick={() => {
            void service.saveSystemDefinition({
              studioId: context.studioId,
              sessionId,
              draftId: draft.draftId,
            }).then((response) => {
              if (!response.ok) {
                setStatus("Could not save right now. Please try again.");
                return;
              }
              setStatus("Saved.");
              void context.operations.refresh();
            });
          }}
        >
          Save work
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={() => {
            if (!openDraftId.trim()) {
              setStatus("Choose a saved setup first.");
              return;
            }
            void service.duplicateSystemDefinition({
              studioId: context.studioId,
              sessionId,
              sourceDraftId: openDraftId.trim(),
              title: copyTitle.trim() || undefined,
            }).then((response) => {
              if (!response.ok) {
                setStatus("Could not open that setup. Please try again.");
                return;
              }
              setStatus("Opened as a safe editable copy.");
              void context.operations.refresh();
            });
          }}
        >
          Open saved setup
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={() => {
            void service.duplicateSystemDefinition({
              studioId: context.studioId,
              sessionId,
              sourceDraftId: draft.draftId,
              title: copyTitle.trim() || `${draft.metadata.title} copy`,
            }).then((response) => {
              if (!response.ok) {
                setStatus("Could not make a copy. Please try again.");
                return;
              }
              setStatus("Copy created.");
              void context.operations.refresh();
            });
          }}
        >
          Make a copy
        </button>
      </div>

      <label className="ui-field">
        <span className="ui-field__label">Rename this work</span>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          <input
            className="ui-input"
            value={renameDraftTitle}
            onChange={(event) => setRenameDraftTitle(event.currentTarget.value)}
            placeholder="My image setup"
          />
          <button
            type="button"
            className="ui-button"
            onClick={() => {
              if (!renameDraftTitle.trim()) {
                setStatus("Name cannot be empty.");
                return;
              }
              void service.updateDraft({
                studioId: context.studioId,
                sessionId,
                draftId: draft.draftId,
                metadataPatch: { title: renameDraftTitle.trim() },
              }).then((response) => {
                if (!response.ok) {
                  setStatus("Could not rename right now.");
                  return;
                }
                setStatus("Name updated.");
                void context.operations.refresh();
              });
            }}
          >
            Rename
          </button>
        </div>
      </label>

      <details>
        <summary className="ui-text-small ui-text-secondary">Advanced setup changes</summary>
        <div className="ui-stack ui-stack--xs" style={{ marginTop: "0.5rem" }}>
          <div className="ui-form-grid">
            <label className="ui-field">
              <span className="ui-field__label">Processing binding</span>
              <input className="ui-input" value={workflowBindingId} onChange={(event) => setWorkflowBindingId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Processing workflow</span>
              <input className="ui-input" value={workflowAssetId} onChange={(event) => setWorkflowAssetId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Workflow version</span>
              <input className="ui-input" value={workflowVersionId} onChange={(event) => setWorkflowVersionId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Image collection slot</span>
              <input className="ui-input" value={datasetInstanceId} onChange={(event) => setDatasetInstanceId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Image collection</span>
              <input className="ui-input" value={datasetAssetId} onChange={(event) => setDatasetAssetId(event.currentTarget.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Collection version</span>
              <input className="ui-input" value={datasetVersionId} onChange={(event) => setDatasetVersionId(event.currentTarget.value)} />
            </label>
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            onClick={() => {
              void service.modifySystemDefinition({
                studioId: context.studioId,
                sessionId,
                draftId: draft.draftId,
                workflowBindings: workflowBindingId.trim() && workflowAssetId.trim()
                  ? [{
                    bindingId: workflowBindingId.trim(),
                    workflowAssetId: workflowAssetId.trim(),
                    workflowVersionId: workflowVersionId.trim() || undefined,
                  }]
                  : undefined,
                datasetBindings: datasetInstanceId.trim() && datasetAssetId.trim()
                  ? [{
                    instanceId: datasetInstanceId.trim(),
                    datasetAssetId: datasetAssetId.trim(),
                    datasetVersionId: datasetVersionId.trim() || undefined,
                  }]
                  : undefined,
              }).then((response) => {
                if (!response.ok) {
                  setStatus("Could not apply advanced setup changes.");
                  return;
                }
                setStatus("Advanced setup updated.");
                void context.operations.refresh();
              });
            }}
          >
            Apply setup changes
          </button>
          <label className="ui-field">
            <span className="ui-field__label">Open this saved draft id</span>
            <input className="ui-input" value={openDraftId} onChange={(event) => setOpenDraftId(event.currentTarget.value)} placeholder="draft-123" />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Copy name (optional)</span>
            <input className="ui-input" value={copyTitle} onChange={(event) => setCopyTitle(event.currentTarget.value)} placeholder="My image setup copy" />
          </label>
          <p className="ui-text-small ui-text-secondary">Current draft id: {draft.draftId}</p>
        </div>
      </details>

      {status ? <p className="ui-text-small ui-text-secondary">{status}</p> : null}
    </section>
  );
}
