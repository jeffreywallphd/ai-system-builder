import { useEffect, useMemo, useState } from "react";
import {
  WorkflowDraftStateEventCategories,
  WorkflowDraftStateEventSourceTypes,
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
} from "@domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowTrigger,
  canMoveWorkflowTrigger,
  getWorkflowTriggerIssuesForIndex,
  getWorkflowTriggerKindLabel,
  getWorkflowTriggerSummary,
  getWorkflowTriggerTypeDefinition,
  getWorkflowTriggerValidationMessages,
  moveWorkflowTriggerDown,
  moveWorkflowTriggerUp,
  removeWorkflowTrigger,
  resolveWorkflowTriggerSelectionId,
  setWorkflowTriggerStateConfig,
  setWorkflowTriggerTemporalConfig,
  setWorkflowTriggerTitle,
  setWorkflowTriggerType,
  setWorkflowTriggerUserConfig,
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

function normalizeOptional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parsePositiveInteger(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function TriggerField({
  label,
  children,
}: {
  readonly label: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <label className="ui-stack ui-stack--2xs">
      <span className="ui-text-small">{label}</span>
      {children}
    </label>
  );
}

function TriggerValidationSummary({
  trigger,
  messages,
}: {
  readonly trigger: WorkflowDraftTrigger;
  readonly messages: ReadonlyArray<string>;
}): JSX.Element {
  if (messages.length === 0) {
    return <p className="ui-text-muted">Trigger configuration valid.</p>;
  }
  return (
    <ul className="ui-stack ui-stack--2xs" data-testid={`workflow-trigger-validation-${trigger.id}`}>
      {messages.map((message) => (
        <li key={`${trigger.id}:${message}`} className="ui-text-danger">{message}</li>
      ))}
    </ul>
  );
}

function UserTriggerConfigEditor({
  trigger,
  triggerIndex,
  disabled,
  onPatch,
}: {
  readonly trigger: WorkflowDraftUserTrigger;
  readonly triggerIndex: number;
  readonly disabled: boolean;
  readonly onPatch: (patch: Readonly<Record<string, unknown>>) => void;
}): JSX.Element {
  return (
    <div className="ui-form-grid" data-testid={`workflow-trigger-user-config-${triggerIndex}`}>
      <TriggerField label="Invocation scope">
        <select
          className="ui-select"
          data-testid={`workflow-trigger-user-scope-${triggerIndex}`}
          value={trigger.config.invocationScope ?? WorkflowDraftUserTriggerScopes.workflowStart}
          disabled={disabled}
          onChange={(event) => onPatch({ invocationScope: event.target.value })}
        >
          <option value={WorkflowDraftUserTriggerScopes.workflowStart}>Workflow start</option>
          <option value={WorkflowDraftUserTriggerScopes.workflowContinuation}>Workflow continuation</option>
        </select>
      </TriggerField>

      {trigger.type === WorkflowDraftTriggerTypes.userButtonClick ? (
        <TriggerField label="Button id">
          <input
            className="ui-input"
            data-testid={`workflow-trigger-user-button-id-${triggerIndex}`}
            value={trigger.config.buttonId ?? ""}
            disabled={disabled}
            onChange={(event) => onPatch({
              buttonId: normalizeOptional(event.target.value),
            })}
            placeholder="run-workflow"
          />
        </TriggerField>
      ) : null}

      <TriggerField label="Allowed roles (comma-separated)">
        <input
          className="ui-input"
          data-testid={`workflow-trigger-user-allowed-roles-${triggerIndex}`}
          value={(trigger.config.allowedRoles ?? []).join(", ")}
          disabled={disabled}
          onChange={(event) => {
            const roles = event.target.value
              .split(",")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0);
            onPatch({
              allowedRoles: roles.length > 0 ? Object.freeze(Array.from(new Set(roles))) : undefined,
            });
          }}
          placeholder="operator, reviewer"
        />
      </TriggerField>

      <label className="ui-row ui-row--start workflow-step-checkbox-field">
        <input
          className="ui-checkbox"
          type="checkbox"
          data-testid={`workflow-trigger-user-requires-confirmation-${triggerIndex}`}
          checked={trigger.config.requiresConfirmation ?? false}
          disabled={disabled}
          onChange={(event) => onPatch({
            requiresConfirmation: event.target.checked,
          })}
        />
        <span className="ui-text-small">Require explicit confirmation</span>
      </label>

      {trigger.config.invocationScope === WorkflowDraftUserTriggerScopes.workflowContinuation ? (
        <>
          <TriggerField label="Continuation step id (optional)">
            <input
              className="ui-input"
              data-testid={`workflow-trigger-user-continuation-step-${triggerIndex}`}
              value={trigger.config.continuationStepId ?? ""}
              disabled={disabled}
              onChange={(event) => onPatch({
                continuationStepId: normalizeOptional(event.target.value),
              })}
              placeholder="step-id"
            />
          </TriggerField>
          <TriggerField label="Continuation token reference (optional)">
            <input
              className="ui-input"
              data-testid={`workflow-trigger-user-continuation-token-${triggerIndex}`}
              value={trigger.config.continuationTokenRef ?? ""}
              disabled={disabled}
              onChange={(event) => onPatch({
                continuationTokenRef: normalizeOptional(event.target.value),
              })}
              placeholder="token-ref"
            />
          </TriggerField>
        </>
      ) : null}
    </div>
  );
}

