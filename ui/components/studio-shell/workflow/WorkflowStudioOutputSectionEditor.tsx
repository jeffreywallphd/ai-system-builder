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
  getWorkflowOutputDestinationDefinitionByType,
  getWorkflowOutputValidationMessages,
  readWorkflowOutputFieldValue,
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
  rowPathPrefix: string,
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyArray<string> {
  const hasSupportedDestination = workflowOutputTypeDefinitions.some(
    (entry) => entry.destinationType === output.destination.type,
  );
  const rowMessages = draftValidationIssues
    .filter((issue) => issue.path?.startsWith(rowPathPrefix))
    .map((issue) => issue.message);
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
                  <div className="ui-row ui-row--between ui-row--wrap">
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
                      {workflowOutputTypeDefinitions.map((entry) => (
                        <option key={entry.destinationType} value={entry.destinationType}>{entry.label}</option>
                      ))}
                    </select>
                  </label>

                  <div className="ui-stack ui-stack--2xs" data-testid={`workflow-output-config-${row.index}`}>
                    {definition.configurationFields.map((field) => {
                      const value = readWorkflowOutputFieldValue(row.output, field);
                      const testIdByFieldKey: Record<string, string> = Object.freeze({
                        format: `workflow-output-file-format-${row.index}`,
                        fileName: `workflow-output-file-name-${row.index}`,
                        title: `workflow-output-viewer-title-${row.index}`,
                        presentationMode: `workflow-output-viewer-mode-${row.index}`,
                        entityName: `workflow-output-system-entity-${row.index}`,
                        destinationConfig: `workflow-output-system-config-value-${row.index}`,
                      });
                      const testId = testIdByFieldKey[field.key] ?? `workflow-output-field-${field.key}-${row.index}`;

                      return (
                        <label key={`${row.output.id}:${field.key}`} className="ui-stack ui-stack--2xs">
                          <span className="ui-text-small">{field.label}</span>
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
                                  row.output.id,
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
                                  row.output.id,
                                  field,
                                  event.target.value,
                                ).draft);
                              }}
                              placeholder={field.placeholder}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  <div className="ui-row ui-row--wrap">
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

