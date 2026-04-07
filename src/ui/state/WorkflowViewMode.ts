export type WorkflowViewMode = "canvas" | "form";

export function isWorkflowViewMode(value: string): value is WorkflowViewMode {
  return value === "canvas" || value === "form";
}
