import type { McpToolExecutionPermissionDecision } from "../../../domain/mcp/McpToolTrust";

export interface McpToolExecutionAuditEvent {
  readonly toolId?: string;
  readonly serverId: string;
  readonly toolName: string;
  readonly occurredAt: string;
  readonly outcome: "allowed" | "denied";
  readonly reason:
    | "policy-allowed"
    | "tool-disabled"
    | "missing-auth-configuration"
    | "invalid-auth-configuration"
    | "permission-denied";
  readonly permissionDecision?: McpToolExecutionPermissionDecision;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IMcpToolExecutionAuditSink {
  record(event: McpToolExecutionAuditEvent): Promise<void>;
}
