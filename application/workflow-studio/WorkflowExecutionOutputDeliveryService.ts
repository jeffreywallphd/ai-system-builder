import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftSystemOutputRecordShapes,
  WorkflowDraftSystemOutputWriteModes,
} from "../../domain/workflow-studio/WorkflowStudioDomain";
import type {
  WorkflowDraftExecutionOutputPlan,
  WorkflowDraftExecutionPlan,
} from "./WorkflowDefinitionExecutionPlanTranslator";

export const WorkflowOutputDeliveryStatuses = Object.freeze({
  delivered: "delivered",
  failed: "failed",
});

export type WorkflowOutputDeliveryStatus =
  typeof WorkflowOutputDeliveryStatuses[keyof typeof WorkflowOutputDeliveryStatuses];

export interface WorkflowExecutionOutputDeliveryIssue {
  readonly code: string;
  readonly outputId: string;
  readonly message: string;
}

export interface WorkflowExecutionOutputDeliveryResult {
  readonly outputId: string;
  readonly destinationType: WorkflowDraftExecutionOutputPlan["destination"]["type"];
  readonly format: WorkflowDraftExecutionOutputPlan["format"];
  readonly target: string;
  readonly status: WorkflowOutputDeliveryStatus;
  readonly payload?: unknown;
  readonly detail?: string;
}

export interface WorkflowExecutionOutputDeliveryRequest {
  readonly plan: WorkflowDraftExecutionPlan;
  readonly stepOutputs: Readonly<Record<string, unknown>>;
  readonly traces: ReadonlyArray<{
    readonly sequence: number;
    readonly stepId: string;
    readonly status: "completed" | "skipped" | "failed" | "paused";
  }>;
}

export interface WorkflowExecutionOutputDeliveryHandler {
  readonly deliver: (
    outputPlan: WorkflowDraftExecutionOutputPlan,
    payload: unknown,
    request: WorkflowExecutionOutputDeliveryRequest,
  ) => Promise<WorkflowExecutionOutputDeliveryResult> | WorkflowExecutionOutputDeliveryResult;
}

