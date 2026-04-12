import { useMemo, useState } from "react";
import type { WorkflowHeaderViewModel } from "../../presenters/WorkflowPresenter";

export interface WorkflowMetadataPanelProps {
  readonly workflow?: WorkflowHeaderViewModel;
  readonly isSaving?: boolean;
  readonly isExecuting?: boolean;
  readonly canExecuteWorkflow?: boolean;
  readonly validateLabel?: string;
  readonly executeLabel?: string;
  readonly workflowStatusMessage?: string;
  readonly contextWorkbenchHref?: string;
  readonly onRenameWorkflow?: (name: string) => void;
  readonly onUpdateDescription?: (description: string) => void;
  readonly onSaveWorkflow?: () => void;
  readonly onValidateWorkflow?: () => void;
  readonly onExecuteWorkflow?: () => void;
}

export default function WorkflowMetadataPanel({
  workflow,
  isSaving,
  isExecuting,
  canExecuteWorkflow = true,
  validateLabel,
  executeLabel,
  workflowStatusMessage,
  contextWorkbenchHref,
  onRenameWorkflow,
  onUpdateDescription,
  onSaveWorkflow,
  onValidateWorkflow,
  onExecuteWorkflow,
}: WorkflowMetadataPanelProps): JSX.Element {
  const [nameDraft, setNameDraft] = useState(workflow?.title ?? "");
  const [descriptionDraft, setDescriptionDraft] = useState(workflow?.description ?? "");

  useMemo(() => {
    setNameDraft(workflow?.title ?? "");
    setDescriptionDraft(workflow?.description ?? "");
  }, [workflow?.id, workflow?.title, workflow?.description]);

  return (
    <section className="ui-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Workflow Metadata</div>
          <div className="ui-panel__subtitle">
            Configure identity, status, validation, and execution.
          </div>
        </div>
      </div>

      <div className="ui-panel__body">
        {!workflow ? (
          <div className="ui-empty-state">
            <p className="ui-text-secondary">
              Create or load a workflow to edit its metadata.
            </p>
          </div>
        ) : (
          <div className="ui-stack ui-stack--md">
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="workflow-name">
                Workflow Name
              </label>
              <input
                id="workflow-name"
                className="ui-input"
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  const trimmed = nameDraft.trim();
                  if (trimmed && trimmed !== workflow.title) {
                    onRenameWorkflow?.(trimmed);
                  } else if (!trimmed) {
                    setNameDraft(workflow.title);
                  }
                }}
                disabled={isSaving || isExecuting}
              />
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="workflow-description">
                Description
              </label>
              <textarea
                id="workflow-description"
                className="ui-textarea"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                onBlur={() => {
                  const nextValue = descriptionDraft.trim();
                  if ((nextValue || "") !== (workflow.description ?? "")) {
                    onUpdateDescription?.(nextValue);
                  }
                }}
                disabled={isSaving || isExecuting}
              />
            </div>

            <div className="ui-meta-grid">
              <div className="ui-meta-item">
                <div className="ui-meta-label">Status</div>
                <div className="ui-meta-value">{workflow.status}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Enabled</div>
                <div className="ui-meta-value">{workflow.isEnabled ? "Yes" : "No"}</div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Executable</div>
                <div className="ui-meta-value">
                  {workflow.isExecutable ? "Ready" : "Not Ready"}
                </div>
              </div>

              <div className="ui-meta-item">
                <div className="ui-meta-label">Unsaved Changes</div>
                <div className="ui-meta-value">{workflow.isDirty ? "Yes" : "No"}</div>
              </div>

              {workflow.executionState ? (
                <div className="ui-meta-item">
                  <div className="ui-meta-label">Execution</div>
                  <div className="ui-meta-value">{workflow.executionState}</div>
                </div>
              ) : null}

              <div className="ui-meta-item">
                <div className="ui-meta-label">Workflow Id</div>
                <div className="ui-meta-value">{workflow.id}</div>
              </div>
            </div>

            <div className="ui-row ui-row--wrap">
              {contextWorkbenchHref ? (
                <a
                  className="ui-button ui-button--ghost ui-button--md"
                  href={contextWorkbenchHref}
                >
                  Open Context Workbench
                </a>
              ) : null}
              <button
                type="button"
                className={`ui-button ui-button--primary ui-button--md${
                  isSaving ? " ui-button--loading" : ""
                }`}
                onClick={() => onSaveWorkflow?.()}
                disabled={isSaving || isExecuting}
              >
                <span className="ui-button__label">
                  {isSaving ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
                  Save
                </span>
              </button>

              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--md"
                onClick={() => onValidateWorkflow?.()}
                disabled={isSaving || isExecuting}
              >
                {validateLabel ?? "Validate"}
              </button>

              <button
                type="button"
                className={`ui-button ui-button--secondary ui-button--md${
                  isExecuting ? " ui-button--loading" : ""
                }`}
                onClick={() => onExecuteWorkflow?.()}
                disabled={!workflow.isExecutable || !canExecuteWorkflow || isSaving || isExecuting}
              >
                <span className="ui-button__label">
                  {isExecuting ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
                  {executeLabel ?? "Execute"}
                </span>
              </button>
            </div>
            {workflowStatusMessage ? (
              <div className="ui-text-secondary ui-text-small" role="status" aria-live="polite">
                {workflowStatusMessage}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
