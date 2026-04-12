import { describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import {
  createUiTriggerEvent,
  UiTriggerEventKinds,
} from "@application/workflow-studio/UiTriggerEventContract";
import { WorkflowUiEventRuntimeDispatcher } from "@application/workflow-studio/WorkflowUiEventRuntimeDispatcher";
import {
  createWorkflowUiTriggerDispatchAdapter,
  createWorkflowUiTriggerEvent,
} from "../image-system/WorkflowUiTriggerComponents";

describe("WorkflowUiTriggerComponents", () => {
  it("creates declarative workflow trigger events for click, submit, and image selection interactions", () => {
    const buttonEvent = createWorkflowUiTriggerEvent({
      kind: UiTriggerEventKinds.click,
      eventName: "ui.workflow.trigger.button",
      source: {
        studio: "system-studio",
        componentId: "workflow-trigger-button",
        actionId: "run-workflow",
      },
      payload: {
        action: "run",
      },
    });
    const submitEvent = createWorkflowUiTriggerEvent({
      kind: UiTriggerEventKinds.submit,
      eventName: "ui.workflow.trigger.submit",
      source: {
        studio: "system-studio",
        componentId: "workflow-parameter-submit",
        actionId: "submit",
      },
      payload: {
        values: {
          prompt: "cinematic portrait",
        },
      },
    });
    const selectionEvent = createUiTriggerEvent({
      kind: UiTriggerEventKinds.selection,
      name: "ui.workflow.trigger.image-selection",
      source: {
        studio: "system-studio",
        componentId: "image-selection-surface",
        actionId: "select-image",
      },
      payload: {
        imageId: "asset:image-1",
        selectedIds: ["asset:image-1"],
      },
    });

    expect(buttonEvent.kind).toBe("click");
    expect(buttonEvent.source.actionId).toBe("run-workflow");
    expect((submitEvent.payload.values as Record<string, unknown>).prompt).toBe("cinematic portrait");
    expect(selectionEvent.kind).toBe("selection");
    expect(selectionEvent.name).toBe("ui.workflow.trigger.image-selection");
  });

  it("dispatches normalized UI trigger events through the existing dispatcher pipeline via adapter wrapper", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const dispatcher = new WorkflowUiEventRuntimeDispatcher({
      runWorkflowDraftTriggered: async (command) => {
        calls.push(command as unknown as Record<string, unknown>);
        return Object.freeze({
          launchStatus: "launched",
          validation: {
            ready: true,
            issues: Object.freeze([]),
            blockingIssues: Object.freeze([]),
            warningIssues: Object.freeze([]),
            authoredValidation: { stage: "authored-validation", ready: true, blockingIssueCount: 0, warningIssueCount: 0 },
            preExecutionValidation: { stage: "pre-execution-validation", ready: true, blockingIssueCount: 0, warningIssueCount: 0 },
            translationValidation: { stage: "translation", ready: true, blockingIssueCount: 0, warningIssueCount: 0 },
            plan: undefined,
          },
          executionStatus: {
            executionId: "exec-ui-trigger",
            state: "completed",
            launchAccepted: true,
            transitions: Object.freeze([]),
          },
        });
      },
    });

    const dispatchAdapter = createWorkflowUiTriggerDispatchAdapter({
      dispatcher,
      configuration: {
        content: serializeWorkflowDraft({
          ...createEmptyWorkflowDraft(),
          triggers: [{
            id: "trigger-1",
            kind: WorkflowDraftTriggerKinds.user,
            type: WorkflowDraftTriggerTypes.userManual,
            config: {},
          }],
        }),
      },
    });

    await dispatchAdapter.dispatch(createWorkflowUiTriggerEvent({
      kind: UiTriggerEventKinds.click,
      eventName: "ui.workflow.trigger.button",
      source: {
        studio: "system-studio",
        componentId: "workflow-trigger-button",
        actionId: "run-workflow",
      },
      payload: {
        values: {
          instruction: "enhance image",
        },
      },
    }));

    expect(calls).toHaveLength(1);
    const context = calls[0]?.context as Record<string, unknown>;
    expect(((context.metadata as Record<string, unknown>).systemFormValues as Record<string, unknown>).instruction).toBe("enhance image");
  });
});

