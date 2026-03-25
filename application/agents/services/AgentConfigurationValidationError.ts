import type { AgentConfigurationValidationIssue } from "./AgentConfigurationValidationService";

export class AgentConfigurationValidationError extends Error {
  public readonly issues: ReadonlyArray<AgentConfigurationValidationIssue>;

  constructor(issues: ReadonlyArray<AgentConfigurationValidationIssue>) {
    super("Agent configuration validation failed.");
    this.name = "AgentConfigurationValidationError";
    this.issues = issues;
  }
}

