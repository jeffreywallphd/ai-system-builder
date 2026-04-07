export const WorkflowRunHistoryErrorCodes = Object.freeze({
  invalidRequest: "workflow-run-history-invalid-request",
  persistenceFailure: "workflow-run-history-persistence-failure",
  notFound: "workflow-run-history-not-found",
});

export type WorkflowRunHistoryErrorCode =
  typeof WorkflowRunHistoryErrorCodes[keyof typeof WorkflowRunHistoryErrorCodes];

export class WorkflowRunHistoryError extends Error {
  public readonly code: WorkflowRunHistoryErrorCode;

  constructor(code: WorkflowRunHistoryErrorCode, message: string) {
    super(message);
    this.name = "WorkflowRunHistoryError";
    this.code = code;
  }
}

export class WorkflowRunHistoryInvalidRequestError extends WorkflowRunHistoryError {
  constructor(message: string) {
    super(WorkflowRunHistoryErrorCodes.invalidRequest, message);
    this.name = "WorkflowRunHistoryInvalidRequestError";
  }
}

export class WorkflowRunHistoryNotFoundError extends WorkflowRunHistoryError {
  constructor(runId: string) {
    super(WorkflowRunHistoryErrorCodes.notFound, `Workflow run summary '${runId}' was not found.`);
    this.name = "WorkflowRunHistoryNotFoundError";
  }
}

export class WorkflowRunHistoryPersistenceFailureError extends WorkflowRunHistoryError {
  constructor(operation: string) {
    super(WorkflowRunHistoryErrorCodes.persistenceFailure, `Workflow run history persistence failed during ${operation}.`);
    this.name = "WorkflowRunHistoryPersistenceFailureError";
  }
}

export function toWorkflowRunHistoryError(operation: string, error: unknown): WorkflowRunHistoryError {
  if (error instanceof WorkflowRunHistoryError) {
    return error;
  }
  return new WorkflowRunHistoryPersistenceFailureError(operation);
}
