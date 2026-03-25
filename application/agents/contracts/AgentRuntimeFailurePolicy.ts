import type { AgentMcpToolGovernanceDecision } from "../services/AgentMcpToolGovernanceService";
import type { AgentExecutionResult } from "../models/AgentExecutionResult";

export type AgentRuntimeFailureKind =
  | "governance-denied"
  | "governance-approval-required"
  | "governance-unavailable"
  | "governance-incompatible"
  | "execution-failed"
  | "cancelled";

export interface AgentRuntimeFailure {
  readonly kind: AgentRuntimeFailureKind;
  readonly stepId?: string;
  readonly message: string;
  readonly governanceDecision?: AgentMcpToolGovernanceDecision;
  readonly retryable: boolean;
  readonly retryClassificationSource?: "policy" | "result-metadata" | "heuristic";
}

export interface AgentRuntimeRetryPolicy {
  readonly maxAttemptsPerStep: number;
  readonly classifyFailure?: (input: AgentRuntimeFailureClassificationInput) => AgentRuntimeFailure;
}

export interface AgentRuntimeFailureClassificationInput {
  readonly stepId: string;
  readonly result: AgentExecutionResult;
  readonly fallback: AgentRuntimeFailure;
}

export const DefaultAgentRuntimeRetryPolicy: AgentRuntimeRetryPolicy = Object.freeze({
  maxAttemptsPerStep: 1,
});

export function isAgentRuntimeFailureRetryable(failure: AgentRuntimeFailure): boolean {
  if (failure.kind === "execution-failed") {
    return failure.retryable;
  }
  return false;
}
