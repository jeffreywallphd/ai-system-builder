import type { IWorkflowExecutionProvenance } from "../../ports/interfaces/IWorkflowExecutor";

export interface ToolRunResult {
  readonly toolId: string;
  readonly executionId: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly messages: ReadonlyArray<string>;
  readonly provenance?: IWorkflowExecutionProvenance;
}
