import {
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  type WorkflowDraft,
  type WorkflowDraftStateTrigger,
  type WorkflowDraftTemporalTrigger,
  type WorkflowDraftTrigger,
  type WorkflowDraftTriggerType,
  type WorkflowValidationIssue,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import SectionBody from "./SectionBody";
import SectionHeader from "./SectionHeader";
import WizardSection from "./WizardSection";

interface WorkflowStudioTriggerSectionEditorProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
}

type TriggerBlueprintKey = "manual" | "temporal" | "state";
type TemporalRecurrence = "daily" | "weekdays" | "weekly";

interface TriggerBlueprint {
  readonly key: TriggerBlueprintKey;
  readonly label: string;
  readonly description: string;
  readonly create: (id: string) => WorkflowDraftTrigger;
}

const triggerBlueprints: ReadonlyArray<TriggerBlueprint> = Object.freeze([
  Object.freeze({
    key: "manual",
    label: "Manual/User Trigger",
    description: "Run from user-driven actions such as a manual start button.",
    create: (id: string): WorkflowDraftTrigger => Object.freeze({
      id,
      kind: WorkflowDraftTriggerKinds.user,
      type: WorkflowDraftTriggerTypes.userManual,
      config: Object.freeze({}),
    }),
  }),
  Object.freeze({
    key: "temporal",
    label: "Temporal Trigger",
    description: "Run on a simple recurring schedule with a selected time.",
    create: (id: string): WorkflowDraftTrigger => Object.freeze({
      id,
      kind: WorkflowDraftTriggerKinds.temporal,
      type: WorkflowDraftTriggerTypes.temporalSchedule,
      config: Object.freeze({
        cronExpression: "0 9 * * *",
      }),
      metadata: Object.freeze({
        recurrence: "daily",
      }),
    }),
  }),
  Object.freeze({
    key: "state",
    label: "State Trigger",
    description: "Run from workflow-relevant state or data events.",
    create: (id: string): WorkflowDraftTrigger => Object.freeze({
      id,
      kind: WorkflowDraftTriggerKinds.state,
      type: WorkflowDraftTriggerTypes.stateSystemEvent,
      config: Object.freeze({
        eventName: "new-data",
      }),
    }),
  }),
]);