export interface WorkflowExecutionOutputDeliveryResponse {
  readonly results: ReadonlyArray<WorkflowExecutionOutputDeliveryResult>;
  readonly issues: ReadonlyArray<WorkflowExecutionOutputDeliveryIssue>;
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readOutputSourcePayload(
  request: WorkflowExecutionOutputDeliveryRequest,
  outputPlan: WorkflowDraftExecutionOutputPlan,
): unknown {
  if (outputPlan.sourceStepId) {
    if (!(outputPlan.sourceStepId in request.stepOutputs)) {
      throw new Error(`output-delivery-source-step-missing:${outputPlan.outputId}:${outputPlan.sourceStepId}`);
    }
    return request.stepOutputs[outputPlan.sourceStepId];
  }

  return Object.freeze({
    stepOutputs: Object.freeze({ ...request.stepOutputs }),
    summary: Object.freeze({
      completedStepCount: request.traces.filter((trace) => trace.status === "completed").length,
      failedStepCount: request.traces.filter((trace) => trace.status === "failed").length,
      skippedStepCount: request.traces.filter((trace) => trace.status === "skipped").length,
      pausedStepCount: request.traces.filter((trace) => trace.status === "paused").length,
    }),
  });
}

function validateFileExportOutput(outputPlan: WorkflowDraftExecutionOutputPlan): void {
  if (outputPlan.destination.type !== WorkflowDraftOutputDestinationTypes.fileExport) {
    return;
  }

  if (!outputPlan.runtime.outputHandlerType) {
    throw new Error(`output-delivery-unsupported:${outputPlan.outputId}`);
  }

  const deliveryMode = readTrimmedString(outputPlan.configuration?.deliveryMode);
  if (deliveryMode !== "download" && deliveryMode !== "workspace-file") {
    throw new Error(`output-delivery-config-invalid:${outputPlan.outputId}:deliveryMode`);
  }

  if (deliveryMode === "workspace-file" && !readTrimmedString(outputPlan.configuration?.destinationPath)) {
    throw new Error(`output-delivery-config-missing:${outputPlan.outputId}:destinationPath`);
  }
}

function validateSystemRecordOutput(outputPlan: WorkflowDraftExecutionOutputPlan): void {
  if (outputPlan.destination.type !== WorkflowDraftOutputDestinationTypes.systemEntry) {
    return;
  }

  if (!readTrimmedString(outputPlan.configuration?.entityName)) {
    throw new Error(`output-delivery-config-missing:${outputPlan.outputId}:entityName`);
  }

  const writeMode = readTrimmedString(outputPlan.configuration?.writeMode);
  if (writeMode !== WorkflowDraftSystemOutputWriteModes.upsert && writeMode !== WorkflowDraftSystemOutputWriteModes.append) {
    throw new Error(`output-delivery-config-invalid:${outputPlan.outputId}:writeMode`);
  }

  const recordShape = readTrimmedString(outputPlan.configuration?.recordShape);
  if (
    recordShape !== WorkflowDraftSystemOutputRecordShapes.singleRecord
    && recordShape !== WorkflowDraftSystemOutputRecordShapes.recordCollection
  ) {
    throw new Error(`output-delivery-config-invalid:${outputPlan.outputId}:recordShape`);
  }
}

function validateViewerOutput(outputPlan: WorkflowDraftExecutionOutputPlan): void {
  if (
    outputPlan.destination.type !== WorkflowDraftOutputDestinationTypes.webViewer
    && outputPlan.destination.type !== WorkflowDraftOutputDestinationTypes.promptResponseChat
  ) {
    return;
  }

  if (!readTrimmedString(outputPlan.configuration?.title)) {
    throw new Error(`output-delivery-config-missing:${outputPlan.outputId}:title`);
  }

  if (outputPlan.destination.type === WorkflowDraftOutputDestinationTypes.promptResponseChat) {
    if (!readTrimmedString(outputPlan.configuration?.promptInputId)) {
      throw new Error(`output-delivery-config-missing:${outputPlan.outputId}:promptInputId`);
    }
    if (!readTrimmedString(outputPlan.configuration?.responseField)) {
      throw new Error(`output-delivery-config-missing:${outputPlan.outputId}:responseField`);
    }
  }
}

function defaultDeliverOutput(
  outputPlan: WorkflowDraftExecutionOutputPlan,
  payload: unknown,
): WorkflowExecutionOutputDeliveryResult {
  if (
    outputPlan.destination.type !== WorkflowDraftOutputDestinationTypes.webViewer
    && outputPlan.destination.type !== WorkflowDraftOutputDestinationTypes.fileExport
    && outputPlan.destination.type !== WorkflowDraftOutputDestinationTypes.systemEntry
    && outputPlan.destination.type !== WorkflowDraftOutputDestinationTypes.promptResponseChat
  ) {
    throw new Error(`output-delivery-unsupported:${outputPlan.outputId}:${outputPlan.destination.type}`);
  }

  return Object.freeze({
    outputId: outputPlan.outputId,
    destinationType: outputPlan.destination.type,
    format: outputPlan.format,
    target: outputPlan.destination.target,
    status: WorkflowOutputDeliveryStatuses.delivered,
    payload: Object.freeze({
      destination: Object.freeze({
        type: outputPlan.destination.type,
        target: outputPlan.destination.target,
      }),
      format: outputPlan.format,
      sourceStepId: outputPlan.sourceStepId,
      value: payload,
    }),
    detail: `output-delivered:${outputPlan.destination.type}`,
  });
}

function normalizeDeliveryResult(
  outputPlan: WorkflowDraftExecutionOutputPlan,
  result: WorkflowExecutionOutputDeliveryResult,
): WorkflowExecutionOutputDeliveryResult {
  return Object.freeze({
    outputId: result.outputId || outputPlan.outputId,
    destinationType: result.destinationType || outputPlan.destination.type,
    format: result.format || outputPlan.format,
    target: result.target || outputPlan.destination.target,
    status: result.status,
    payload: result.payload,
    detail: result.detail,
  });
}

export async function deliverWorkflowExecutionOutputs(
  request: WorkflowExecutionOutputDeliveryRequest,
  handler?: WorkflowExecutionOutputDeliveryHandler,
): Promise<WorkflowExecutionOutputDeliveryResponse> {
  const results: WorkflowExecutionOutputDeliveryResult[] = [];
  const issues: WorkflowExecutionOutputDeliveryIssue[] = [];

  for (const outputPlan of request.plan.outputs) {
    try {
      validateFileExportOutput(outputPlan);
      validateSystemRecordOutput(outputPlan);
      validateViewerOutput(outputPlan);
      if (
        outputPlan.format === WorkflowDraftOutputFormats.csv
        && outputPlan.destination.type === WorkflowDraftOutputDestinationTypes.webViewer
      ) {
        throw new Error(`output-delivery-format-unsupported:${outputPlan.outputId}:${outputPlan.format}`);
      }

      const payload = readOutputSourcePayload(request, outputPlan);
      const delivered = handler
        ? await handler.deliver(outputPlan, payload, request)
        : defaultDeliverOutput(outputPlan, payload);
      const normalized = normalizeDeliveryResult(outputPlan, delivered);
      if (normalized.status === WorkflowOutputDeliveryStatuses.failed) {
        issues.push(Object.freeze({
          code: "output-delivery-failed",
          outputId: outputPlan.outputId,
          message: normalized.detail ?? `Output '${outputPlan.outputId}' failed delivery.`,
        }));
      }
      results.push(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "output-delivery-failed";
      issues.push(Object.freeze({
        code: message.split(":")[0] || "output-delivery-failed",
        outputId: outputPlan.outputId,
        message,
      }));
      results.push(Object.freeze({
        outputId: outputPlan.outputId,
        destinationType: outputPlan.destination.type,
        format: outputPlan.format,
        target: outputPlan.destination.target,
        status: WorkflowOutputDeliveryStatuses.failed,
        detail: message,
      }));
    }
  }

  return Object.freeze({
    results: Object.freeze(results),
    issues: Object.freeze(issues),
  });
}
