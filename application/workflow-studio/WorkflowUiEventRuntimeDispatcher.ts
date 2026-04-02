import { deserializeWorkflowDraft, type WorkflowDraft } from "../../domain/workflow-studio/WorkflowStudioDomain";
import type { ImageWorkflowUiTriggerBindingConfiguration } from "../contracts/ImageWorkflowUiTriggerBindingConfiguration";
import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type {
  RunWorkflowDraftManualResult,
  RunWorkflowDraftTriggeredCommand,
  WorkflowStudioApplicationService,
} from "./WorkflowStudioApplicationService";
import type { UiTriggerEvent } from "./UiTriggerEventContract";
import {
  WorkflowUiInteractionIssueCodes,
  WorkflowUiInteractionStatusKinds,
  type WorkflowUiInteractionDispatchRecord,
  type WorkflowUiInteractionFeedbackSink,
  type WorkflowUiInteractionIssue,
} from "./WorkflowUiInteractionContracts";
import {
  WorkflowUiEventTraceStages,
  createWorkflowUiEventTraceId,
  mapDispatchRecordToTraceIssue,
  summarizeUiEventPayload,
  type WorkflowUiEventTraceSink,
} from "./WorkflowUiEventTrace";
import { mapUiTriggerEventToWorkflowTriggerEntries } from "./WorkflowUiTriggerEventAdapter";

interface UiEventDispatchRunner {
  readonly runWorkflowDraftTriggered: (
    command: RunWorkflowDraftTriggeredCommand,
  ) => Promise<RunWorkflowDraftManualResult>;
}

export interface DispatchWorkflowFromUiEventCommand {
  readonly content: string;
  readonly event: UiTriggerEvent;
  readonly bindings?: ImageWorkflowUiTriggerBindingConfiguration;
  readonly request?: WorkflowExecutionPlanTranslationRequest["request"];
  readonly context?: WorkflowExecutionPlanTranslationRequest["context"];
  readonly inputs?: Readonly<Record<string, unknown>>;
  readonly manualDecisionsByStepId?: RunWorkflowDraftTriggeredCommand["manualDecisionsByStepId"];
  readonly maxLoopIterations?: number;
  readonly feedback?: WorkflowUiInteractionFeedbackSink;
}

export interface WorkflowUiEventDispatchIssue {
  readonly code: WorkflowUiInteractionIssue["code"];
  readonly message: string;
  readonly category: WorkflowUiInteractionIssue["category"];
  readonly stage: WorkflowUiInteractionIssue["stage"];
  readonly detail?: Readonly<Record<string, unknown>>;
}

export type WorkflowUiEventDispatchRecord = WorkflowUiInteractionDispatchRecord;

export interface DispatchWorkflowFromUiEventResult {
  readonly dispatched: ReadonlyArray<WorkflowUiEventDispatchRecord>;
  readonly issues: ReadonlyArray<WorkflowUiEventDispatchIssue>;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function toRuntimeParameters(payload: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const runtime = asRecord(payload.parameters);
  if (runtime) {
    return Object.freeze({ ...runtime });
  }

  const values = asRecord(payload.values);
  const merged: Record<string, unknown> = {
    ...(values ?? {}),
  };

  for (const [key, value] of Object.entries(payload)) {
    if (key === "values" || key === "parameters") {
      continue;
    }
    merged[key] = value;
  }

  return Object.freeze(merged);
}

function toSelectedImage(payload: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  const explicit = asRecord(payload.selectedImage);
  if (explicit) {
    return Object.freeze({ ...explicit });
  }

  const imageId = typeof payload.imageId === "string" && payload.imageId.trim().length > 0
    ? payload.imageId.trim()
    : undefined;
  if (!imageId) {
    return undefined;
  }

  return Object.freeze({
    imageId,
    assetRef: Object.freeze({
      assetId: imageId,
    }),
  });
}

function buildUiContextPatch(
  event: UiTriggerEvent,
): WorkflowExecutionPlanTranslationRequest["context"] {
  const runtimeParameters = toRuntimeParameters(event.payload);
  const formValues = asRecord(event.payload.values) ?? runtimeParameters;
  const metadata: Record<string, unknown> = {
    systemFormValues: formValues,
  };

  const selectedImage = toSelectedImage(event.payload);
  if (selectedImage) {
    metadata.selectedImage = selectedImage;
  }

  if (event.context?.datasetAssetId) {
    metadata.datasetInstances = Object.freeze([
      Object.freeze({
        instanceId: event.context.references?.datasetInstanceId ?? "ui-dataset-instance",
        purpose: "active-input",
        datasetAssetId: event.context.datasetAssetId,
        datasetVersionId: event.context.datasetVersionId,
        systemId: event.context.systemAssetId,
      }),
    ]);
  }

  return Object.freeze({
    inputValues: runtimeParameters,
    metadata: Object.freeze(metadata),
  });
}

function mergeContext(
  base: WorkflowExecutionPlanTranslationRequest["context"] | undefined,
  overlay: WorkflowExecutionPlanTranslationRequest["context"],
): WorkflowExecutionPlanTranslationRequest["context"] {
  return Object.freeze({
    ...(base ?? {}),
    ...overlay,
    inputValues: Object.freeze({
      ...((base?.inputValues as Readonly<Record<string, unknown>> | undefined) ?? {}),
      ...((overlay.inputValues as Readonly<Record<string, unknown>> | undefined) ?? {}),
    }),
    metadata: Object.freeze({
      ...((base?.metadata as Readonly<Record<string, unknown>> | undefined) ?? {}),
      ...((overlay.metadata as Readonly<Record<string, unknown>> | undefined) ?? {}),
    }),
  });
}

export class WorkflowUiEventRuntimeDispatcher {
  constructor(
    private readonly runner: UiEventDispatchRunner,
    private readonly traceSink?: WorkflowUiEventTraceSink,
  ) {}

