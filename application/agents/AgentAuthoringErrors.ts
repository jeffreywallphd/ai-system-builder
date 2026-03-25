export const AgentAuthoringErrorCodes = Object.freeze({
  conflict: "agent-conflict",
  invalidRequest: "agent-invalid-request",
  notFound: "agent-not-found",
});

export type AgentAuthoringErrorCode = typeof AgentAuthoringErrorCodes[keyof typeof AgentAuthoringErrorCodes];

export class AgentAuthoringError extends Error {
  public readonly code: AgentAuthoringErrorCode;

  constructor(code: AgentAuthoringErrorCode, message: string) {
    super(message);
    this.name = "AgentAuthoringError";
    this.code = code;
  }
}

export class AgentConflictError extends AgentAuthoringError {
  constructor(agentId: string) {
    super(AgentAuthoringErrorCodes.conflict, `Agent '${agentId}' already exists.`);
    this.name = "AgentConflictError";
  }
}

export class AgentNotFoundError extends AgentAuthoringError {
  constructor(agentId: string) {
    super(AgentAuthoringErrorCodes.notFound, `Agent '${agentId}' was not found.`);
    this.name = "AgentNotFoundError";
  }
}

export class AgentInvalidRequestError extends AgentAuthoringError {
  constructor(message: string) {
    super(AgentAuthoringErrorCodes.invalidRequest, message);
    this.name = "AgentInvalidRequestError";
  }
}
