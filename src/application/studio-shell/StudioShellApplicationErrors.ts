export const StudioShellErrorCodes = Object.freeze({
  invalidRequest: "studio-shell-invalid-request",
  notFound: "studio-shell-not-found",
  conflict: "studio-shell-conflict",
  invalidLifecycleTransition: "studio-shell-invalid-lifecycle-transition",
});

export type StudioShellErrorCode = typeof StudioShellErrorCodes[keyof typeof StudioShellErrorCodes];

export class StudioShellApplicationError extends Error {
  public readonly code: StudioShellErrorCode;

  constructor(code: StudioShellErrorCode, message: string) {
    super(message);
    this.name = "StudioShellApplicationError";
    this.code = code;
  }
}

export class StudioShellInvalidRequestError extends StudioShellApplicationError {
  constructor(message: string) {
    super(StudioShellErrorCodes.invalidRequest, message);
    this.name = "StudioShellInvalidRequestError";
  }
}

export class StudioShellNotFoundError extends StudioShellApplicationError {
  constructor(entity: "studio" | "session" | "draft", id: string) {
    super(StudioShellErrorCodes.notFound, `Studio shell ${entity} '${id}' was not found.`);
    this.name = "StudioShellNotFoundError";
  }
}

export class StudioShellConflictError extends StudioShellApplicationError {
  constructor(message: string) {
    super(StudioShellErrorCodes.conflict, message);
    this.name = "StudioShellConflictError";
  }
}


export class StudioShellInvalidLifecycleTransitionError extends StudioShellApplicationError {
  constructor(message: string) {
    super(StudioShellErrorCodes.invalidLifecycleTransition, message);
    this.name = "StudioShellInvalidLifecycleTransitionError";
  }
}
