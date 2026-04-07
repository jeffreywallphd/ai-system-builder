import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type {
  IWorkflowExecutionEvent,
  WorkflowExecutionStatus,
} from "@application/ports/interfaces/IWorkflowExecutor";
import { toTitleCase } from "./PresenterFormatting";

export interface WorkflowExecutionStatusViewModel {
  readonly executionId: string;
  readonly statusLabel: string;
  readonly statusTone: "info" | "success" | "warning" | "danger";
  readonly currentNodeLabel: string;
  readonly progressLabel: string;
  readonly executionPathLabel: string;
  readonly message?: string;
  readonly detail?: string;
  readonly selectionReason?: string;
  readonly fallbackSummary?: string;
  readonly nodeTruthfulnessSummary?: string;
  readonly outputSummary?: string;
}

export class WorkflowExecutionPresenter {
  public present(params: {
    readonly isExecuting: boolean;
    readonly lastExecutionEvent?: IWorkflowExecutionEvent;
    readonly outputAssets?: ReadonlyArray<IAsset>;
  }): WorkflowExecutionStatusViewModel {
    const event = params.lastExecutionEvent;
    const status = event?.status ?? (params.isExecuting ? "running" : "queued");
    const provenance = event?.provenance;
    const outputAssets = params.outputAssets ?? [];

    return Object.freeze({
      executionId: event?.executionId ?? "â€”",
      statusLabel: toTitleCase(status),
      statusTone: mapStatusTone(status),
      currentNodeLabel: event?.nodeId ?? "â€”",
      progressLabel:
        typeof event?.progress?.percent === "number"
          ? `${event.progress.percent}%`
          : params.isExecuting
            ? "In progress"
            : "â€”",
      executionPathLabel: provenance?.classification ? toTitleCase(provenance.classification) : "Awaiting runtime update",
      message: event?.message ?? (params.isExecuting ? "Workflow execution is in progress." : undefined),
      detail: provenance?.detail,
      selectionReason: provenance?.selectionReason,
      fallbackSummary: provenance?.fallback?.isActive
        ? `${provenance.fallback.kind} â€” ${provenance.fallback.reason ?? "Fallback path active."}`
        : undefined,
      nodeTruthfulnessSummary: provenance?.nodeCounts
        ? `real ${provenance.nodeCounts.real ?? 0} â€¢ delegated ${provenance.nodeCounts.delegated ?? 0} â€¢ hybrid ${provenance.nodeCounts.hybrid ?? 0} â€¢ scaffolded ${provenance.nodeCounts.scaffolded ?? 0} â€¢ unavailable ${provenance.nodeCounts.unavailable ?? 0}`
        : undefined,
      outputSummary:
        outputAssets.length > 0
          ? `${outputAssets.length} output asset${outputAssets.length === 1 ? "" : "s"} captured.`
          : status === "completed"
            ? "No output assets were captured."
            : undefined,
    });
  }
}

function mapStatusTone(status: WorkflowExecutionStatus): WorkflowExecutionStatusViewModel["statusTone"] {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "cancelled":
      return "warning";
    case "queued":
    case "preparing":
    case "validating":
    case "running":
    default:
      return "info";
  }
}