function TemporalTriggerConfigEditor({
  trigger,
  triggerIndex,
  disabled,
  onPatch,
}: {
  readonly trigger: WorkflowDraftTemporalTrigger;
  readonly triggerIndex: number;
  readonly disabled: boolean;
  readonly onPatch: (patch: Readonly<Record<string, unknown>>) => void;
}): JSX.Element {
  const isRecurring = trigger.type === WorkflowDraftTriggerTypes.temporalRecurring;
  const scheduleMode = trigger.config.scheduleMode
    ?? (isRecurring ? WorkflowDraftTemporalScheduleModes.interval : WorkflowDraftTemporalScheduleModes.cron);
  const useOneTime = !isRecurring && scheduleMode === WorkflowDraftTemporalScheduleModes.oneTime;

  return (
    <div className="ui-form-grid" data-testid={`workflow-trigger-temporal-config-${triggerIndex}`}>
      {!isRecurring ? (
        <TriggerField label="Schedule mode">
          <select
            className="ui-select"
            data-testid={`workflow-trigger-temporal-schedule-mode-${triggerIndex}`}
            value={scheduleMode}
            disabled={disabled}
            onChange={(event) => {
              const nextMode = event.target.value;
              onPatch({
                scheduleMode: nextMode,
                runAt: nextMode === WorkflowDraftTemporalScheduleModes.oneTime ? trigger.config.runAt : undefined,
                cronExpression: nextMode === WorkflowDraftTemporalScheduleModes.oneTime
                  ? undefined
                  : (trigger.config.cronExpression ?? "0 9 * * *"),
              });
            }}
          >
            <option value={WorkflowDraftTemporalScheduleModes.cron}>Cron schedule</option>
            <option value={WorkflowDraftTemporalScheduleModes.oneTime}>One-time run</option>
          </select>
        </TriggerField>
      ) : null}

      {isRecurring ? (
        <>
          <TriggerField label="Every">
            <input
              className="ui-input"
              type="number"
              min={1}
              step={1}
              data-testid={`workflow-trigger-temporal-every-${triggerIndex}`}
              value={String(trigger.config.every ?? "")}
              disabled={disabled}
              onChange={(event) => onPatch({
                every: parsePositiveInteger(event.target.value),
              })}
            />
          </TriggerField>
          <TriggerField label="Unit">
            <select
              className="ui-select"
              data-testid={`workflow-trigger-temporal-unit-${triggerIndex}`}
              value={trigger.config.unit ?? "days"}
              disabled={disabled}
              onChange={(event) => onPatch({
                unit: event.target.value,
              })}
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </TriggerField>
        </>
      ) : null}

      {!isRecurring && !useOneTime ? (
        <TriggerField label="Cron expression">
          <input
            className="ui-input"
            data-testid={`workflow-trigger-temporal-cron-${triggerIndex}`}
            value={trigger.config.cronExpression ?? ""}
            disabled={disabled}
            onChange={(event) => onPatch({
              cronExpression: normalizeOptional(event.target.value),
              runAt: undefined,
            })}
            placeholder="0 9 * * *"
          />
        </TriggerField>
      ) : null}

      {!isRecurring && useOneTime ? (
        <TriggerField label="Run at (ISO timestamp)">
          <input
            className="ui-input"
            data-testid={`workflow-trigger-temporal-run-at-${triggerIndex}`}
            value={trigger.config.runAt ?? ""}
            disabled={disabled}
            onChange={(event) => onPatch({
              runAt: normalizeOptional(event.target.value),
              cronExpression: undefined,
            })}
            placeholder="2026-04-01T09:00:00.000Z"
          />
        </TriggerField>
      ) : null}

      <TriggerField label="Timezone (optional)">
        <input
          className="ui-input"
          data-testid={`workflow-trigger-temporal-timezone-${triggerIndex}`}
          value={trigger.config.timezone ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({
            timezone: normalizeOptional(event.target.value),
          })}
          placeholder="UTC"
        />
      </TriggerField>

      <TriggerField label="Start at (optional, ISO timestamp)">
        <input
          className="ui-input"
          data-testid={`workflow-trigger-temporal-start-at-${triggerIndex}`}
          value={trigger.config.startAt ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({
            startAt: normalizeOptional(event.target.value),
          })}
          placeholder="2026-04-01T00:00:00.000Z"
        />
      </TriggerField>

      <TriggerField label="End at (optional, ISO timestamp)">
        <input
          className="ui-input"
          data-testid={`workflow-trigger-temporal-end-at-${triggerIndex}`}
          value={trigger.config.endAt ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({
            endAt: normalizeOptional(event.target.value),
          })}
          placeholder="2026-12-31T23:59:59.000Z"
        />
      </TriggerField>
    </div>
  );
}

