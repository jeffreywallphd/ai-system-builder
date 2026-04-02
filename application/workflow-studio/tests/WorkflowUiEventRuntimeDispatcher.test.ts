import { describe, expect, it } from "bun:test";
import {
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { createImageWorkflowUiTriggerBindingConfiguration } from "../../contracts/ImageWorkflowUiTriggerBindingConfiguration";
import { createUiTriggerEvent, UiTriggerEventKinds } from "../UiTriggerEventContract";
import { WorkflowUiInteractionIssueCodes } from "../WorkflowUiInteractionContracts";
import { WorkflowUiEventRuntimeDispatcher } from "../WorkflowUiEventRuntimeDispatcher";

describe("WorkflowUiEventRuntimeDispatcher", () => {
  it("dispatches normalized UI submit events to the workflow trigger runtime asynchronously", async () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-submit",
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userInitiatedRun,
        config: {},
      }],
    };
    const content = serializeWorkflowDraft(draft);

    const bindings = createImageWorkflowUiTriggerBindingConfiguration({
      bindings: [{
        bindingId: "binding.ui.parameter.submit",
        event: {
          kind: UiTriggerEventKinds.submit,
          sourceComponentId: "parameter-form",
          actionId: "submit",
          eventName: "ui.image.parameter.submit",
        },
        target: { triggerId: "trigger-submit" },
      }],
    });

    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.submit,
      name: "ui.image.parameter.submit",
      source: {
        studio: "system-studio",
        componentId: "parameter-form",
        actionId: "submit",
      },
      payload: {
        values: {
          instruction: "repair scratches",
        },
      },
      context: {
        datasetAssetId: "dataset:images",
        datasetVersionId: "v5",
        systemAssetId: "system:image-pipeline",
        references: {
          datasetInstanceId: "dataset-instance:active",
          systemDatasetInstanceId: "dataset-instance:system",
          systemDatasetRole: "output-image-store",
          runtimeSessionId: "runtime-session:abc",
        },
      },
    });

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
            executionId: "exec-1",
            state: "completed",
            launchAccepted: true,
            transitions: Object.freeze([]),
          },
        });
      },
    });

    const result = await dispatcher.dispatch({ content, event, bindings });
    expect(calls).toHaveLength(1);
    expect(result.issues).toEqual([]);
    expect(result.dispatched).toEqual([
      expect.objectContaining({
        triggerId: "trigger-submit",
        launchStatus: "launched",
      }),
    ]);

    const firstContext = calls[0]?.context as Record<string, unknown>;
    expect((firstContext.inputValues as Record<string, unknown>).instruction).toBe("repair scratches");
    expect(((firstContext.metadata as Record<string, unknown>).systemFormValues as Record<string, unknown>).instruction).toBe("repair scratches");
    expect((((firstContext.metadata as Record<string, unknown>).datasetInstances as Array<Record<string, unknown>>)[0] as Record<string, unknown>).datasetAssetId).toBe("dataset:images");
    expect((((firstContext.metadata as Record<string, unknown>).systemDatasetInstanceRefs as Array<Record<string, unknown>>)[0] as Record<string, unknown>).instanceId)
      .toBe("dataset-instance:system");
    expect((((firstContext.metadata as Record<string, unknown>).runtimeContext as Record<string, unknown>).runtimeSessionId)).toBe("runtime-session:abc");
    const firstTrigger = calls[0]?.trigger as Record<string, unknown>;
    const triggerPayload = firstTrigger.payload as Record<string, unknown>;
    expect((triggerPayload.systemContextSummary as Record<string, unknown>).datasetReferenceCount).toBe(2);
    expect((((triggerPayload.systemContext as Record<string, unknown>).runtime as Record<string, unknown>).runtimeSessionId)).toBe("runtime-session:abc");
  });

  it("returns a structured no-match issue when no workflow trigger binding resolves", async () => {
    const content = serializeWorkflowDraft({
      ...createEmptyWorkflowDraft(),
      triggers: [],
    });

    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.click,
      name: "ui.image.gallery.open",
      source: {
        studio: "system-studio",
        componentId: "output-gallery",
        actionId: "open-image",
      },
      payload: {
        imageId: "img-1",
      },
    });

    const dispatcher = new WorkflowUiEventRuntimeDispatcher({
      runWorkflowDraftTriggered: async () => {
        throw new Error("should not run");
      },
    });

    const result = await dispatcher.dispatch({ content, event });
    expect(result.dispatched).toHaveLength(0);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: WorkflowUiInteractionIssueCodes.missingOrInvalidBinding,
        category: "binding",
      }),
    ]);
  });

  it("surfaces blocking validation codes for inspectable invalid UI parameter payloads", async () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-submit",
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userInitiatedRun,
        config: {},
      }],
    };
    const content = serializeWorkflowDraft(draft);

    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.submit,
      name: "ui.image.parameter.submit",
      source: {
        studio: "system-studio",
        componentId: "parameter-form",
        actionId: "submit",
      },
      payload: {
        values: {
          instruction: 42,
        },
      },
    });

    const dispatcher = new WorkflowUiEventRuntimeDispatcher({
      runWorkflowDraftTriggered: async () => Object.freeze({
        launchStatus: "blocked",
        validation: {
          ready: false,
          issues: Object.freeze([]),
          blockingIssues: Object.freeze([
            Object.freeze({ code: "unresolved-required-input", message: "missing", path: "x", stage: "pre-execution", severity: "error", category: "input-binding", blocking: true }),
          ]),
          warningIssues: Object.freeze([]),
          authoredValidation: { stage: "authored-validation", ready: true, blockingIssueCount: 0, warningIssueCount: 0 },
          preExecutionValidation: { stage: "pre-execution-validation", ready: false, blockingIssueCount: 1, warningIssueCount: 0 },
          translationValidation: { stage: "translation", ready: false, blockingIssueCount: 1, warningIssueCount: 0 },
          plan: undefined,
        },
        executionStatus: {
          executionId: "exec-invalid",
          state: "failed",
          launchAccepted: false,
          transitions: Object.freeze([]),
          failure: {
            kind: "validation-failure",
            code: "unresolved-required-input",
            message: "missing",
            stage: "validation",
          },
        },
      }),
    });

    const result = await dispatcher.dispatch({ content, event });
    expect(result.dispatched[0]).toEqual(expect.objectContaining({
      launchStatus: "blocked",
      blockingIssueCodes: ["unresolved-required-input"],
    }));
  });

  it("emits normalized feedback statuses/issues and trace lifecycle entries for dispatch failures", async () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-submit",
        kind: WorkflowDraftTriggerKinds.user,
        type: WorkflowDraftTriggerTypes.userInitiatedRun,
        config: {},
      }],
    };
    const content = serializeWorkflowDraft(draft);
    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.submit,
      name: "ui.image.parameter.submit",
      source: {
        studio: "system-studio",
        componentId: "parameter-form",
      },
      payload: {
        values: {
          instruction: "repair",
        },
      },
    });

    const statuses: string[] = [];
    const issues: string[] = [];
    const traces: Array<Record<string, unknown>> = [];
    const dispatcher = new WorkflowUiEventRuntimeDispatcher({
      runWorkflowDraftTriggered: async () => {
        throw new Error("runtime launch exploded");
      },
    }, {
      record: (entry) => {
        traces.push(entry as unknown as Record<string, unknown>);
      },
    });

    const result = await dispatcher.dispatch({
      content,
      event,
      feedback: {
        onStatus: (update) => statuses.push(update.status),
        onIssue: (issue) => issues.push(issue.code),
      },
    });

    expect(result.dispatched).toHaveLength(0);
    expect(result.issues[0]?.code).toBe(WorkflowUiInteractionIssueCodes.dispatchFailure);
    expect(statuses).toContain("received");
    expect(statuses).toContain("dispatching");
    expect(statuses).toContain("launch-failed");
    expect(issues).toContain(WorkflowUiInteractionIssueCodes.dispatchFailure);
    const traceStages = traces.map((entry) => entry.stage);
    expect(traceStages).toContain("received");
    expect(traceStages).toContain("dispatch-started");
    expect(traceStages).toContain("dispatch-failed");
  });
});
