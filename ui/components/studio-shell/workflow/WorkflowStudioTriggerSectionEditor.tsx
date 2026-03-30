import { useMemo, useState } from "react";
import {
  WorkflowDraftTemporalScheduleModes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  WorkflowDraftUserTriggerScopes,
  type WorkflowDraft,
  type WorkflowDraftStateTrigger,
  type WorkflowDraftTemporalTrigger,
  type WorkflowDraftTrigger,
  type WorkflowDraftUserTrigger,
  type WorkflowValidationIssue,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowTrigger,
  getWorkflowTriggerKindLabel,
  getWorkflowTriggerTypeDefinition,
  patchWorkflowTriggerConfig,
  removeWorkflowTrigger,
  setWorkflowTriggerTitle,
  setWorkflowTriggerType,
  workflowTriggerTypeDefinitions,
} from "../../../studio-shell/workflow/WorkflowWizardTriggers";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";

interface WorkflowStudioTriggerSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
}

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export default function WorkflowStudioTriggerSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
}: WorkflowStudioTriggerSectionEditorProps): JSX.Element {
  const [newTriggerType, setNewTriggerType] = useState(
    workflowTriggerTypeDefinitions[0]?.type ?? WorkflowDraftTriggerTypes.userManual,
  );
  const availableTypes = useMemo(() => workflowTriggerTypeDefinitions, []);

  const triggerRows = sharedDraft.triggers.map((trigger, index) => {
    const triggerDraftIssues = draftValidationIssues
      .filter((issue) => issue.path?.startsWith(`draft.triggers[${index}]`))
      .map((issue) => issue.message);

    return Object.freeze({
      trigger,
      index,
      typeDefinition: getWorkflowTriggerTypeDefinition(trigger.type),
      validationIssues: triggerDraftIssues,
      hasErrors: triggerDraftIssues.length > 0,
    });
  });

  const sectionHasErrors = triggerRows.some((entry) => entry.hasErrors);

  return (
    <WizardSection sectionId="workflow-wizard-trigger" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Trigger Section"
        description="Define workflow activation and continuation events. This section edits shared workflow draft triggers."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.triggers.length, "trigger", "triggers")}</div>
        <div className="ui-row ui-row--wrap">
          <label className="ui-field">
            <span className="ui-field__label">New trigger type</span>
            <select
              className="ui-input"
              data-testid="workflow-trigger-add-type-select"
              value={newTriggerType}
              disabled={!onUpdateSharedDraft}
              onChange={(event) => setNewTriggerType(event.target.value as WorkflowDraftTrigger["type"])}
            >
              {availableTypes.map((definition) => (
                <option key={definition.type} value={definition.type}>
                  {definition.label} ({getWorkflowTriggerKindLabel(definition.kind)})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            data-testid="workflow-trigger-add"
            disabled={!onUpdateSharedDraft}
            onClick={() => {
              if (!onUpdateSharedDraft) {
                return;
              }
              onUpdateSharedDraft((draft) => addWorkflowTrigger(draft, {
                type: newTriggerType,
              }).draft);
            }}
          >
            Add trigger
          </button>
        </div>

        {sharedDraft.triggers.length === 0 ? <p className="ui-text-muted">No triggers configured yet.</p> : null}

        {sharedDraft.triggers.map((trigger, index) => {
          const row = triggerRows[index] ?? Object.freeze({
            trigger,
            index,
            typeDefinition: getWorkflowTriggerTypeDefinition(trigger.type),
            validationIssues: Object.freeze([]),
            hasErrors: false,
          });
          const temporalTrigger = trigger.kind === WorkflowDraftTriggerKinds.temporal
            ? trigger as WorkflowDraftTemporalTrigger
            : undefined;
          const stateTrigger = trigger.kind === WorkflowDraftTriggerKinds.state
            ? trigger as WorkflowDraftStateTrigger
            : undefined;
          const userTrigger = trigger.kind === WorkflowDraftTriggerKinds.user
            ? trigger as WorkflowDraftUserTrigger
            : undefined;

          return (
            <div key={trigger.id} className="ui-card ui-card--padded ui-stack ui-stack--sm">
              <div className="ui-row ui-row--between">
                <strong>{trigger.title?.trim() ? trigger.title : `Trigger ${index + 1}`}</strong>
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  data-testid={`workflow-trigger-remove-${index}`}
                  disabled={!onUpdateSharedDraft}
                  onClick={() => {
                    if (!onUpdateSharedDraft) {
                      return;
                    }
                    onUpdateSharedDraft((draft) => removeWorkflowTrigger(draft, trigger.id).draft);
                  }}
                >
                  Remove
                </button>
              </div>

              <div className="ui-text-muted">{row.typeDefinition?.description ?? "Configured trigger definition."}</div>
              {row.typeDefinition?.capabilities.supportsIntermediateContinuation ? (
                <p className="ui-text-small">
                  Supports continuation semantics for intermediate resume/handoff flows.
                </p>
              ) : null}

              <div className="ui-form-grid">
                <label className="ui-field">
                  <span className="ui-field__label">Trigger type</span>
                  <select
                    className="ui-input"
                    data-testid={`workflow-trigger-type-${index}`}
                    value={trigger.type}
                    disabled={!onUpdateSharedDraft}
                    onChange={(event) => {
                      if (!onUpdateSharedDraft) {
                        return;
                      }
                      onUpdateSharedDraft((draft) => setWorkflowTriggerType(
                        draft,
                        trigger.id,
                        event.target.value as WorkflowDraftTrigger["type"],
                      ).draft);
                    }}
                  >
                    {availableTypes.map((definition) => (
                      <option key={definition.type} value={definition.type}>
                        {definition.label} ({getWorkflowTriggerKindLabel(definition.kind)})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ui-field">
                  <span className="ui-field__label">Trigger name (optional)</span>
                  <input
                    className="ui-input"
                    data-testid={`workflow-trigger-title-${index}`}
                    value={trigger.title ?? ""}
                    disabled={!onUpdateSharedDraft}
                    onChange={(event) => {
                      if (!onUpdateSharedDraft) {
                        return;
                      }
                      onUpdateSharedDraft((draft) => setWorkflowTriggerTitle(
                        draft,
                        trigger.id,
                        event.target.value,
                      ).draft);
                    }}
                    placeholder="My trigger"
                  />
                </label>
              </div>

              {userTrigger ? (
                <div className="ui-form-grid">
                  <label className="ui-field">
                    <span className="ui-field__label">Invocation scope</span>
                    <select
                      className="ui-input"
                      data-testid={`workflow-trigger-user-scope-${index}`}
                      value={userTrigger.config.invocationScope ?? WorkflowDraftUserTriggerScopes.workflowStart}
                      disabled={!onUpdateSharedDraft}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                          invocationScope: event.target.value,
                        }).draft);
                      }}
                    >
                      <option value={WorkflowDraftUserTriggerScopes.workflowStart}>Workflow start</option>
                      <option value={WorkflowDraftUserTriggerScopes.workflowContinuation}>Workflow continuation</option>
                    </select>
                  </label>

                  {userTrigger.config.invocationScope === WorkflowDraftUserTriggerScopes.workflowContinuation ? (
                    <label className="ui-field">
                      <span className="ui-field__label">Continuation step ID</span>
                      <input
                        className="ui-input"
                        data-testid={`workflow-trigger-user-continuation-step-${index}`}
                        value={userTrigger.config.continuationStepId ?? ""}
                        disabled={!onUpdateSharedDraft}
                        onChange={(event) => {
                          if (!onUpdateSharedDraft) {
                            return;
                          }
                          onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                            continuationStepId: event.target.value || undefined,
                          }).draft);
                        }}
                        placeholder="step-id"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {temporalTrigger ? (
                <div className="ui-form-grid">
                  <label className="ui-field">
                    <span className="ui-field__label">Temporal mode</span>
                    <select
                      className="ui-input"
                      data-testid={`workflow-trigger-temporal-mode-${index}`}
                      value={temporalTrigger.type}
                      disabled={!onUpdateSharedDraft}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => setWorkflowTriggerType(
                          draft,
                          trigger.id,
                          event.target.value as WorkflowDraftTrigger["type"],
                        ).draft);
                      }}
                    >
                      <option value={WorkflowDraftTriggerTypes.temporalSchedule}>Schedule</option>
                      <option value={WorkflowDraftTriggerTypes.temporalRecurring}>Recurring interval</option>
                    </select>
                  </label>

                  {temporalTrigger.type === WorkflowDraftTriggerTypes.temporalSchedule ? (
                    <>
                      <label className="ui-field">
                        <span className="ui-field__label">Schedule mode</span>
                        <select
                          className="ui-input"
                          data-testid={`workflow-trigger-temporal-schedule-mode-${index}`}
                          value={temporalTrigger.config.scheduleMode ?? WorkflowDraftTemporalScheduleModes.cron}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                              scheduleMode: event.target.value,
                            }).draft);
                          }}
                        >
                          <option value={WorkflowDraftTemporalScheduleModes.cron}>Cron expression</option>
                          <option value={WorkflowDraftTemporalScheduleModes.oneTime}>One-time runAt</option>
                        </select>
                      </label>

                      <label className="ui-field">
                        <span className="ui-field__label">Cron expression</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-trigger-temporal-cron-${index}`}
                          value={temporalTrigger.config.cronExpression ?? ""}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                              cronExpression: event.target.value || undefined,
                            }).draft);
                          }}
                          placeholder="0 9 * * *"
                        />
                      </label>

                      <label className="ui-field">
                        <span className="ui-field__label">Run at (optional)</span>
                        <input
                          className="ui-input"
                          data-testid={`workflow-trigger-temporal-run-at-${index}`}
                          value={temporalTrigger.config.runAt ?? ""}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                              runAt: event.target.value || undefined,
                            }).draft);
                          }}
                          placeholder="2026-04-01T09:00:00.000Z"
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="ui-field">
                        <span className="ui-field__label">Every</span>
                        <input
                          className="ui-input"
                          type="number"
                          min={1}
                          step={1}
                          data-testid={`workflow-trigger-temporal-every-${index}`}
                          value={temporalTrigger.config.every ?? 1}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            const parsedEvery = Number(event.target.value);
                            onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                              every: Number.isInteger(parsedEvery) && parsedEvery > 0 ? parsedEvery : undefined,
                            }).draft);
                          }}
                        />
                      </label>

                      <label className="ui-field">
                        <span className="ui-field__label">Unit</span>
                        <select
                          className="ui-input"
                          data-testid={`workflow-trigger-temporal-unit-${index}`}
                          value={temporalTrigger.config.unit ?? "days"}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                              unit: event.target.value,
                            }).draft);
                          }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </label>
                    </>
                  )}

                  <label className="ui-field">
                    <span className="ui-field__label">Timezone (optional)</span>
                    <input
                      className="ui-input"
                      data-testid={`workflow-trigger-temporal-timezone-${index}`}
                      value={temporalTrigger.config.timezone ?? ""}
                      disabled={!onUpdateSharedDraft}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                          timezone: event.target.value || undefined,
                        }).draft);
                      }}
                      placeholder="UTC"
                    />
                  </label>
                </div>
              ) : null}

              {stateTrigger ? (
                <div className="ui-form-grid">
                  <label className="ui-field">
                    <span className="ui-field__label">Event type</span>
                    <select
                      className="ui-input"
                      data-testid={`workflow-trigger-state-type-${index}`}
                      value={stateTrigger.type}
                      disabled={!onUpdateSharedDraft}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => setWorkflowTriggerType(
                          draft,
                          trigger.id,
                          event.target.value as WorkflowDraftTrigger["type"],
                        ).draft);
                      }}
                    >
                      <option value={WorkflowDraftTriggerTypes.stateDataAvailable}>New data</option>
                      <option value={WorkflowDraftTriggerTypes.stateSystemEvent}>System event</option>
                      <option value={WorkflowDraftTriggerTypes.stateAssetStateChanged}>Asset state changed</option>
                    </select>
                  </label>

                  <label className="ui-field">
                    <span className="ui-field__label">Source reference (optional)</span>
                    <input
                      className="ui-input"
                      data-testid={`workflow-trigger-state-source-${index}`}
                      value={stateTrigger.config.stateKey ?? ""}
                      disabled={!onUpdateSharedDraft}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                          stateKey: event.target.value || undefined,
                        }).draft);
                      }}
                      placeholder="source-reference"
                    />
                  </label>

                  <label className="ui-field">
                    <span className="ui-field__label">Event name</span>
                    <input
                      className="ui-input"
                      data-testid={`workflow-trigger-state-event-name-${index}`}
                      value={stateTrigger.config.eventName ?? ""}
                      disabled={!onUpdateSharedDraft}
                      onChange={(event) => {
                        if (!onUpdateSharedDraft) {
                          return;
                        }
                        onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                          eventName: event.target.value || undefined,
                        }).draft);
                      }}
                      placeholder="event-name"
                    />
                  </label>

                  {stateTrigger.type === WorkflowDraftTriggerTypes.stateAssetStateChanged ? (
                    <label className="ui-field">
                      <span className="ui-field__label">Asset reference</span>
                      <input
                        className="ui-input"
                        data-testid={`workflow-trigger-state-asset-id-${index}`}
                        value={stateTrigger.config.asset?.assetId ?? ""}
                        disabled={!onUpdateSharedDraft}
                        onChange={(event) => {
                          if (!onUpdateSharedDraft) {
                            return;
                          }
                          onUpdateSharedDraft((draft) => patchWorkflowTriggerConfig(draft, trigger.id, {
                            asset: Object.freeze({
                              ...(stateTrigger.config.asset ?? {}),
                              assetId: event.target.value,
                            }),
                          }).draft);
                        }}
                        placeholder="asset:source"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {row.validationIssues.length > 0 ? (
                <ul className="ui-stack ui-stack--2xs">
                  {row.validationIssues.map((message) => (
                    <li key={`${trigger.id}-${message}`} className="ui-text-danger">{message}</li>
                  ))}
                </ul>
              ) : (
                <p className="ui-text-muted">Trigger configuration valid.</p>
              )}
            </div>
          );
        })}
      </SectionBody>
    </WizardSection>
  );
}
