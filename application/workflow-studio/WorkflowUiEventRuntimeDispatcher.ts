import { deserializeWorkflowDraft, type WorkflowDraft } from "../../domain/workflow-studio/WorkflowStudioDomain";
import type { ImageWorkflowUiTriggerBindingConfiguration } from "../contracts/ImageWorkflowUiTriggerBindingConfiguration";
import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type {
  RunWorkflowDraftManualResult,
  RunWorkflowDraftTriggeredCommand,
  WorkflowStudioApplicationService,
} from "./WorkflowStudioApplicationService";
import type { UiTriggerEvent } from "./UiTriggerEventContract";
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
}

export interface WorkflowUiEventDispatchIssue {
  readonly code: "ui-trigger-mapping-invalid" | "ui-trigger-no-match" | "ui-trigger-dispatch-failed";
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface WorkflowUiEventDispatchRecord {
  readonly triggerId?: string;
  readonly triggerType?: string;
  readonly launchStatus: RunWorkflowDraftManualResult["launchStatus"];
  readonly executionId: string;
  readonly blockingIssueCodes: ReadonlyArray<string>;
  readonly warningIssueCodes: ReadonlyArray<string>;
}

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
  constructor(private readonly runner: UiEventDispatchRunner) {}

  public static fromWorkflowStudioApplicationService(
    service: Pick<WorkflowStudioApplicationService, "runWorkflowDraftTriggered">,
  ): WorkflowUiEventRuntimeDispatcher {
    return new WorkflowUiEventRuntimeDispatcher(service);
  }

  public async dispatch(command: DispatchWorkflowFromUiEventCommand): Promise<DispatchWorkflowFromUiEventResult> {
    let draft: WorkflowDraft;
    try {
      draft = deserializeWorkflowDraft(command.content);
    } catch (error) {
      return Object.freeze({
        dispatched: Object.freeze([]),
        issues: Object.freeze([Object.freeze({
          code: "ui-trigger-dispatch-failed",
          message: error instanceof Error ? error.message : "Workflow draft content is malformed.",
        })]),
      });
    }

    const mapped = mapUiTriggerEventToWorkflowTriggerEntries({
      draft,
      event: command.event,
      bindings: command.bindings,
    });

    if (mapped.issues.length > 0) {
      return Object.freeze({
        dispatched: Object.freeze([]),
        issues: Object.freeze(mapped.issues.map((issue) => Object.freeze({
          code: "ui-trigger-mapping-invalid",
          message: issue.message,
        }))),
      });
    }

    if (mapped.entries.length === 0) {
      return Object.freeze({
        dispatched: Object.freeze([]),
        issues: Object.freeze([Object.freeze({
          code: "ui-trigger-no-match",
          message: `No workflow trigger binding matched UI event '${command.event.name}'.`,
        })]),
      });
    }

    const context = mergeContext(command.context, buildUiContextPatch(command.event));
    const settled = await Promise.allSettled(mapped.entries.map(async (entry) => {
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
        continue;
      }
      issues.push(Object.freeze({
        code: "ui-trigger-dispatch-failed",
        message: result.reason instanceof Error ? result.reason.message : "Workflow trigger dispatch failed.",
      }));
    }

    return Object.freeze({
      dispatched: Object.freeze(dispatched),
      issues: Object.freeze(issues),
    });
  }
}
