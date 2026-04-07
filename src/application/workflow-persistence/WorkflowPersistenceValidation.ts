import { validateWorkflowDraft } from "../../domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowPersistenceInvalidRequestError } from "./WorkflowPersistenceErrors";

export function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new WorkflowPersistenceInvalidRequestError(`${label} is required.`);
  }
  return normalized;
}

export function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function assertWorkflowDraftValid(
  draft: Parameters<typeof validateWorkflowDraft>[0],
  operationLabel: string,
): void {
  const validation = validateWorkflowDraft(draft);
  if (validation.valid) {
    return;
  }

  const issueSummary = validation.issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.code)
    .slice(0, 5)
    .join(", ");
  throw new WorkflowPersistenceInvalidRequestError(
    `${operationLabel} requires a valid canonical workflow draft: ${issueSummary || "validation-failed"}.`,
  );
}