  public static fromWorkflowStudioApplicationService(
    service: Pick<WorkflowStudioApplicationService, "runWorkflowDraftTriggered">,
  ): WorkflowUiEventRuntimeDispatcher {
    return new WorkflowUiEventRuntimeDispatcher(service);
  }

  public async dispatch(command: DispatchWorkflowFromUiEventCommand): Promise<DispatchWorkflowFromUiEventResult> {
    const feedback = command.feedback;
    const notifyStatus = (status: typeof WorkflowUiInteractionStatusKinds[keyof typeof WorkflowUiInteractionStatusKinds]) => {
      feedback?.onStatus?.({
        status,
        event: {
          eventId: command.event.eventId,
          kind: command.event.kind,
          name: command.event.name,
          occurredAt: command.event.occurredAt,
        },
        source: {
          studio: command.event.source.studio,
          componentId: command.event.source.componentId,
          actionId: command.event.source.actionId,
        },
        correlation: Object.freeze({
          uiEventId: command.event.eventId,
          workflowRunId: command.event.context?.workflowRunId ?? "",
        }),
      });
    };
    const recordTraceBase = {
      event: {
        eventId: command.event.eventId,
        kind: command.event.kind,
        name: command.event.name,
        sourceStudio: command.event.source.studio,
        sourceComponentId: command.event.source.componentId,
        sourceActionId: command.event.source.actionId,
      },
      workflow: command.event.context
        ? Object.freeze({
          workflowAssetId: command.event.context.workflowAssetId,
          workflowRunId: command.event.context.workflowRunId,
          systemAssetId: command.event.context.systemAssetId,
        })
        : undefined,
      parameterSummary: summarizeUiEventPayload(command.event.payload),
      correlation: Object.freeze({
        uiEventId: command.event.eventId,
        workflowRunId: command.event.context?.workflowRunId,
      }),
    };
    this.traceSink?.record({
      traceId: createWorkflowUiEventTraceId(command.event.eventId, WorkflowUiEventTraceStages.received),
      occurredAt: new Date().toISOString(),
      stage: WorkflowUiEventTraceStages.received,
      ...recordTraceBase,
      dispatchStatus: "pending",
    });
    notifyStatus(WorkflowUiInteractionStatusKinds.received);
    let draft: WorkflowDraft;
    try {
      draft = deserializeWorkflowDraft(command.content);
    } catch (error) {
      return Object.freeze({
        dispatched: Object.freeze([]),
        issues: Object.freeze([Object.freeze({
          code: WorkflowUiInteractionIssueCodes.dispatchFailure,
          message: error instanceof Error ? error.message : "Workflow draft content is malformed.",
          category: "dispatch",
          stage: "dispatch",
        })]),
      });
    }

    const mapped = mapUiTriggerEventToWorkflowTriggerEntries({
      draft,
      event: command.event,
      bindings: command.bindings,
    });

    if (mapped.issues.length > 0) {
      notifyStatus(WorkflowUiInteractionStatusKinds.validationFailed);
      const issues = mapped.issues.map((issue) => Object.freeze({
        code: WorkflowUiInteractionIssueCodes.invalidUiEventPayload,
        message: issue.message,
        category: "validation" as const,
        stage: "event" as const,
      }));
      for (const item of issues) {
        feedback?.onIssue?.(item);
      }
      return Object.freeze({
        dispatched: Object.freeze([]),
        issues: Object.freeze(issues),
      });
    }

    if (mapped.entries.length === 0) {
      notifyStatus(WorkflowUiInteractionStatusKinds.noBindingMatched);
      const issue = Object.freeze({
        code: WorkflowUiInteractionIssueCodes.missingOrInvalidBinding,
        message: `No workflow trigger binding matched UI event '${command.event.name}'.`,
        category: "binding" as const,
        stage: "binding" as const,
      });
      feedback?.onIssue?.(issue);
      return Object.freeze({
        dispatched: Object.freeze([]),
        issues: Object.freeze([issue]),
      });
    }

    this.traceSink?.record({
      traceId: createWorkflowUiEventTraceId(command.event.eventId, WorkflowUiEventTraceStages.bindingResolved),
      occurredAt: new Date().toISOString(),
      stage: WorkflowUiEventTraceStages.bindingResolved,
      ...recordTraceBase,
      binding: {
        triggerId: mapped.entries[0]?.triggerId,
        triggerType: mapped.entries[0]?.triggerType,
        bindingId: String(mapped.entries[0]?.bindingMetadata?.bindingId ?? ""),
      },
      dispatchStatus: "pending",
    });
    notifyStatus(WorkflowUiInteractionStatusKinds.dispatching);

    const context = mergeContext(command.context, buildUiContextPatch(command.event));
    const settled = await Promise.allSettled(mapped.entries.map(async (entry) => {
      this.traceSink?.record({
        traceId: createWorkflowUiEventTraceId(command.event.eventId, WorkflowUiEventTraceStages.dispatchStarted),
        occurredAt: new Date().toISOString(),
        stage: WorkflowUiEventTraceStages.dispatchStarted,
        ...recordTraceBase,
        binding: {
          triggerId: entry.triggerId,
          triggerType: entry.triggerType,
          bindingId: String(entry.bindingMetadata?.bindingId ?? ""),
        },
        dispatchStatus: "pending",
      });
      const run = await this.runner.runWorkflowDraftTriggered({
        content: command.content,
        request: command.request,
        context,
        trigger: entry,
        inputs: command.inputs,
        manualDecisionsByStepId: command.manualDecisionsByStepId,
        maxLoopIterations: command.maxLoopIterations,
      });

      return Object.freeze({
        triggerId: entry.triggerId,
        triggerType: entry.triggerType,
        launchStatus: run.launchStatus,
        executionId: run.executionStatus.executionId,
        blockingIssueCodes: Object.freeze(run.validation.blockingIssues.map((issue) => issue.code)),
        warningIssueCodes: Object.freeze(run.validation.warningIssues.map((issue) => issue.code)),
      } satisfies WorkflowUiEventDispatchRecord);
    }));

    const dispatched: WorkflowUiEventDispatchRecord[] = [];
    const issues: WorkflowUiEventDispatchIssue[] = [];

    for (const result of settled) {
      if (result.status === "fulfilled") {
        dispatched.push(result.value);
        feedback?.onDispatchRecord?.(result.value);
        const status = result.value.launchStatus === "blocked"
          ? WorkflowUiInteractionStatusKinds.launchBlocked
          : result.value.launchStatus === "failed"
            ? WorkflowUiInteractionStatusKinds.launchFailed
            : result.value.launchStatus === "launched" && result.value.executionId && result.value.blockingIssueCodes.length > 0
              ? WorkflowUiInteractionStatusKinds.executionFailed
              : WorkflowUiInteractionStatusKinds.launched;
        notifyStatus(status);
        this.traceSink?.record({
          traceId: createWorkflowUiEventTraceId(command.event.eventId, WorkflowUiEventTraceStages.dispatchSucceeded),
          occurredAt: new Date().toISOString(),
          stage: WorkflowUiEventTraceStages.dispatchSucceeded,
          ...recordTraceBase,
          binding: {
            triggerId: result.value.triggerId,
            triggerType: result.value.triggerType,
          },
          dispatchStatus: result.value.launchStatus === "launched" ? "accepted" : "rejected",
          outcome: result.value.launchStatus === "launched" ? "success" : "failed",
          issues: mapDispatchRecordToTraceIssue(result.value),
          correlation: {
            uiEventId: command.event.eventId,
            executionId: result.value.executionId,
            workflowRunId: command.event.context?.workflowRunId,
          },
        });
        continue;
      }
      const issue = Object.freeze({
        code: WorkflowUiInteractionIssueCodes.dispatchFailure,
        message: result.reason instanceof Error ? result.reason.message : "Workflow trigger dispatch failed.",
        category: "dispatch" as const,
        stage: "dispatch" as const,
      });
      issues.push(issue);
      feedback?.onIssue?.(issue);
      notifyStatus(WorkflowUiInteractionStatusKinds.launchFailed);
      this.traceSink?.record({
        traceId: createWorkflowUiEventTraceId(command.event.eventId, WorkflowUiEventTraceStages.dispatchFailed),
        occurredAt: new Date().toISOString(),
        stage: WorkflowUiEventTraceStages.dispatchFailed,
        ...recordTraceBase,
        dispatchStatus: "rejected",
        outcome: "failed",
        issues: Object.freeze([{
          code: issue.code,
          message: issue.message,
          stage: issue.stage,
        }]),
      });
    }

    return Object.freeze({
      dispatched: Object.freeze(dispatched),
      issues: Object.freeze(issues),
    });
  }
}
