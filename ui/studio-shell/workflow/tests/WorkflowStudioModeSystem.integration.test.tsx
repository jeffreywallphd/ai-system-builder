import { describe, expect, it } from "bun:test";
import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
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

function getAnchorByText(root: ReactElement, label: string): ReactElement<{ readonly href?: string }> {
  const anchor = collectElements(root).find((entry) => (
    typeof entry.type === "string"
    && entry.type === "a"
    && toText((entry.props as { children?: ReactNode }).children).trim() === label
  ));
  if (!anchor) {
    throw new Error(`Expected anchor '${label}' to be present.`);
  }
  return anchor as ReactElement<{ readonly href?: string }>;
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
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
      },
    });
    expect(store.getState().sharedDraft.steps.map((entry) => entry.id)).toEqual(["step-1"]);
    expect(getAnchorByText(wizardBoundary, "Trigger").props.href).toBe("#workflow-wizard-trigger");

    const wizardMarkup = renderToStaticMarkup(wizardBoundary);
    expect(wizardMarkup).toContain('data-testid="workflow-studio-wizard-mode-layout"');
    expect(wizardMarkup).toContain('data-testid="workflow-studio-wizard-mode-surface"');
    expect(wizardMarkup).toContain("Trigger Section");
    expect(wizardMarkup).toContain("Inputs Section");
    expect(wizardMarkup).toContain("Steps Section");
    expect(wizardMarkup).toContain("Outputs Section");

    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    const canvasSerialized = serializeWorkflowDraft({
      ...store.getState().sharedDraft,
      outputs: [
        ...store.getState().sharedDraft.outputs,
        {
          id: "output-1",
          type: "result",
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

  it("supports wizard trigger add/remove/configuration while persisting through shared draft state", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setSelectedMode(WorkflowStudioModeIds.wizard);

    const renderBoundary = () => WorkflowStudioDraftAuthoringBoundary({
      isWorkflowStudio: true,
      content: store.getState().sharedDraftSerialized,
      onChangeContent: (nextContent) => store.hydrateFromSerializedDraft(nextContent),
      workflowModeContext: {
        selectedModeId: store.getState().selectedModeId,
        sharedDraft: store.getState().sharedDraft,
        sharedDraftSerialized: store.getState().sharedDraftSerialized,
        draftEditorContent: store.getState().draftEditorContent,
        modeValidationIssues: store.getState().modeValidationIssues,
        draftValidationIssues: store.getState().draftValidationIssues,
        updateSharedDraft: (updater) => store.updateSharedDraft(updater),
      },
    });

    let boundary = renderBoundary();
    const addManualButton = getElementByTestId(boundary, "workflow-trigger-add-manual") as ReactElement<ButtonElementProps>;
    addManualButton.props.onClick?.();
    expect(store.getState().sharedDraft.triggers).toHaveLength(1);
    expect(store.getState().sharedDraft.triggers[0]?.kind).toBe("user");
    expect(store.getState().sharedDraft.triggers[0]?.type).toBe("manual");

    boundary = renderBoundary();
    const triggerTypeSelect = getElementByTestId(boundary, "workflow-trigger-type-0") as ReactElement<SelectElementProps>;
    triggerTypeSelect.props.onChange?.({ target: { value: "temporal" } });
    expect(store.getState().sharedDraft.triggers[0]?.kind).toBe("temporal");

    boundary = renderBoundary();
    const temporalTimeInput = getElementByTestId(boundary, "workflow-trigger-temporal-time-0") as ReactElement<InputElementProps>;
    temporalTimeInput.props.onChange?.({ target: { value: "" } });
    expect(store.getState().isSharedDraftValid).toBe(false);

    boundary = renderBoundary();
    expect(renderToStaticMarkup(boundary)).toContain("Temporal trigger requires a valid time of day.");
    temporalTimeInput.props.onChange?.({ target: { value: "14:30" } });
    expect(store.getState().isSharedDraftValid).toBe(true);

    boundary = renderBoundary();
    const stateTypeSelect = getElementByTestId(boundary, "workflow-trigger-type-0") as ReactElement<SelectElementProps>;
    stateTypeSelect.props.onChange?.({ target: { value: "state" } });
    expect(store.getState().sharedDraft.triggers[0]?.kind).toBe("state");

    boundary = renderBoundary();
    const stateEventNameInput = getElementByTestId(boundary, "workflow-trigger-state-event-name-0") as ReactElement<InputElementProps>;
    stateEventNameInput.props.onChange?.({ target: { value: "" } });
    expect(store.getState().isSharedDraftValid).toBe(false);

    boundary = renderBoundary();
    stateEventNameInput.props.onChange?.({ target: { value: "new-data" } });
    const stateSourceInput = getElementByTestId(boundary, "workflow-trigger-state-source-0") as ReactElement<InputElementProps>;
    stateSourceInput.props.onChange?.({ target: { value: "source-alpha" } });
    expect(store.getState().isSharedDraftValid).toBe(true);
    expect(store.getState().sharedDraft.triggers[0]?.config).toEqual(expect.objectContaining({
      eventName: "new-data",
      stateKey: "source-alpha",
    }));

    const baselineSerialized = store.getState().sharedDraftSerialized;
    store.setSelectedMode(WorkflowStudioModeIds.canvas);
    store.setSelectedMode(WorkflowStudioModeIds.wizard);
    expect(store.getState().sharedDraftSerialized).toBe(baselineSerialized);

    boundary = renderBoundary();
    const removeButton = getElementByTestId(boundary, "workflow-trigger-remove-0") as ReactElement<ButtonElementProps>;
    removeButton.props.onClick?.();
    expect(store.getState().sharedDraft.triggers).toHaveLength(0);
  });
});

