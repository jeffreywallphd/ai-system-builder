import type { McpToolSecretScope } from "../../ports/interfaces/IMcpToolSecretRepository";

export type McpCredentialValidationClassification = "missing" | "malformed";

export interface McpCredentialValidationIssue {
  readonly fieldKey: string;
  readonly classification: McpCredentialValidationClassification;
  readonly reason: string;
}

export type McpCredentialResolutionStatus = "success" | "missing" | "partial" | "invalid" | "failed";

export interface McpCredentialResolutionResult {
  readonly status: McpCredentialResolutionStatus;
  readonly toolId: string;
  readonly scope: McpToolSecretScope;
  readonly configured: boolean;
  readonly values: Readonly<Record<string, string>>;
  readonly missingRequiredFields: ReadonlyArray<string>;
  readonly malformedFields: ReadonlyArray<string>;
  readonly issues: ReadonlyArray<McpCredentialValidationIssue>;
  readonly updatedAt?: string;
}

export interface McpCredentialResolutionContext {
  readonly projectId?: string;
  readonly userId?: string;
}
