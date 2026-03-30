import { describe, expect, it } from "bun:test";
import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WorkflowDraftBuiltInStepTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  WorkflowDraftStepKinds,
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import WorkflowStudioModePanel from "../../../components/studio-shell/workflow/WorkflowStudioModePanel";
import WorkflowStudioDraftAuthoringBoundary from "../../../components/studio-shell/workflow/WorkflowStudioDraftAuthoringBoundary";
import { resolveWorkflowStudioModeRoute } from "../WorkflowStudioModeRouting";
import { WorkflowStudioModeStateStore } from "../WorkflowStudioModeStateStore";
import { WorkflowStudioModeIds } from "../WorkflowStudioModes";
import {
  addWorkflowStep,
  buildWorkflowStepTypeDefinitionKey,
  moveWorkflowStepUp,
  removeWorkflowStep,
  setWorkflowStepDelayConfig,
  setWorkflowStepIfThenConfig,
  setWorkflowStepManualApprovalConfig,
  setWorkflowStepAgentAssetSelection,
  setWorkflowStepType,
  workflowStepTypeDefinitions,
} from "../WorkflowWizardSteps";
import { upsertDatasetInputSelection } from "../WorkflowWizardDatasetInputs";
import { addWorkflowOutput, setWorkflowOutputViewerTitle } from "../WorkflowWizardOutputs";

interface ButtonElementProps {
  readonly children?: ReactNode;
  readonly onClick?: () => void;
}

interface TextareaElementProps {
  readonly onChange?: (event: { target: { value: string } }) => void;
}

interface InputElementProps {
  readonly onChange?: (event: { target: { value: string } }) => void;
}

interface SelectElementProps {
  readonly onChange?: (event: { target: { value: string } }) => void;
}

function collectElements(node: ReactNode): ReadonlyArray<ReactElement> {
  const elements: ReactElement[] = [];
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      for (const child of current) {
        stack.push(child);
      }
      continue;
    }

    if (!React.isValidElement(current)) {
      continue;
    }

    elements.push(current);

    const children = React.Children.toArray((current.props as { children?: ReactNode }).children);
    for (const child of children) {
      stack.push(child);
    }
  }

  return elements;
}

function getElementByTestId(root: ReactElement, testId: string): ReactElement {
  const element = collectElements(root).find((entry) => (
    (entry.props as { readonly ["data-testid"]?: string })["data-testid"] === testId
  ));
  if (!element) {
    throw new Error(`Expected element with test id '${testId}' to be present.`);
  }
  return element;
}

function toText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toText(entry)).join("");
  }
  if (React.isValidElement(value)) {
    return toText((value.props as { children?: ReactNode }).children);
  }
  return "";
}

function getButtonByText(root: ReactElement, label: string): ReactElement<ButtonElementProps> {
  const button = collectElements(root).find((entry) => (
    typeof entry.type === "string"
    && entry.type === "button"
    && toText((entry.props as ButtonElementProps).children).trim() === label
  ));
  if (!button) {
    throw new Error(`Expected button '${label}' to be present.`);
  }
  return button as ReactElement<ButtonElementProps>;
}

function getTextarea(root: ReactElement): ReactElement<TextareaElementProps> {
  const textarea = collectElements(root).find((entry) => (
    typeof entry.type === "string" && entry.type === "textarea"
  ));
  if (!textarea) {
    throw new Error("Expected a textarea element to be present.");
  }
  return textarea as ReactElement<TextareaElementProps>;
}

