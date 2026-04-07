export const WorkflowPersistenceErrorCodes = Object.freeze({
  conflict: "workflow-persistence-conflict",
  invalidRequest: "workflow-persistence-invalid-request",
  notFound: "workflow-persistence-not-found",
  persistenceFailure: "workflow-persistence-failure",
});

export type WorkflowPersistenceErrorCode =
  typeof WorkflowPersistenceErrorCodes[keyof typeof WorkflowPersistenceErrorCodes];

export class WorkflowPersistenceError extends Error {
  public readonly code: WorkflowPersistenceErrorCode;

  constructor(code: WorkflowPersistenceErrorCode, message: string) {
    super(message);
    this.name = "WorkflowPersistenceError";
    this.code = code;
  }
}

export class WorkflowPersistenceConflictError extends WorkflowPersistenceError {
  constructor(workflowId: string, message?: string) {
    super(WorkflowPersistenceErrorCodes.conflict, message ?? `Persisted workflow '${workflowId}' already exists.`);
    this.name = "WorkflowPersistenceConflictError";
  }
}

export class WorkflowPersistenceNotFoundError extends WorkflowPersistenceError {
  constructor(workflowId: string) {
    super(WorkflowPersistenceErrorCodes.notFound, `Persisted workflow '${workflowId}' was not found.`);
    this.name = "WorkflowPersistenceNotFoundError";
  }
}

export class WorkflowPersistenceInvalidRequestError extends WorkflowPersistenceError {
  constructor(message: string) {
    super(WorkflowPersistenceErrorCodes.invalidRequest, message);
    this.name = "WorkflowPersistenceInvalidRequestError";
  }
}

export class WorkflowPersistenceFailureError extends WorkflowPersistenceError {
  constructor(operationLabel: string) {
    super(
      WorkflowPersistenceErrorCodes.persistenceFailure,
      `Workflow persistence operation failed during ${operationLabel}.`,
    );
    this.name = "WorkflowPersistenceFailureError";
  }
}

export function toWorkflowPersistenceFailureError(
  operationLabel: string,
  error: unknown,
): WorkflowPersistenceError {
  if (error instanceof WorkflowPersistenceError) {
    return error;
  }
  return new WorkflowPersistenceFailureError(operationLabel);
}
