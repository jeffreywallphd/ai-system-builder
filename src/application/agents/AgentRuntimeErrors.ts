export const AgentRuntimeErrorCodes = Object.freeze({
  invalidRequest: "agent-runtime-invalid-request",
  notFound: "agent-runtime-not-found",
  unsupportedControl: "agent-runtime-unsupported-control",
  invalidControlState: "agent-runtime-invalid-control-state",
});

export type AgentRuntimeErrorCode = typeof AgentRuntimeErrorCodes[keyof typeof AgentRuntimeErrorCodes];

export class AgentRuntimeError extends Error {
  public readonly code: AgentRuntimeErrorCode;

  constructor(code: AgentRuntimeErrorCode, message: string) {
    super(message);
    this.name = "AgentRuntimeError";
    this.code = code;
  }
}

export class AgentRuntimeInvalidRequestError extends AgentRuntimeError {
  constructor(message: string) {
    super(AgentRuntimeErrorCodes.invalidRequest, message);
    this.name = "AgentRuntimeInvalidRequestError";
  }
}

export class AgentRuntimeNotFoundError extends AgentRuntimeError {
  constructor(kind: "agent" | "session", id: string) {
    super(AgentRuntimeErrorCodes.notFound, `${kind === "agent" ? "Agent" : "Session"} '${id}' was not found.`);
    this.name = "AgentRuntimeNotFoundError";
  }
}

export class AgentRuntimeUnsupportedControlError extends AgentRuntimeError {
  constructor(action: string) {
    super(AgentRuntimeErrorCodes.unsupportedControl, `Agent run control action '${action}' is not supported.`);
    this.name = "AgentRuntimeUnsupportedControlError";
  }
}

export class AgentRuntimeInvalidControlStateError extends AgentRuntimeError {
  constructor(message: string) {
    super(AgentRuntimeErrorCodes.invalidControlState, message);
    this.name = "AgentRuntimeInvalidControlStateError";
  }
}