function buildSectionSummary(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function resolveBlueprintForTrigger(trigger: WorkflowDraftTrigger): TriggerBlueprint {
  if (trigger.kind === WorkflowDraftTriggerKinds.temporal) {
    return triggerBlueprints[1];
  }
  if (trigger.kind === WorkflowDraftTriggerKinds.state) {
    return triggerBlueprints[2];
  }
  return triggerBlueprints[0];
}

function resolveBlueprintByKey(key: TriggerBlueprintKey): TriggerBlueprint {
  return triggerBlueprints.find((entry) => entry.key === key) ?? triggerBlueprints[0];
}

function buildNextTriggerId(triggers: ReadonlyArray<WorkflowDraftTrigger>): string {
  const existing = new Set(triggers.map((trigger) => trigger.id));
  let index = triggers.length + 1;
  let candidate = `trigger-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `trigger-${index}`;
  }
  return candidate;
}

function parseTimeFromCron(cronExpression?: string): string {
  if (!cronExpression) {
    return "";
  }
  const match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|1)$/);
  if (!match) {
    return "";
  }
  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (Number.isNaN(minute) || Number.isNaN(hour) || minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    return "";
  }
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function parseRecurrenceFromCron(cronExpression?: string): TemporalRecurrence {
  if (!cronExpression) {
    return "daily";
  }
  const match = cronExpression.match(/^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|1)$/);
  if (!match) {
    return "daily";
  }
  const dayToken = match[3];
  if (dayToken === "1-5") {
    return "weekdays";
  }
  if (dayToken === "1") {
    return "weekly";
  }
  return "daily";
}

function buildCronExpression(timeOfDay: string, recurrence: TemporalRecurrence): string | undefined {
  const match = timeOfDay.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return undefined;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const dayToken = recurrence === "weekdays" ? "1-5" : recurrence === "weekly" ? "1" : "*";
  return `${minute} ${hour} * * ${dayToken}`;
}

function buildTriggerValidationIssues(
  trigger: WorkflowDraftTrigger,
  draftIssues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyArray<string> {
  const issues: string[] = [];
  if (trigger.kind === WorkflowDraftTriggerKinds.temporal) {
    const temporalTrigger = trigger as WorkflowDraftTemporalTrigger;
    if (temporalTrigger.type === WorkflowDraftTriggerTypes.temporalSchedule) {
      if (!parseTimeFromCron(temporalTrigger.config.cronExpression)) {
        issues.push("Temporal trigger requires a valid time of day.");
      }
    }
    if (temporalTrigger.type === WorkflowDraftTriggerTypes.temporalRecurring) {
      if (!temporalTrigger.config.every || temporalTrigger.config.every < 1) {
        issues.push("Temporal recurring trigger requires a positive interval.");
      }
      if (!temporalTrigger.config.unit) {
        issues.push("Temporal recurring trigger requires an interval unit.");
      }
    }
  }

  if (trigger.kind === WorkflowDraftTriggerKinds.state) {
    const stateTrigger = trigger as WorkflowDraftStateTrigger;
    const supportedTypes: ReadonlyArray<WorkflowDraftTriggerType> = Object.freeze([
      WorkflowDraftTriggerTypes.stateDataAvailable,
      WorkflowDraftTriggerTypes.stateSystemEvent,
      WorkflowDraftTriggerTypes.stateAssetStateChanged,
    ]);
    if (!supportedTypes.includes(stateTrigger.type)) {
      issues.push("State trigger requires an event type.");
    }

    if (stateTrigger.type === WorkflowDraftTriggerTypes.stateSystemEvent && !stateTrigger.config.eventName?.trim()) {
      issues.push("State trigger system-event type requires an event name.");
    }

    if (stateTrigger.type === WorkflowDraftTriggerTypes.stateAssetStateChanged && !stateTrigger.config.asset?.assetId?.trim()) {
      issues.push("State trigger asset-state-changed type requires an asset reference.");
    }
  }

  for (const issue of draftIssues) {
    issues.push(issue.message);
  }
  return Object.freeze([...new Set(issues)]);
}

function buildStateConfigForType(
  type: WorkflowDraftStateTrigger["type"],
  current: WorkflowDraftStateTrigger["config"],
): WorkflowDraftStateTrigger["config"] {
  if (type === WorkflowDraftTriggerTypes.stateAssetStateChanged) {
    return Object.freeze({
      ...current,
      asset: current.asset ?? Object.freeze({
        assetId: "",
      }),
    });
  }

  if (type === WorkflowDraftTriggerTypes.stateSystemEvent) {
    return Object.freeze({
      ...current,
      eventName: current.eventName ?? "",
    });
  }

  return Object.freeze({
    ...current,
    asset: undefined,
  });
}

function updateTriggerAtIndex(
  draft: WorkflowDraft,
  index: number,
  updater: (trigger: WorkflowDraftTrigger) => WorkflowDraftTrigger,
): WorkflowDraft {
  return Object.freeze({
    ...draft,
    triggers: Object.freeze(draft.triggers.map((trigger, triggerIndex) => (
      triggerIndex === index ? updater(trigger) : trigger
    ))),
  });
}

export default function WorkflowStudioTriggerSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
}: WorkflowStudioTriggerSectionEditorProps): JSX.Element {
  const triggerRows = sharedDraft.triggers.map((trigger, index) => {
    const triggerDraftIssues = draftValidationIssues.filter((issue) => issue.path?.startsWith(`draft.triggers[${index}]`));
    const triggerValidationIssues = buildTriggerValidationIssues(trigger, triggerDraftIssues);
    return Object.freeze({
      trigger,
      index,
      blueprint: resolveBlueprintForTrigger(trigger),
      validationIssues: triggerValidationIssues,
      hasErrors: triggerValidationIssues.length > 0,
    });
  });

  const sectionHasErrors = triggerRows.some((entry) => entry.hasErrors);

  return (
    <WizardSection sectionId="workflow-wizard-trigger" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Trigger Section"
        description="Define what starts workflow execution. This section edits the shared workflow draft triggers array."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.triggers.length, "trigger", "triggers")}</div>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          {triggerBlueprints.map((blueprint) => (
            <button
              key={blueprint.key}
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              data-testid={`workflow-trigger-add-${blueprint.key}`}
              disabled={!onUpdateSharedDraft}
              onClick={() => {
                if (!onUpdateSharedDraft) {
                  return;
                }
                onUpdateSharedDraft((draft) => Object.freeze({
                  ...draft,
                  triggers: Object.freeze([
                    ...draft.triggers,
                    resolveBlueprintByKey(blueprint.key).create(buildNextTriggerId(draft.triggers)),
                  ]),
                }));
              }}
            >
              Add {blueprint.label}
            </button>
          ))}
        </div>

        {sharedDraft.triggers.length === 0 ? <p className="ui-text-muted">No triggers configured yet.</p> : null}

        {sharedDraft.triggers.map((trigger, index) => {
          const row = triggerRows[index] ?? Object.freeze({
            trigger,
            index,
            blueprint: resolveBlueprintForTrigger(trigger),
            validationIssues: Object.freeze([]),
            hasErrors: false,
          });
          const temporalTrigger = trigger.kind === WorkflowDraftTriggerKinds.temporal ? trigger as WorkflowDraftTemporalTrigger : undefined;
          const stateTrigger = trigger.kind === WorkflowDraftTriggerKinds.state ? trigger as WorkflowDraftStateTrigger : undefined;
          const temporalTime = temporalTrigger ? parseTimeFromCron(temporalTrigger.config.cronExpression) : "";
          const temporalRecurrence = temporalTrigger ? parseRecurrenceFromCron(temporalTrigger.config.cronExpression) : "daily";

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
                    onUpdateSharedDraft((draft) => Object.freeze({
                      ...draft,
                      triggers: Object.freeze(draft.triggers.filter((_, triggerIndex) => triggerIndex !== index)),
                    }));
                  }}
                >
                  Remove
                </button>
              </div>

              <div className="ui-text-muted">{row.blueprint.description}</div>

              <div className="ui-form-grid">
                <label className="ui-field">
                  <span className="ui-field__label">Trigger type</span>
                  <select
                    className="ui-input"
                    data-testid={`workflow-trigger-type-${index}`}
                    value={row.blueprint.key}
                    disabled={!onUpdateSharedDraft}
                    onChange={(event) => {
                      if (!onUpdateSharedDraft) {
                        return;
                      }
                      const nextBlueprint = resolveBlueprintByKey(event.target.value as TriggerBlueprintKey);
                      onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                        const replaced = nextBlueprint.create(current.id);
                        return Object.freeze({
                          ...replaced,
                          id: current.id,
                          title: current.title,
                          description: current.description,
                        });
                      }));
                    }}
                  >
                    {triggerBlueprints.map((blueprint) => (
                      <option key={blueprint.key} value={blueprint.key}>{blueprint.label}</option>
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
                      onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => Object.freeze({
                        ...current,
                        title: event.target.value || undefined,
                      })));
                    }}
                    placeholder="My trigger"
                  />
                </label>
              </div>

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
                        const nextType = event.target.value as WorkflowDraftTemporalTrigger["type"];
                        onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                          const temporalCurrent = current as WorkflowDraftTemporalTrigger;
                          if (nextType === WorkflowDraftTriggerTypes.temporalRecurring) {
                            return Object.freeze({
                              ...temporalCurrent,
                              type: WorkflowDraftTriggerTypes.temporalRecurring,
                              config: Object.freeze({
                                every: temporalCurrent.config.every ?? 1,
                                unit: temporalCurrent.config.unit ?? "days",
                                timezone: temporalCurrent.config.timezone,
                              }),
                            });
                          }

                          return Object.freeze({
                            ...temporalCurrent,
                            type: WorkflowDraftTriggerTypes.temporalSchedule,
                            config: Object.freeze({
                              cronExpression: temporalCurrent.config.cronExpression ?? "0 9 * * *",
                              timezone: temporalCurrent.config.timezone,
                            }),
                          });
                        }));
                      }}
                    >
                      <option value={WorkflowDraftTriggerTypes.temporalSchedule}>Schedule (time of day)</option>
                      <option value={WorkflowDraftTriggerTypes.temporalRecurring}>Recurring interval</option>
                    </select>
                  </label>

                  {temporalTrigger.type === WorkflowDraftTriggerTypes.temporalSchedule ? (
                    <>
                      <label className="ui-field">
                        <span className="ui-field__label">Time of day</span>
                        <input
                          className="ui-input"
                          type="time"
                          data-testid={`workflow-trigger-temporal-time-${index}`}
                          value={temporalTime}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                              const temporalCurrent = current as WorkflowDraftTemporalTrigger;
                              const nextCronExpression = buildCronExpression(event.target.value, temporalRecurrence);
                              return Object.freeze({
                                ...temporalCurrent,
                                type: WorkflowDraftTriggerTypes.temporalSchedule,
                                config: Object.freeze({
                                  ...temporalCurrent.config,
                                  cronExpression: nextCronExpression,
                                  every: undefined,
                                  unit: undefined,
                                }),
                              });
                            }));
                          }}
                        />
                      </label>

                      <label className="ui-field">
                        <span className="ui-field__label">Recurrence</span>
                        <select
                          className="ui-input"
                          data-testid={`workflow-trigger-temporal-recurrence-${index}`}
                          value={temporalRecurrence}
                          disabled={!onUpdateSharedDraft}
                          onChange={(event) => {
                            if (!onUpdateSharedDraft) {
                              return;
                            }
                            const nextRecurrence = event.target.value as TemporalRecurrence;
                            onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                              const temporalCurrent = current as WorkflowDraftTemporalTrigger;
                              const timeOfDay = parseTimeFromCron(temporalCurrent.config.cronExpression) || "09:00";
                              const nextCronExpression = buildCronExpression(timeOfDay, nextRecurrence);
                              return Object.freeze({
                                ...temporalCurrent,
                                type: WorkflowDraftTriggerTypes.temporalSchedule,
                                config: Object.freeze({
                                  ...temporalCurrent.config,
                                  cronExpression: nextCronExpression,
                                  every: undefined,
                                  unit: undefined,
                                }),
                                metadata: Object.freeze({
                                  ...(temporalCurrent.metadata ?? {}),
                                  recurrence: nextRecurrence,
                                }),
                              });
                            }));
                          }}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekdays">Weekdays</option>
                          <option value="weekly">Weekly</option>
                        </select>
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
                            onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                              const temporalCurrent = current as WorkflowDraftTemporalTrigger;
                              return Object.freeze({
                                ...temporalCurrent,
                                type: WorkflowDraftTriggerTypes.temporalRecurring,
                                config: Object.freeze({
                                  ...temporalCurrent.config,
                                  cronExpression: undefined,
                                  every: Number.isInteger(parsedEvery) && parsedEvery > 0 ? parsedEvery : undefined,
                                }),
                              });
                            }));
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
                            onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                              const temporalCurrent = current as WorkflowDraftTemporalTrigger;
                              return Object.freeze({
                                ...temporalCurrent,
                                type: WorkflowDraftTriggerTypes.temporalRecurring,
                                config: Object.freeze({
                                  ...temporalCurrent.config,
                                  cronExpression: undefined,
                                  unit: event.target.value as WorkflowDraftTemporalTrigger["config"]["unit"],
                                }),
                              });
                            }));
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
                        onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                          const temporalCurrent = current as WorkflowDraftTemporalTrigger;
                          return Object.freeze({
                            ...temporalCurrent,
                            config: Object.freeze({
                              ...temporalCurrent.config,
                              timezone: event.target.value || undefined,
                            }),
                          });
                        }));
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
                        const nextType = event.target.value as WorkflowDraftStateTrigger["type"];
                        onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                          const stateCurrent = current as WorkflowDraftStateTrigger;
                          return Object.freeze({
                            ...stateCurrent,
                            type: nextType,
                            config: buildStateConfigForType(nextType, stateCurrent.config),
                          });
                        }));
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
                        onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                          const stateCurrent = current as WorkflowDraftStateTrigger;
                          return Object.freeze({
                            ...stateCurrent,
                            config: Object.freeze({
                              ...stateCurrent.config,
                              stateKey: event.target.value || undefined,
                            }),
                          });
                        }));
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
                        onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                          const stateCurrent = current as WorkflowDraftStateTrigger;
                          return Object.freeze({
                            ...stateCurrent,
                            config: Object.freeze({
                              ...stateCurrent.config,
                              eventName: event.target.value || undefined,
                            }),
                          });
                        }));
                      }}
                      placeholder="new-data"
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
                          onUpdateSharedDraft((draft) => updateTriggerAtIndex(draft, index, (current) => {
                            const stateCurrent = current as WorkflowDraftStateTrigger;
                            return Object.freeze({
                              ...stateCurrent,
                              config: Object.freeze({
                                ...stateCurrent.config,
                                asset: Object.freeze({
                                  ...(stateCurrent.config.asset ?? {}),
                                  assetId: event.target.value,
                                }),
                              }),
                            });
                          }));
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
