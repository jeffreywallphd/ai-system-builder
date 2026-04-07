import { deserializeWorkflowDraft, type WorkflowDraft } from "@domain/workflow-studio/WorkflowStudioDomain";
import type { ImageWorkflowUiTriggerBindingConfiguration } from "../contracts/ImageWorkflowUiTriggerBindingConfiguration";
import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type {
  RunWorkflowDraftManualResult,
  RunWorkflowDraftTriggeredCommand,
  WorkflowStudioApplicationService,
} from "./WorkflowStudioApplicationService";
import type { UiTriggerEvent } from "./UiTriggerEventContract";
import { createDefaultUiTriggerSystemContextMapper, type UiTriggerSystemContextMapper } from "./UiTriggerSystemContextMapper";
import {
  createDefaultWorkflowSystemContextBindingAdapter,
  type WorkflowSystemContextBindingAdapter,
} from "./SystemContextWorkflowInputMapper";
import {
  createDefaultUiTriggerEventPayloadEnricher,
  type UiTriggerEventPayloadEnricher,
} from "./UiTriggerEventPayloadEnrichmentService";
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
    private readonly systemContextMapper: UiTriggerSystemContextMapper = createDefaultUiTriggerSystemContextMapper(),
    private readonly systemContextBindingAdapter: WorkflowSystemContextBindingAdapter = createDefaultWorkflowSystemContextBindingAdapter(),
    private readonly payloadEnricher: UiTriggerEventPayloadEnricher = createDefaultUiTriggerEventPayloadEnricher(),
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

    const systemContext = this.systemContextMapper.map(command.event);
    const context = mergeContext(command.context, this.systemContextBindingAdapter.map(systemContext));
    const settled = await Promise.allSettled(mapped.entries.map(async (entry) => {
      const enrichedEntry = Object.freeze({
        ...entry,
        payload: this.payloadEnricher.enrich({
          event: command.event,
          triggerEntry: entry,
          systemContext,
          workflowContext: context,
        }),
      });
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
        trigger: enrichedEntry,
        inputs: command.inputs,
        manualDecisionsByStepId: command.manualDecisionsByStepId,
        maxLoopIterations: command.maxLoopIterations,
      });

      return Object.freeze({
        triggerId: enrichedEntry.triggerId,
        triggerType: enrichedEntry.triggerType,
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