describe("WorkflowStudioModeSystem integration seams", () => {
  it("keeps routing resolution and centralized mode state aligned for default, direct, and invalid mode inputs", () => {
    const store = new WorkflowStudioModeStateStore();
    expect(store.getState().selectedModeId).toBe(WorkflowStudioModeIds.wizard);

    const wizardResolution = resolveWorkflowStudioModeRoute({ routeModeId: "wizard" });
    store.setSelectedMode(wizardResolution.resolvedModeId);
    expect(store.getState().selectedModeId).toBe(WorkflowStudioModeIds.wizard);

    const canvasResolution = resolveWorkflowStudioModeRoute({ routeModeId: "canvas" });
    store.setSelectedMode(canvasResolution.resolvedModeId);
    expect(store.getState().selectedModeId).toBe(WorkflowStudioModeIds.canvas);

    const invalidResolution = resolveWorkflowStudioModeRoute({ routeModeId: "unsupported" });
    store.setSelectedMode(invalidResolution.resolvedModeId);
    expect(store.getState().selectedModeId).toBe(WorkflowStudioModeIds.wizard);
    expect(invalidResolution.invalidModeId).toBe("unsupported");
  });

  it("updates active mode through the mode switch UI while preserving one shared draft across switches", () => {
    const store = new WorkflowStudioModeStateStore();

    let panel = WorkflowStudioModePanel({
      workflowModeState: {
        state: store.getState(),
        setSelectedMode: (modeId) => store.setSelectedMode(modeId),
      },
    });

    const wizardButton = getButtonByText(panel, "Wizard");
    wizardButton.props.onClick?.();
    expect(store.getState().selectedModeId).toBe(WorkflowStudioModeIds.wizard);

    store.updateSharedDraft((draft) => ({
      ...draft,
      steps: [
        ...draft.steps,
        {
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
          title: "Step 1",
        },
      ],
    }));

    panel = WorkflowStudioModePanel({
      workflowModeState: {
        state: store.getState(),
        setSelectedMode: (modeId) => store.setSelectedMode(modeId),
      },
    });

    const canvasButton = getButtonByText(panel, "Canvas");
    canvasButton.props.onClick?.();
    expect(store.getState().selectedModeId).toBe(WorkflowStudioModeIds.canvas);
    expect(store.getState().sharedDraft.steps.map((step) => step.id)).toEqual(["step-1"]);
  });

  it("supports wizard page menu and Back/Next controls for linear page routing", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    let selectedWizardPageId: "trigger" | "inputs" | "steps" | "outputs" = "trigger";

    const renderBoundary = () => WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        selectedModeId: store.getState().selectedModeId,
        selectedWizardPageId,
        onSelectWizardPage: (pageId) => {
          selectedWizardPageId = pageId;
        },
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
      },
    });

    let boundary = renderBoundary();
    expect(renderToStaticMarkup(boundary)).toContain("Trigger Section");

    const nextButton = getElementByTestId(boundary, "workflow-wizard-next-page") as ReactElement<ButtonElementProps>;
    nextButton.props.onClick?.();
    expect(selectedWizardPageId).toBe("inputs");

    boundary = renderBoundary();
    expect(renderToStaticMarkup(boundary)).toContain("Inputs Section");

    const stepsButton = getElementByTestId(boundary, "workflow-wizard-page-button-steps") as ReactElement<ButtonElementProps>;
    stepsButton.props.onClick?.();
    expect(selectedWizardPageId).toBe("steps");

    boundary = renderBoundary();
    expect(renderToStaticMarkup(boundary)).toContain("Steps Section");

    const backButton = getElementByTestId(boundary, "workflow-wizard-back-page") as ReactElement<ButtonElementProps>;
    backButton.props.onClick?.();
    expect(selectedWizardPageId).toBe("inputs");
  });

  it("synchronizes wizard and canvas draft edits through one shared mode state and renders mode-specific layouts", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    store.updateSharedDraft((draft) => ({
      ...draft,
      steps: [
        ...draft.steps,
        {
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
          title: "Step 1",
        },
      ],
    }));

    const wizardBoundary = WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        selectedModeId: store.getState().selectedModeId,
        selectedWizardPageId: "trigger",
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
      },
    });
    expect(store.getState().sharedDraft.steps.map((entry) => entry.id)).toEqual(["step-1"]);
    expect(getElementByTestId(wizardBoundary, "workflow-wizard-page-button-trigger")).toBeDefined();

    const wizardMarkup = renderToStaticMarkup(wizardBoundary);
    expect(wizardMarkup).toContain('data-testid="workflow-studio-wizard-mode-layout"');
    expect(wizardMarkup).toContain('data-testid="workflow-studio-wizard-mode-surface"');
    expect(wizardMarkup).toContain("Trigger Section");
    expect(wizardMarkup).not.toContain("Inputs Section");
    expect(wizardMarkup).not.toContain("Steps Section");
    expect(wizardMarkup).not.toContain("Outputs Section");

    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    const canvasSerialized = serializeWorkflowDraft({
      ...store.getState().sharedDraft,
      outputs: [
        ...store.getState().sharedDraft.outputs,
        {
          id: "output-1",
          type: "result",
          title: "Canvas output",
          outputType: WorkflowDraftOutputTypes.document,
          format: WorkflowDraftOutputFormats.json,
          destination: {
            type: WorkflowDraftOutputDestinationTypes.webViewer,
            target: "preview",
          },
        },
      ],
    });

    const canvasBoundary = WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        selectedModeId: store.getState().selectedModeId,
        selectedWizardPageId: "trigger",
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
      },
    });

    const canvasTextarea = getTextarea(canvasBoundary);
    canvasTextarea.props.onChange?.({ target: { value: canvasSerialized } });
    expect(store.getState().sharedDraft.outputs.map((entry) => entry.id)).toEqual(["output-1"]);

    const canvasMarkup = renderToStaticMarkup(canvasBoundary);
    expect(canvasMarkup).toContain('data-testid="workflow-studio-canvas-mode-layout"');
    expect(canvasMarkup).toContain('data-testid="workflow-studio-canvas-mode-surface"');

    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    expect(store.getState().sharedDraft.steps.map((entry) => entry.id)).toEqual(["step-1"]);
    expect(store.getState().sharedDraft.outputs.map((entry) => entry.id)).toEqual(["output-1"]);
    expect(store.getState().isSharedDraftValid).toBe(true);
  });

  it("keeps shared validation hooks safe for invalid or incomplete draft content during mode transitions", () => {
    const store = new WorkflowStudioModeStateStore();

    const invalidDraft = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      steps: [
        {
          id: "step-2",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 2,
          title: "Non contiguous step",
        },
      ],
    });
    store.hydrateFromSerializedDraft(invalidDraft);
    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    expect(store.getState().isSharedDraftValid).toBe(false);
    expect(store.getState().modeValidationIssues.some((issue) => issue.code === "draft-validation-error")).toBe(true);

    store.hydrateFromSerializedDraft("{ malformed");
    expect(store.getState().hasModeValidationErrors).toBe(true);
    expect(store.getState().modeValidationIssues.some((issue) => issue.code === "draft-parse-error")).toBe(true);
  });

  it("supports multi-trigger add/select/edit/reorder/remove with type-specific config forms", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    const renderBoundary = () => WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        selectedModeId: store.getState().selectedModeId,
        selectedWizardPageId: "trigger",
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
        updateSharedDraft: (updater) => store.updateSharedDraft(updater),
      },
    });

    let boundary = renderBoundary();
    const initialMarkup = renderToStaticMarkup(boundary);
    expect(initialMarkup).toContain("Manual");
    expect(initialMarkup).toContain("Scheduled time");
    expect(initialMarkup).toContain("System event");

    const addTypeSelect = getElementByTestId(boundary, "workflow-trigger-add-type-select") as ReactElement<SelectElementProps>;
    addTypeSelect.props.onChange?.({ target: { value: "manual" } });
    const addTriggerButton = getElementByTestId(boundary, "workflow-trigger-add") as ReactElement<ButtonElementProps>;
    addTriggerButton.props.onClick?.();
    expect(store.getState().sharedDraft.triggers).toHaveLength(1);
    expect(store.getState().sharedDraft.triggers[0]?.kind).toBe("user");
    expect(store.getState().sharedDraft.triggers[0]?.type).toBe("manual");

    boundary = renderBoundary();
    const addSecondTypeSelect = getElementByTestId(boundary, "workflow-trigger-add-type-select") as ReactElement<SelectElementProps>;
    addSecondTypeSelect.props.onChange?.({ target: { value: "recurring" } });
    const addSecondTriggerButton = getElementByTestId(boundary, "workflow-trigger-add") as ReactElement<ButtonElementProps>;
    addSecondTriggerButton.props.onClick?.();
    expect(store.getState().sharedDraft.triggers).toHaveLength(2);
    expect(store.getState().sharedDraft.triggers[1]?.type).toBe("recurring");

    boundary = renderBoundary();
    const selectSecond = getElementByTestId(boundary, "workflow-trigger-select-1") as ReactElement<ButtonElementProps>;
    selectSecond.props.onClick?.();
    const recurringEvery = getElementByTestId(boundary, "workflow-trigger-temporal-every-1") as ReactElement<InputElementProps>;
    recurringEvery.props.onChange?.({ target: { value: "3" } });
    const recurringUnit = getElementByTestId(boundary, "workflow-trigger-temporal-unit-1") as ReactElement<SelectElementProps>;
    recurringUnit.props.onChange?.({ target: { value: "hours" } });
    expect(store.getState().sharedDraft.triggers[1]?.config).toEqual(expect.objectContaining({
      every: 3,
      unit: "hours",
    }));

    boundary = renderBoundary();
    expect(renderToStaticMarkup(boundary)).toContain(
      "Supports continuation semantics for intermediate resume and human-approval handoff flows.",
    );
    const selectFirst = getElementByTestId(boundary, "workflow-trigger-select-0") as ReactElement<ButtonElementProps>;
    selectFirst.props.onClick?.();
    const userScopeSelect = getElementByTestId(boundary, "workflow-trigger-user-scope-0") as ReactElement<SelectElementProps>;
    userScopeSelect.props.onChange?.({ target: { value: "workflow-continuation" } });
    const continuationStep = getElementByTestId(boundary, "workflow-trigger-user-continuation-step-0") as ReactElement<InputElementProps>;
    continuationStep.props.onChange?.({ target: { value: "missing-step-id" } });
    expect(store.getState().isSharedDraftValid).toBe(false);

    boundary = renderBoundary();
    const validationMarkup = renderToStaticMarkup(boundary);
    expect(validationMarkup).toContain("references unknown continuationStepId");

    boundary = renderBoundary();
    const triggerTypeSelect = getElementByTestId(boundary, "workflow-trigger-type-0") as ReactElement<SelectElementProps>;
    triggerTypeSelect.props.onChange?.({ target: { value: "schedule" } });
    expect(store.getState().sharedDraft.triggers[0]?.kind).toBe("temporal");
    expect(store.getState().sharedDraft.triggers[0]?.type).toBe("schedule");

    boundary = renderBoundary();
    const temporalCronInput = getElementByTestId(boundary, "workflow-trigger-temporal-cron-0") as ReactElement<InputElementProps>;
    temporalCronInput.props.onChange?.({ target: { value: "15 14 * * *" } });
    expect(store.getState().sharedDraft.triggers[0]?.config).toEqual(expect.objectContaining({
      cronExpression: "15 14 * * *",
    }));

    boundary = renderBoundary();
    const stateTypeSelect = getElementByTestId(boundary, "workflow-trigger-type-0") as ReactElement<SelectElementProps>;
    stateTypeSelect.props.onChange?.({ target: { value: "system-event" } });
    expect(store.getState().sharedDraft.triggers[0]?.kind).toBe("state");
    expect(store.getState().sharedDraft.triggers[0]?.type).toBe("system-event");

    boundary = renderBoundary();
    const stateEventNameInput = getElementByTestId(boundary, "workflow-trigger-state-event-name-0") as ReactElement<InputElementProps>;
    stateEventNameInput.props.onChange?.({ target: { value: "new-data-ready" } });
    const stateKeyInput = getElementByTestId(boundary, "workflow-trigger-state-key-0") as ReactElement<InputElementProps>;
    stateKeyInput.props.onChange?.({ target: { value: "source-alpha" } });
    expect(store.getState().sharedDraft.triggers[0]?.config).toEqual(expect.objectContaining({
      eventName: "new-data-ready",
      stateKey: "source-alpha",
    }));

    boundary = renderBoundary();
    const moveDownFirst = getElementByTestId(boundary, "workflow-trigger-move-down-0") as ReactElement<ButtonElementProps>;
    moveDownFirst.props.onClick?.();
    expect(store.getState().sharedDraft.triggers[1]?.type).toBe("system-event");

    const baselineSerialized = store.getState().sharedDraftSerialized;
    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    expect(store.getState().sharedDraftSerialized).toBe(baselineSerialized);
    expect(store.getState().sharedDraft.triggers).toHaveLength(2);

    boundary = renderBoundary();
    const removeSecondButton = getElementByTestId(boundary, "workflow-trigger-remove-1") as ReactElement<ButtonElementProps>;
    removeSecondButton.props.onClick?.();
    expect(store.getState().sharedDraft.triggers).toHaveLength(1);
    boundary = renderBoundary();
    const removeFirstButton = getElementByTestId(boundary, "workflow-trigger-remove-0") as ReactElement<ButtonElementProps>;
    removeFirstButton.props.onClick?.();
    expect(store.getState().sharedDraft.triggers).toHaveLength(0);
  });

  it("exposes dataset inline creation handoff launch from wizard inputs", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    const boundary = WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        studioId: "studio-workflows",
        selectedModeId: store.getState().selectedModeId,
        selectedWizardPageId: "inputs",
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
        updateSharedDraft: (updater) => store.updateSharedDraft(updater),
      },
    });

    const createLink = getElementByTestId(boundary, "workflow-input-create-dataset-link") as ReactElement<{ readonly href?: string }>;
    expect(createLink.props.href).toContain("/studio-shell/dataset?");
    expect(createLink.props.href).toContain("entryMode=new");
    expect(createLink.props.href).toContain("inlineCreate=1");
    expect(createLink.props.href).toContain("returnTo=%2Fstudio-shell%2Fworkflow%2Fwizard");
  });

  it("preserves wizard step ordering and step-level asset selection across mode switching", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    store.updateSharedDraft((draft) => addWorkflowStep(draft).draft);
    store.updateSharedDraft((draft) => addWorkflowStep(draft).draft);
    store.updateSharedDraft((draft) => addWorkflowStep(draft).draft);
    const thirdStepId = store.getState().sharedDraft.steps[2]?.id as string;
    const secondStepId = store.getState().sharedDraft.steps[1]?.id as string;

    store.updateSharedDraft((draft) => moveWorkflowStepUp(draft, thirdStepId).draft);
    store.updateSharedDraft((draft) => setWorkflowStepAgentAssetSelection(draft, secondStepId, {
      assetId: "asset:agent-selected",
      versionId: "asset:agent-selected:v1",
      name: "Selected Agent",
    }).draft);
    const firstStepId = store.getState().sharedDraft.steps[0]?.id as string;
    const ifThenDefinition = workflowStepTypeDefinitions.find((definition) => definition.type === WorkflowDraftBuiltInStepTypes.ifThen);
    const delayDefinition = workflowStepTypeDefinitions.find((definition) => definition.type === WorkflowDraftBuiltInStepTypes.delayWait);
    if (!ifThenDefinition || !delayDefinition) {
      throw new Error("Expected built-in workflow step type definitions to be present.");
    }
    store.updateSharedDraft((draft) => setWorkflowStepType(
      draft,
      firstStepId,
      buildWorkflowStepTypeDefinitionKey(ifThenDefinition),
    ).draft);
    store.updateSharedDraft((draft) => setWorkflowStepIfThenConfig(draft, firstStepId, {
      conditionExpression: "score > 0.5",
      thenLabel: "approve",
    }).draft);
    store.updateSharedDraft((draft) => setWorkflowStepType(
      draft,
      firstStepId,
      buildWorkflowStepTypeDefinitionKey(delayDefinition),
    ).draft);
    store.updateSharedDraft((draft) => setWorkflowStepDelayConfig(draft, firstStepId, {
      durationSeconds: 20,
    }).draft);

    expect(store.getState().sharedDraft.steps.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(store.getState().sharedDraft.steps.find((step) => step.id === secondStepId)?.assetRef?.asset.assetId).toBe("asset:agent-selected");
    expect(store.getState().sharedDraft.steps.find((step) => step.id === firstStepId)?.type).toBe(WorkflowDraftBuiltInStepTypes.delayWait);

    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    expect(store.getState().sharedDraft.steps.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(store.getState().sharedDraft.steps.find((step) => step.id === secondStepId)?.assetRef?.asset.assetId).toBe("asset:agent-selected");
    expect(store.getState().sharedDraft.steps.find((step) => step.id === firstStepId)?.type).toBe(WorkflowDraftBuiltInStepTypes.delayWait);
    expect((store.getState().sharedDraft.steps.find((step) => step.id === firstStepId)?.config as { durationSeconds?: number })?.durationSeconds).toBe(20);

    store.updateSharedDraft((draft) => removeWorkflowStep(draft, secondStepId).draft);
    expect(store.getState().sharedDraft.steps.map((step) => step.order)).toEqual([1, 2]);
  });

  it("renders mixed asset-backed and built-in step choices and surfaces built-in validation feedback", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    const renderBoundary = () => WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        selectedModeId: store.getState().selectedModeId,
        selectedWizardPageId: "steps",
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
        updateSharedDraft: (updater) => store.updateSharedDraft(updater),
      },
    });

    let boundary = renderBoundary();
    const initialMarkup = renderToStaticMarkup(boundary);
    expect(initialMarkup).toContain("Agent/assistant action");
    expect(initialMarkup).toContain("Manual / Approval");

    const addManual = getElementByTestId(
      boundary,
      "workflow-step-add-built-in:control-flow:manual-approval",
    ) as ReactElement<ButtonElementProps>;
    addManual.props.onClick?.();
    expect(store.getState().sharedDraft.steps[0]?.type).toBe(WorkflowDraftBuiltInStepTypes.manualApproval);

    store.updateSharedDraft((draft) => setWorkflowStepManualApprovalConfig(
      draft,
      store.getState().sharedDraft.steps[0]?.id as string,
      { prompt: "" },
    ).draft);
    expect(store.getState().isSharedDraftValid).toBe(false);

    boundary = renderBoundary();
    const withManualMarkup = renderToStaticMarkup(boundary);
    expect(withManualMarkup).toContain('data-testid="workflow-step-manual-config-0"');
    expect(withManualMarkup).toContain("requires config.prompt or legacy approvalMessage");
  });

  it("supports wizard output add/remove/type/configuration with clean type switching and shared mode persistence", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    const renderBoundary = () => WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        selectedModeId: store.getState().selectedModeId,
        selectedWizardPageId: "outputs",
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
        updateSharedDraft: (updater) => store.updateSharedDraft(updater),
      },
    });

    let boundary = renderBoundary();
    const addAllOutputs = getElementByTestId(boundary, "workflow-output-selector-add-all") as ReactElement<ButtonElementProps>;
    addAllOutputs.props.onClick?.();

    expect(store.getState().sharedDraft.outputs).toHaveLength(4);
    expect(store.getState().sharedDraft.outputs.map((output) => output.destination.type)).toEqual([
      WorkflowDraftOutputDestinationTypes.fileExport,
      WorkflowDraftOutputDestinationTypes.webViewer,
      WorkflowDraftOutputDestinationTypes.systemEntry,
      WorkflowDraftOutputDestinationTypes.promptResponseChat,
    ]);
    expect(store.getState().isSharedDraftValid).toBe(false);

    boundary = renderBoundary();
    const selectViewerOutput = getElementByTestId(boundary, "workflow-output-select-1") as ReactElement<ButtonElementProps>;
    selectViewerOutput.props.onClick?.();
    boundary = renderBoundary();
    const viewerTitle = getElementByTestId(boundary, "workflow-output-viewer-title-1") as ReactElement<InputElementProps>;
    viewerTitle.props.onChange?.({ target: { value: "Results Viewer" } });
    expect(store.getState().isSharedDraftValid).toBe(false);

    boundary = renderBoundary();
    const selectSystemOutput = getElementByTestId(boundary, "workflow-output-select-2") as ReactElement<ButtonElementProps>;
    selectSystemOutput.props.onClick?.();
    boundary = renderBoundary();
    const systemEntity = getElementByTestId(boundary, "workflow-output-system-entity-2") as ReactElement<InputElementProps>;
    systemEntity.props.onChange?.({ target: { value: "customer-record" } });
    const systemConfig = getElementByTestId(boundary, "workflow-output-system-config-value-2") as ReactElement<InputElementProps>;
    systemConfig.props.onChange?.({ target: { value: "connection:warehouse" } });
    expect(store.getState().isSharedDraftValid).toBe(false);

    boundary = renderBoundary();
    const selectChatOutput = getElementByTestId(boundary, "workflow-output-select-3") as ReactElement<ButtonElementProps>;
    selectChatOutput.props.onClick?.();
    boundary = renderBoundary();
    const chatTitle = getElementByTestId(boundary, "workflow-output-viewer-title-3") as ReactElement<InputElementProps>;
    chatTitle.props.onChange?.({ target: { value: "Conversation Result" } });
    const chatPromptInput = getElementByTestId(boundary, "workflow-output-chat-prompt-input-3") as ReactElement<InputElementProps>;
    chatPromptInput.props.onChange?.({ target: { value: "input-user-prompt" } });
    const chatResponseField = getElementByTestId(boundary, "workflow-output-chat-response-field-3") as ReactElement<InputElementProps>;
    chatResponseField.props.onChange?.({ target: { value: "assistant-response" } });
    const chatScope = getElementByTestId(boundary, "workflow-output-chat-scope-3") as ReactElement<SelectElementProps>;
    chatScope.props.onChange?.({ target: { value: "continue-session" } });
    expect(store.getState().isSharedDraftValid).toBe(false);

    store.updateSharedDraft((draft) => ({
      ...draft,
      inputs: [
        ...draft.inputs,
        {
          id: "input-user-prompt",
          type: "runtime-parameter",
          sourceType: "runtime-parameter",
          parameterKey: "userPrompt",
          valueType: "string",
        },
      ],
    }));
    expect(store.getState().isSharedDraftValid).toBe(true);

    boundary = renderBoundary();
    const firstTypeSelect = getElementByTestId(boundary, "workflow-output-type-select-0") as ReactElement<SelectElementProps>;
    firstTypeSelect.props.onChange?.({ target: { value: WorkflowDraftOutputDestinationTypes.systemEntry } });
    expect(store.getState().sharedDraft.outputs[0]?.destination.type).toBe(WorkflowDraftOutputDestinationTypes.systemEntry);
    expect(store.getState().sharedDraft.outputs[0]?.destination.options).toEqual(expect.objectContaining({
      entityName: "",
      destinationConfig: "",
    }));
    expect(store.getState().isSharedDraftValid).toBe(false);

    boundary = renderBoundary();
    const firstEntity = getElementByTestId(boundary, "workflow-output-system-entity-0") as ReactElement<InputElementProps>;
    firstEntity.props.onChange?.({ target: { value: "file-output-record" } });
    expect(store.getState().isSharedDraftValid).toBe(true);

    boundary = renderBoundary();
    const moveThirdUp = getElementByTestId(boundary, "workflow-output-move-up-2") as ReactElement<ButtonElementProps>;
    moveThirdUp.props.onClick?.();
    expect(store.getState().sharedDraft.outputs.map((output) => output.order)).toEqual([1, 2, 3, 4]);

    boundary = renderBoundary();
    const removeSecond = getElementByTestId(boundary, "workflow-output-remove-1") as ReactElement<ButtonElementProps>;
    removeSecond.props.onClick?.();
    expect(store.getState().sharedDraft.outputs).toHaveLength(3);

    const baselineSerialized = store.getState().sharedDraftSerialized;
    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    expect(store.getState().sharedDraftSerialized).toBe(baselineSerialized);
    expect(store.getState().sharedDraft.outputs).toHaveLength(3);
  });

  it("renders wizard progression controls and terminal readiness actions from shared draft completeness", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    store.updateSharedDraft((draft) => ({
      ...draft,
      triggers: [
        ...draft.triggers,
        {
          id: "trigger-1",
          kind: "user",
          type: "manual",
          config: {},
        },
      ],
    }));
    store.updateSharedDraft((draft) => upsertDatasetInputSelection(draft, { assetId: "asset:dataset-1" }).draft);
    store.updateSharedDraft((draft) => addWorkflowStep(draft).draft);
    store.updateSharedDraft((draft) => addWorkflowOutput(draft, WorkflowDraftOutputDestinationTypes.webViewer).draft);
    const outputId = store.getState().sharedDraft.outputs[0]?.id as string;
    store.updateSharedDraft((draft) => setWorkflowOutputViewerTitle(draft, outputId, "Result viewer").draft);

    const wizardBoundary = WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        selectedModeId: store.getState().selectedModeId,
        selectedWizardPageId: "outputs",
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
      },
    });

    const markup = renderToStaticMarkup(wizardBoundary);
    expect(markup).toContain('data-testid="workflow-wizard-readiness-summary"');
    expect(markup).toContain('data-testid="workflow-wizard-progression-controls"');
    expect(markup).toContain('data-testid="workflow-wizard-back-page"');
    expect(markup).toContain('data-testid="workflow-wizard-next-page"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('data-testid="workflow-wizard-terminal-actions"');
    expect(markup).toContain("Ready for next-stage handoff. Save the draft and continue to lifecycle/publish controls.");
    expect(markup).toContain("Prepare for Run");
  });
});

