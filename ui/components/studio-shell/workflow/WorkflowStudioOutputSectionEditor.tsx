import { useEffect, useState } from "react";
import {
  type WorkflowDraft,
  type WorkflowDraftOutput,
  type WorkflowValidationIssue,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";
import {
  addWorkflowOutputs,
  canMoveWorkflowOutput,
  getWorkflowOutputDestinationDefinitionByType,
  getWorkflowOutputIssuesForIndex,
  getWorkflowOutputValidationMessages,
  moveWorkflowOutputDown,
  moveWorkflowOutputUp,
  readWorkflowOutputFieldValue,
  resolveWorkflowOutputSelectionId,
  removeWorkflowOutput,
  setWorkflowOutputFieldValue,
  setWorkflowOutputDestinationType,
  workflowOutputTypeDefinitions,
} from "../../../studio-shell/workflow/WorkflowWizardOutputs";
import WorkflowOutputSelector from "./WorkflowOutputSelector";

interface WorkflowStudioOutputSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
}

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function mergeOutputIssues(
  output: WorkflowDraftOutput,
  rowIssueMessages: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const hasSupportedDestination = workflowOutputTypeDefinitions.some(
    (entry) => entry.destinationType === output.destination.type,
  );
  const rowMessages = [...rowIssueMessages];
  if (!hasSupportedDestination) {
    rowMessages.push(`Output type '${output.destination.type}' is not registered in the output registry.`);
  }
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
  const [selectedOutputId, setSelectedOutputId] = useState<string | undefined>(() => (
    resolveWorkflowOutputSelectionId(sharedDraft)
  ));

  useEffect(() => {
    const resolved = resolveWorkflowOutputSelectionId(sharedDraft, selectedOutputId);
    if (resolved !== selectedOutputId) {
      setSelectedOutputId(resolved);
    }
  }, [selectedOutputId, sharedDraft]);

  const outputSectionDraftIssues = draftValidationIssues.filter((issue) => issue.section === "outputs" || issue.path?.startsWith("draft.outputs"));
  const outputRows = sharedDraft.outputs.map((output, index) => {
    const rowIssueMessages = getWorkflowOutputIssuesForIndex(outputSectionDraftIssues, index);
    const outputIssues = mergeOutputIssues(output, rowIssueMessages);
    return Object.freeze({
      output,
      index,
      outputIssues,
    });
  });
  const sectionHasErrors = outputRows.some((row) => row.outputIssues.length > 0);
  const selectedRow = outputRows.find((row) => row.output.id === selectedOutputId);
  const selectedOutput = selectedRow?.output;
  const selectedOutputIndex = selectedRow?.index ?? -1;
  const selectedDefinition = selectedOutput
    ? getWorkflowOutputDestinationDefinitionByType(selectedOutput.destination.type)
    : undefined;
  const knownDestinationTypeSet = new Set(workflowOutputTypeDefinitions.map((entry) => entry.destinationType));

  return (
    <WizardSection sectionId="workflow-wizard-outputs" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Outputs Section"
        description="Define one or more workflow outputs and configure each destination. All edits write directly to canonical workflow draft outputs."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.outputs.length, "output", "outputs")}</div>

        {WorkflowOutputSelector({
          outputTypeDefinitions: workflowOutputTypeDefinitions,
          disabled: !onUpdateSharedDraft,
          onAddOutputs: (destinationTypes) => {
            if (!onUpdateSharedDraft) {
              return;
            }
            onUpdateSharedDraft((draft) => addWorkflowOutputs(draft, destinationTypes).draft);
          },
        })}

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
                  <div className="ui-row ui-row--between ui-row--wrap workflow-output-list-row-header">
                    <button
                      type="button"
                      className={`ui-button ui-button--sm ${selectedOutputId === row.output.id ? "ui-button--primary" : "ui-button--ghost"}`}
                      data-testid={`workflow-output-select-${row.index}`}
                      onClick={() => setSelectedOutputId(row.output.id)}
                    >
                      {row.output.title?.trim() || `Output ${row.index + 1}`}
                    </button>
                    <span className="ui-text-small ui-text-secondary">{definition.label}</span>
                  </div>
                  <div className="ui-row ui-row--wrap workflow-output-list-row-actions">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      data-testid={`workflow-output-move-up-${row.index}`}
                      disabled={!onUpdateSharedDraft || !canMoveWorkflowOutput(sharedDraft, row.output.id, "up")}
                      onClick={() => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => moveWorkflowOutputUp(draft, row.output.id).draft);
                      }}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--ghost ui-button--sm"
                      data-testid={`workflow-output-move-down-${row.index}`}
                      disabled={!onUpdateSharedDraft || !canMoveWorkflowOutput(sharedDraft, row.output.id, "down")}
                      onClick={() => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => moveWorkflowOutputDown(draft, row.output.id).draft);
                      }}
                    >
                      Move down
                    </button>
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
                </article>
              );
            })}
          </div>
        )}

        {selectedOutput ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-output-selected-editor">
            <div className="ui-row ui-row--between ui-row--wrap workflow-output-selected-editor-header">
              <strong>Editing {selectedOutput.title?.trim() || `Output ${selectedOutputIndex + 1}`}</strong>
              <span className="ui-text-small ui-text-secondary">{selectedDefinition?.configSchemaId}</span>
            </div>

            <label className="ui-stack ui-stack--2xs">
              <span className="ui-text-small">Output destination type</span>
              <select
                className="ui-select"
                data-testid={`workflow-output-type-select-${selectedOutputIndex}`}
                value={selectedOutput.destination.type}
                disabled={!onUpdateSharedDraft}
                onChange={(event) => {
                  if (!onUpdateSharedDraft) {
                    return;
                  }
                  onUpdateSharedDraft((draft) => setWorkflowOutputDestinationType(
                    draft,
                    selectedOutput.id,
                    event.target.value,
                  ).draft);
                }}
              >
                {!knownDestinationTypeSet.has(selectedOutput.destination.type) ? (
                  <option value={selectedOutput.destination.type}>
                    {selectedOutput.destination.type} (unknown)
                  </option>
                ) : null}
                {workflowOutputTypeDefinitions.map((entry) => (
                  <option key={entry.destinationType} value={entry.destinationType}>{entry.label}</option>
                ))}
              </select>
            </label>

            <div className="ui-stack ui-stack--2xs" data-testid={`workflow-output-config-${selectedOutputIndex}`}>
              {(selectedDefinition?.configurationFields ?? []).map((field) => {
                const value = readWorkflowOutputFieldValue(selectedOutput, field);
                const fieldPathPrefix = `draft.outputs[${selectedOutputIndex}]`;
                const testIdByFieldKey: Record<string, string> = Object.freeze({
                  format: `workflow-output-file-format-${selectedOutputIndex}`,
                  deliveryMode: `workflow-output-file-delivery-mode-${selectedOutputIndex}`,
                  destinationPath: `workflow-output-file-destination-path-${selectedOutputIndex}`,
                  fileName: `workflow-output-file-name-${selectedOutputIndex}`,
                  title: `workflow-output-viewer-title-${selectedOutputIndex}`,
                  presentationMode: `workflow-output-viewer-mode-${selectedOutputIndex}`,
                  entityName: `workflow-output-system-entity-${selectedOutputIndex}`,
                  destinationConfig: `workflow-output-system-config-value-${selectedOutputIndex}`,
                  promptInputId: `workflow-output-chat-prompt-input-${selectedOutputIndex}`,
                  responseField: `workflow-output-chat-response-field-${selectedOutputIndex}`,
                  conversationScope: `workflow-output-chat-scope-${selectedOutputIndex}`,
                  initialSystemPrompt: `workflow-output-chat-system-prompt-${selectedOutputIndex}`,
                });
                const testId = testIdByFieldKey[field.key] ?? `workflow-output-field-${field.key}-${selectedOutputIndex}`;
                const fieldPath = field.target === "format"
                  ? `${fieldPathPrefix}.format`
                  : field.target === "title"
                    ? `${fieldPathPrefix}.title`
                    : `${fieldPathPrefix}.destination.options.${field.key}`;
                const fieldMessages = outputSectionDraftIssues
                  .filter((issue) => issue.path === fieldPath || issue.path?.startsWith(`${fieldPath}.`))
                  .map((issue) => issue.message);

                return (
                  <label key={`${selectedOutput.id}:${field.key}`} className="ui-stack ui-stack--2xs">
                    <span className="ui-text-small">
                      {field.label}
                      {" "}
                      <span className="ui-text-secondary">
                        ({field.required ? "required" : "optional"})
                      </span>
                    </span>
                    {field.kind === "select" ? (
                      <select
                        className="ui-select"
                        data-testid={testId}
                        value={value}
                        disabled={!onUpdateSharedDraft}
                        onChange={(event) => {
                          if (!onUpdateSharedDraft) {
                            return;
                          }
                          onUpdateSharedDraft((draft) => setWorkflowOutputFieldValue(
                            draft,
                            selectedOutput.id,
                            field,
                            event.target.value,
                          ).draft);
                        }}
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="ui-input"
                        data-testid={testId}
                        value={value}
                        disabled={!onUpdateSharedDraft}
                        onChange={(event) => {
                          if (!onUpdateSharedDraft) {
                            return;
                          }
                          onUpdateSharedDraft((draft) => setWorkflowOutputFieldValue(
                            draft,
                            selectedOutput.id,
                            field,
                            event.target.value,
                          ).draft);
                        }}
                        placeholder={field.placeholder}
                      />
                    )}
                    {field.description ? (
                      <span className="ui-text-small ui-text-secondary">{field.description}</span>
                    ) : null}
                    {fieldMessages.length > 0 ? (
                      <ul className="ui-stack ui-stack--2xs">
                        {fieldMessages.map((message) => (
                          <li key={`${selectedOutput.id}:${field.key}:${message}`} className="ui-text-danger">{message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </label>
                );
              })}
            </div>

            {selectedRow && selectedRow.outputIssues.length > 0 ? (
              <ul className="ui-stack ui-stack--2xs">
                {selectedRow.outputIssues.map((message) => (
                  <li key={`${selectedOutput.id}:${message}`} className="ui-text-danger">{message}</li>
                ))}
              </ul>
            ) : (
              <p className="ui-text-muted">Output configuration valid.</p>
            )}
          </div>
        ) : null}
      </SectionBody>
    </WizardSection>
  );
}

