import {
  WorkflowDraftOutputDestinationTypes,
  type WorkflowDraft,
  type WorkflowDraftOutput,
  type WorkflowValidationIssue,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";
import {
  addWorkflowOutput,
  getWorkflowOutputDestinationDefinitionByType,
  getWorkflowOutputValidationMessages,
  removeWorkflowOutput,
  setWorkflowOutputDestinationType,
  setWorkflowOutputFileName,
  setWorkflowOutputFormat,
  setWorkflowOutputRecordDestinationConfig,
  setWorkflowOutputRecordEntityName,
  setWorkflowOutputViewerPresentationMode,
  setWorkflowOutputViewerTitle,
  workflowFileOutputFormats,
  workflowOutputDestinationDefinitions,
  WorkflowOutputPresentationModes,
  type WorkflowOutputPresentationMode,
} from "../../../studio-shell/workflow/WorkflowWizardOutputs";

interface WorkflowStudioOutputSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
}

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function readDestinationOptionString(output: WorkflowDraftOutput, key: string): string {
  const candidate = output.destination.options?.[key];
  return typeof candidate === "string" ? candidate : "";
}

function mergeOutputIssues(
  output: WorkflowDraftOutput,
  rowPathPrefix: string,
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyArray<string> {
  const rowMessages = draftValidationIssues
    .filter((issue) => issue.path?.startsWith(rowPathPrefix))
    .map((issue) => issue.message);
  return Object.freeze([
    ...new Set([
      ...rowMessages,
      ...getWorkflowOutputValidationMessages(output),
    ]),
  ]);
}

export default function WorkflowStudioOutputSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
}: WorkflowStudioOutputSectionEditorProps): JSX.Element {
  const outputSectionDraftIssues = draftValidationIssues.filter((issue) => issue.section === "outputs" || issue.path?.startsWith("draft.outputs"));
  const outputRows = sharedDraft.outputs.map((output, index) => {
    const outputIssues = mergeOutputIssues(output, `draft.outputs[${index}]`, outputSectionDraftIssues);
    return Object.freeze({
      output,
      index,
      outputIssues,
    });
  });
  const sectionHasErrors = outputRows.some((row) => row.outputIssues.length > 0);

  return (
    <WizardSection sectionId="workflow-wizard-outputs" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Outputs Section"
        description="Define one or more workflow outputs and configure each destination. All edits write directly to canonical workflow draft outputs."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.outputs.length, "output", "outputs")}</div>

        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Add output</strong>
          <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
            {workflowOutputDestinationDefinitions.map((definition) => (
              <button
                key={definition.destinationType}
                type="button"
                className="ui-button ui-button--sm"
                data-testid={`workflow-output-add-${definition.destinationType}`}
                disabled={!onUpdateSharedDraft}
                onClick={() => {
                  if (!onUpdateSharedDraft) {
                    return;
                  }
                  onUpdateSharedDraft((draft) => addWorkflowOutput(draft, definition.destinationType).draft);
                }}
              >
                Add {definition.label}
              </button>
            ))}
          </div>
        </div>

        {outputRows.length === 0 ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-output-empty-state">
            <strong>No outputs configured yet.</strong>
            <span className="ui-text-small ui-text-secondary">
              Add an output type above to configure workflow delivery destinations.
            </span>
          </div>
        ) : (
          <div className="ui-stack ui-stack--2xs" data-testid="workflow-output-list">
            {outputRows.map((row) => {
              const definition = getWorkflowOutputDestinationDefinitionByType(row.output.destination.type);

              return (
                <article
                  key={row.output.id}
                  className="ui-card ui-card--padded ui-stack ui-stack--2xs"
                  data-testid={`workflow-output-row-${row.index}`}
                >
                  <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                    <strong>{row.output.title?.trim() || `Output ${row.index + 1}`}</strong>
                    <span className="ui-text-small ui-text-secondary">{definition.label}</span>
                  </div>

                  <label className="ui-stack ui-stack--2xs">
                    <span className="ui-text-small">Output destination type</span>
                    <select
                      className="ui-select"
                      data-testid={`workflow-output-type-select-${row.index}`}
                      value={row.output.destination.type}
                      disabled={!onUpdateSharedDraft}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => setWorkflowOutputDestinationType(
                          draft,
                          row.output.id,
                          event.target.value,
                        ).draft);
                      }}
                    >
                      {workflowOutputDestinationDefinitions.map((entry) => (
                        <option key={entry.destinationType} value={entry.destinationType}>{entry.label}</option>
                      ))}
                    </select>
                  </label>

                  {row.output.destination.type === WorkflowDraftOutputDestinationTypes.fileExport ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-output-file-config-${row.index}`}>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">File format</span>
                        <select
                          className="ui-select"
                          data-testid={`workflow-output-file-format-${row.index}`}
                          value={row.output.format}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowOutputFormat(
                              draft,
                              row.output.id,
                              event.target.value,
                            ).draft);
                          }}
                        >
                          {workflowFileOutputFormats.map((format) => (
                            <option key={format} value={format}>{format.toUpperCase()}</option>
                          ))}
                        </select>
                      </label>

                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">File/display name (optional)</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-output-file-name-${row.index}`}
                          value={readDestinationOptionString(row.output, "fileName")}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowOutputFileName(
                              draft,
                              row.output.id,
                              event.target.value,
                            ).draft);
                          }}
                          placeholder="Quarterly report"
                        />
                      </label>
                    </div>
                  ) : null}

                  {row.output.destination.type === WorkflowDraftOutputDestinationTypes.webViewer ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-output-viewer-config-${row.index}`}>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Viewer title</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-output-viewer-title-${row.index}`}
                          value={row.output.title ?? ""}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowOutputViewerTitle(
                              draft,
                              row.output.id,
                              event.target.value,
                            ).draft);
                          }}
                          placeholder="Workflow result view"
                        />
                      </label>

                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Presentation mode</span>
                        <select
                          className="ui-select"
                          data-testid={`workflow-output-viewer-mode-${row.index}`}
                          value={readDestinationOptionString(row.output, "presentationMode") || WorkflowOutputPresentationModes.embedded}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowOutputViewerPresentationMode(
                              draft,
                              row.output.id,
                              event.target.value as WorkflowOutputPresentationMode,
                            ).draft);
                          }}
                        >
                          <option value={WorkflowOutputPresentationModes.embedded}>Embedded</option>
                          <option value={WorkflowOutputPresentationModes.fullPage}>Full page</option>
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {row.output.destination.type === WorkflowDraftOutputDestinationTypes.systemEntry ? (
                    <div className="ui-stack ui-stack--2xs" data-testid={`workflow-output-system-config-${row.index}`}>
                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Record/entity name</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-output-system-entity-${row.index}`}
                          value={readDestinationOptionString(row.output, "entityName")}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowOutputRecordEntityName(
                              draft,
                              row.output.id,
                              event.target.value,
                            ).draft);
                          }}
                          placeholder="customer-record"
                        />
                      </label>

                      <label className="ui-stack ui-stack--2xs">
                        <span className="ui-text-small">Destination config (placeholder)</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-output-system-config-value-${row.index}`}
                          value={readDestinationOptionString(row.output, "destinationConfig")}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => setWorkflowOutputRecordDestinationConfig(
                              draft,
                              row.output.id,
                              event.target.value,
                            ).draft);
                          }}
                          placeholder="connection:primary-db"
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      data-testid={`workflow-output-remove-${row.index}`}
                      disabled={!onUpdateSharedDraft}
                      onClick={() => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => removeWorkflowOutput(draft, row.output.id).draft);
                      }}
                    >
                      Remove output
                    </button>
                  </div>

                  {row.outputIssues.length > 0 ? (
                    <ul className="ui-stack ui-stack--2xs">
                      {row.outputIssues.map((message) => (
                        <li key={`${row.output.id}:${message}`} className="ui-text-danger">{message}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ui-text-muted">Output configuration valid.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </SectionBody>
    </WizardSection>
  );
}