function StateTriggerConfigEditor({
  trigger,
  triggerIndex,
  disabled,
  onPatch,
}: {
  readonly trigger: WorkflowDraftStateTrigger;
  readonly triggerIndex: number;
  readonly disabled: boolean;
  readonly onPatch: (patch: Readonly<Record<string, unknown>>) => void;
}): JSX.Element {
  const isAssetSource = (trigger.config.sourceType ?? "") === WorkflowDraftStateEventSourceTypes.asset
    || trigger.type === WorkflowDraftTriggerTypes.stateAssetStateChanged;

  return (
    <div className="ui-form-grid" data-testid={`workflow-trigger-state-config-${triggerIndex}`}>
      <TriggerField label="Event source">
        <select
          className="ui-select"
          data-testid={`workflow-trigger-state-source-type-${triggerIndex}`}
          value={trigger.config.sourceType ?? WorkflowDraftStateEventSourceTypes.dataset}
          disabled={disabled}
          onChange={(event) => onPatch({
            sourceType: event.target.value,
          })}
        >
          <option value={WorkflowDraftStateEventSourceTypes.dataset}>Dataset</option>
          <option value={WorkflowDraftStateEventSourceTypes.asset}>Asset</option>
          <option value={WorkflowDraftStateEventSourceTypes.system}>System</option>
        </select>
      </TriggerField>

      <TriggerField label="Event category">
        <select
          className="ui-select"
          data-testid={`workflow-trigger-state-event-category-${triggerIndex}`}
          value={trigger.config.eventCategory ?? WorkflowDraftStateEventCategories.dataIngested}
          disabled={disabled}
          onChange={(event) => onPatch({
            eventCategory: event.target.value,
          })}
        >
          <option value={WorkflowDraftStateEventCategories.dataIngested}>Data ingested</option>
          <option value={WorkflowDraftStateEventCategories.assetUpdated}>Asset updated</option>
          <option value={WorkflowDraftStateEventCategories.systemStateChanged}>System state changed</option>
        </select>
      </TriggerField>

      <TriggerField label="Subject (optional)">
        <input
          className="ui-input"
          data-testid={`workflow-trigger-state-subject-${triggerIndex}`}
          value={trigger.config.subject ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({
            subject: normalizeOptional(event.target.value),
          })}
          placeholder="dataset"
        />
      </TriggerField>

      <TriggerField label="Event name">
        <input
          className="ui-input"
          data-testid={`workflow-trigger-state-event-name-${triggerIndex}`}
          value={trigger.config.eventName ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({
            eventName: normalizeOptional(event.target.value),
          })}
          placeholder="system-event"
        />
      </TriggerField>

      <TriggerField label="State key (optional)">
        <input
          className="ui-input"
          data-testid={`workflow-trigger-state-key-${triggerIndex}`}
          value={trigger.config.stateKey ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({
            stateKey: normalizeOptional(event.target.value),
          })}
          placeholder="status"
        />
      </TriggerField>

      <TriggerField label="State value (optional)">
        <input
          className="ui-input"
          data-testid={`workflow-trigger-state-value-${triggerIndex}`}
          value={trigger.config.stateValue ?? ""}
          disabled={disabled}
          onChange={(event) => onPatch({
            stateValue: normalizeOptional(event.target.value),
          })}
          placeholder="ready"
        />
      </TriggerField>

      {isAssetSource ? (
        <>
          <TriggerField label="Asset id">
            <input
              className="ui-input"
              data-testid={`workflow-trigger-state-asset-id-${triggerIndex}`}
              value={trigger.config.asset?.assetId ?? ""}
              disabled={disabled}
              onChange={(event) => onPatch({
                asset: Object.freeze({
                  ...(trigger.config.asset ?? {}),
                  assetId: normalizeOptional(event.target.value),
                }),
              })}
              placeholder="asset:source"
            />
          </TriggerField>
          <TriggerField label="Asset version id (optional)">
            <input
              className="ui-input"
              data-testid={`workflow-trigger-state-asset-version-id-${triggerIndex}`}
              value={trigger.config.asset?.versionId ?? ""}
              disabled={disabled}
              onChange={(event) => onPatch({
                asset: Object.freeze({
                  ...(trigger.config.asset ?? {}),
                  versionId: normalizeOptional(event.target.value),
                }),
              })}
              placeholder="asset:source:v1"
            />
          </TriggerField>
        </>
      ) : null}
    </div>
  );
}

