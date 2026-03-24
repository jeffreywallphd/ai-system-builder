import type {
  McpToolExecutionApprovalDecision,
  McpToolExecutionPermissionDecision,
  McpToolExecutionSandboxDecision,
} from "../../../domain/mcp/McpToolTrust";

export interface McpToolExecutionAuditEvent {
  readonly toolId?: string;
  readonly serverId: string;
  readonly toolName: string;
  readonly occurredAt: string;
  readonly outcome: "allowed" | "denied" | "administrative";
  readonly reason:
    | "policy-allowed"
    | "tool-disabled"
    | "missing-auth-configuration"
    | "invalid-auth-configuration"
    | "invalid-credentials"
    | "permission-denied"
    | "approval-required"
    | "sandbox-denied"
    | "approval-requested"
    | "approval-granted"
    | "approval-denied"
    | "approval-revoked";
  readonly permissionDecision?: McpToolExecutionPermissionDecision;
  readonly approvalDecision?: McpToolExecutionApprovalDecision;
  readonly sandboxDecision?: McpToolExecutionSandboxDecision;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IMcpToolExecutionAuditSink {
  record(event: McpToolExecutionAuditEvent): Promise<void>;
}
