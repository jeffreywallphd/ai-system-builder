import {
  WorkflowDraftInputSourceTypes,
  WorkflowDraftInputValueTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  type WorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";

export interface WorkflowStudioWizardModeSurfaceProps {
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
  readonly onUpdateSharedDraft: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
}

function createNextWorkflowDraftId(prefix: string, currentIds: ReadonlyArray<string>): string {
  const knownIds = new Set(currentIds);
  let counter = currentIds.length + 1;
  let candidate = `${prefix}-${counter}`;
  while (knownIds.has(candidate)) {
    counter += 1;
    candidate = `${prefix}-${counter}`;
  }
  return candidate;
}

export default function WorkflowStudioWizardModeSurface({
  sharedDraft,
  sharedDraftSerialized,
  onUpdateSharedDraft,
}: WorkflowStudioWizardModeSurfaceProps): JSX.Element {
  return (
    <div className="ui-stack ui-stack--xs" data-testid="workflow-studio-wizard-mode-surface">
      <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <strong>Wizard mode shell</strong>
        <p className="ui-text-muted">
          Guided workflow authoring operates on the same canonical workflow draft used by canvas mode.
        </p>
      </div>
      <div className="ui-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Triggers ({sharedDraft.triggers.length})</strong>
          <button
            type="button"
            className="ui-button ui-button--sm ui-button--ghost"
            onClick={() => {
              const nextId = createNextWorkflowDraftId("trigger", sharedDraft.triggers.map((entry) => entry.id));
              onUpdateSharedDraft((draft) => ({
                ...draft,
                triggers: [
                  ...draft.triggers,
                  {
                    id: nextId,
                    type: WorkflowDraftTriggerTypes.userManual,
                    kind: WorkflowDraftTriggerKinds.user,
                    config: {},
                  },
                ],
              }));
            }}
          >
            Add trigger
          </button>
        </div>
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Inputs ({sharedDraft.inputs.length})</strong>
          <button
            type="button"
            className="ui-button ui-button--sm ui-button--ghost"
            onClick={() => {
              const nextId = createNextWorkflowDraftId("input", sharedDraft.inputs.map((entry) => entry.id));
              onUpdateSharedDraft((draft) => ({
                ...draft,
                inputs: [
                  ...draft.inputs,
                  {
                    id: nextId,
                    type: WorkflowDraftInputSourceTypes.runtimeParameter,
                    sourceType: WorkflowDraftInputSourceTypes.runtimeParameter,
                    parameterKey: nextId,
                    valueType: WorkflowDraftInputValueTypes.string,
                  },
                ],
              }));
            }}
          >
            Add input
          </button>
        </div>
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Steps ({sharedDraft.steps.length})</strong>
          <button
            type="button"
            className="ui-button ui-button--sm ui-button--ghost"
            onClick={() => {
              const nextId = createNextWorkflowDraftId("step", sharedDraft.steps.map((entry) => entry.id));
              const nextOrder = sharedDraft.steps.reduce((max, step) => Math.max(max, step.order), 0) + 1;
              onUpdateSharedDraft((draft) => ({
                ...draft,
                steps: [
                  ...draft.steps,
                  {
                    id: nextId,
                    type: "action",
                    kind: WorkflowDraftStepKinds.action,
                    order: nextOrder,
                    title: `Step ${nextOrder}`,
                  },
                ],
              }));
            }}
          >
            Add step
          </button>
        </div>
        <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
          <strong>Outputs ({sharedDraft.outputs.length})</strong>
          <button
            type="button"
            className="ui-button ui-button--sm ui-button--ghost"
            onClick={() => {
              const nextId = createNextWorkflowDraftId("output", sharedDraft.outputs.map((entry) => entry.id));
              onUpdateSharedDraft((draft) => ({
                ...draft,
                outputs: [
                  ...draft.outputs,
                  {
                    id: nextId,
                    type: "result",
                    outputType: WorkflowDraftOutputTypes.document,
                    format: WorkflowDraftOutputFormats.json,
                    destination: {
                      type: WorkflowDraftOutputDestinationTypes.webViewer,
                      target: "preview",
                    },
                  },
                ],
              }));
            }}
          >
            Add output
          </button>
        </div>
      </div>
      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Shared canonical workflow draft JSON preview</span>
        <textarea className="ui-textarea" rows={8} value={sharedDraftSerialized} readOnly />
      </label>
    </div>
  );
}