function TriggerTypeSpecificEditor({
  trigger,
  triggerIndex,
  disabled,
  onPatch,
}: {
  readonly trigger: WorkflowDraftTrigger;
  readonly triggerIndex: number;
  readonly disabled: boolean;
  readonly onPatch: (patch: Readonly<Record<string, unknown>>) => void;
}): JSX.Element {
  if (trigger.kind === WorkflowDraftTriggerKinds.user) {
    return (
      <UserTriggerConfigEditor
        trigger={trigger as WorkflowDraftUserTrigger}
        triggerIndex={triggerIndex}
        disabled={disabled}
        onPatch={onPatch}
      />
    );
  }
  if (trigger.kind === WorkflowDraftTriggerKinds.temporal) {
    return (
      <TemporalTriggerConfigEditor
        trigger={trigger as WorkflowDraftTemporalTrigger}
        triggerIndex={triggerIndex}
        disabled={disabled}
        onPatch={onPatch}
      />
    );
  }
  return (
    <StateTriggerConfigEditor
      trigger={trigger as WorkflowDraftStateTrigger}
      triggerIndex={triggerIndex}
      disabled={disabled}
      onPatch={onPatch}
    />
  );
}

export default function WorkflowStudioTriggerSectionEditor({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
}: WorkflowStudioTriggerSectionEditorProps): JSX.Element {
  const [newTriggerType, setNewTriggerType] = useState(
    workflowTriggerTypeDefinitions[0]?.type ?? WorkflowDraftTriggerTypes.userManual,
  );
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | undefined>(() => (
    resolveWorkflowTriggerSelectionId(sharedDraft)
  ));
  const availableTypes = useMemo(() => workflowTriggerTypeDefinitions, []);
  const stepIds = useMemo(
    () => sharedDraft.steps.map((step) => step.id),
    [sharedDraft.steps],
  );

  useEffect(() => {
    const resolved = resolveWorkflowTriggerSelectionId(sharedDraft, selectedTriggerId);
    if (resolved !== selectedTriggerId) {
      setSelectedTriggerId(resolved);
    }
  }, [selectedTriggerId, sharedDraft]);

  const triggerRows = sharedDraft.triggers.map((trigger, index) => {
    const draftIssueMessages = getWorkflowTriggerIssuesForIndex(draftValidationIssues, index);
    const validationMessages = getWorkflowTriggerValidationMessages({
      trigger,
      draftIssueMessages,
      stepIds,
    });
    return Object.freeze({
      trigger,
      index,
      typeDefinition: getWorkflowTriggerTypeDefinition(trigger.type),
      validationMessages,
      hasErrors: validationMessages.length > 0,
      summary: getWorkflowTriggerSummary(trigger),
    });
  });

  const sectionHasErrors = triggerRows.some((entry) => entry.hasErrors);
  const selectedRow = triggerRows.find((row) => row.trigger.id === selectedTriggerId);
  const selectedTrigger = selectedRow?.trigger;
  const selectedIndex = selectedRow?.index ?? -1;
  const selectedTypeDefinition = selectedRow?.typeDefinition;

  return (
    <WizardSection sectionId="workflow-wizard-trigger" validationState={sectionHasErrors ? "error" : "none"}>
      <SectionHeader
        title="Trigger Section"
        description="Configure workflow activation and continuation events. Trigger definitions and validation are shared with canonical workflow contracts."
      />
      <SectionBody>
        <div className="ui-text-small">{buildSectionSummary(sharedDraft.triggers.length, "trigger", "triggers")}</div>

        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Add trigger</strong>
          <div className="ui-row ui-row--wrap">
            <label className="ui-field">
              <span className="ui-field__label">Trigger type</span>
              <select
                className="ui-select"
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
              className="ui-button ui-button--sm"
              data-testid="workflow-trigger-add"
              disabled={!onUpdateSharedDraft}
              onClick={() => {
                if (!onUpdateSharedDraft) {
                  return;
                }
                onUpdateSharedDraft((draft) => {
                  const added = addWorkflowTrigger(draft, { type: newTriggerType });
                  setSelectedTriggerId(added.triggerId);
                  return added.draft;
                });
              }}
            >
              Add trigger
            </button>
          </div>
        </div>

        {triggerRows.length === 0 ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-trigger-empty-state">
            <strong>No triggers configured yet.</strong>
            <span className="ui-text-small ui-text-secondary">
              Add at least one trigger to define workflow start or continuation behavior.
            </span>
          </div>
        ) : (
          <div className="ui-stack ui-stack--2xs" data-testid="workflow-trigger-list">
            {triggerRows.map((row) => (
              <article
                key={row.trigger.id}
                className="ui-card ui-card--padded ui-stack ui-stack--2xs"
                data-testid={`workflow-trigger-row-${row.index}`}
              >
                <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
                  <button
                    type="button"
                    className={`ui-button ui-button--sm ${selectedTriggerId === row.trigger.id ? "ui-button--primary" : "ui-button--ghost"}`}
                    data-testid={`workflow-trigger-select-${row.index}`}
                    onClick={() => setSelectedTriggerId(row.trigger.id)}
                  >
                    {row.trigger.title?.trim() || `Trigger ${row.index + 1}`}
                  </button>
                  <span className="ui-text-small ui-text-secondary">{row.summary}</span>
                </div>
                <div className="ui-text-small ui-text-secondary">{row.typeDefinition?.label ?? row.trigger.type}</div>
                <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    data-testid={`workflow-trigger-move-up-${row.index}`}
                    disabled={!onUpdateSharedDraft || !canMoveWorkflowTrigger(sharedDraft, row.trigger.id, "up")}
                    onClick={() => {
                      if (!onUpdateSharedDraft) {
                        return;
                      }
                      onUpdateSharedDraft((draft) => moveWorkflowTriggerUp(draft, row.trigger.id).draft);
                    }}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    data-testid={`workflow-trigger-move-down-${row.index}`}
                    disabled={!onUpdateSharedDraft || !canMoveWorkflowTrigger(sharedDraft, row.trigger.id, "down")}
                    onClick={() => {
                      if (!onUpdateSharedDraft) {
                        return;
                      }
                      onUpdateSharedDraft((draft) => moveWorkflowTriggerDown(draft, row.trigger.id).draft);
                    }}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    data-testid={`workflow-trigger-remove-${row.index}`}
                    disabled={!onUpdateSharedDraft}
                    onClick={() => {
                      if (!onUpdateSharedDraft) {
                        return;
                      }
                      onUpdateSharedDraft((draft) => removeWorkflowTrigger(draft, row.trigger.id).draft);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {selectedTrigger ? (
          <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-trigger-selected-editor">
            <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
              <strong>Editing {selectedTrigger.title?.trim() || `Trigger ${selectedIndex + 1}`}</strong>
              <span className="ui-text-small ui-text-secondary">{selectedTypeDefinition?.configSchemaId}</span>
            </div>
            <div className="ui-form-grid">
              <TriggerField label="Trigger type">
                <select
                  className="ui-select"
                  data-testid={`workflow-trigger-type-${selectedIndex}`}
                  value={selectedTrigger.type}
                  disabled={!onUpdateSharedDraft}
                  onChange={(event) => {
                    if (!onUpdateSharedDraft) {
                      return;
                    }
                    onUpdateSharedDraft((draft) => setWorkflowTriggerType(
                      draft,
                      selectedTrigger.id,
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
              </TriggerField>

              <TriggerField label="Trigger name (optional)">
                <input
                  className="ui-input"
                  data-testid={`workflow-trigger-title-${selectedIndex}`}
                  value={selectedTrigger.title ?? ""}
                  disabled={!onUpdateSharedDraft}
                  onChange={(event) => {
                    if (!onUpdateSharedDraft) {
                      return;
                    }
                    onUpdateSharedDraft((draft) => setWorkflowTriggerTitle(
                      draft,
                      selectedTrigger.id,
                      event.target.value,
                    ).draft);
                  }}
                  placeholder="My trigger"
                />
              </TriggerField>
            </div>

            <div className="ui-text-small ui-text-secondary">
              {selectedTypeDefinition?.description ?? "Configured trigger definition."}
            </div>
            {selectedTypeDefinition?.capabilities.supportsIntermediateContinuation ? (
              <p className="ui-text-small">
                Supports continuation semantics for intermediate resume and human-approval handoff flows.
              </p>
            ) : null}

            <TriggerTypeSpecificEditor
              trigger={selectedTrigger}
              triggerIndex={selectedIndex}
              disabled={!onUpdateSharedDraft}
              onPatch={(patch) => {
                if (!onUpdateSharedDraft) {
                  return;
                }
                onUpdateSharedDraft((draft) => {
                  if (selectedTrigger.kind === WorkflowDraftTriggerKinds.user) {
                    return setWorkflowTriggerUserConfig(
                      draft,
                      selectedTrigger.id,
                      patch as Partial<WorkflowDraftUserTrigger["config"]>,
                    ).draft;
                  }
                  if (selectedTrigger.kind === WorkflowDraftTriggerKinds.temporal) {
                    return setWorkflowTriggerTemporalConfig(
                      draft,
                      selectedTrigger.id,
                      patch as Partial<WorkflowDraftTemporalTrigger["config"]>,
                    ).draft;
                  }
                  return setWorkflowTriggerStateConfig(
                    draft,
                    selectedTrigger.id,
                    patch as Partial<WorkflowDraftStateTrigger["config"]>,
                  ).draft;
                });
              }}
            />

            <TriggerValidationSummary
              trigger={selectedTrigger}
              messages={selectedRow?.validationMessages ?? []}
            />
          </div>
        ) : null}
      </SectionBody>
    </WizardSection>
  );
}

