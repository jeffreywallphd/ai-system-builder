import type { ExecutionContextEnvelope } from "../../context/models/ExecutionContextEnvelope";
import type { McpToolPermissionScope, McpToolSandboxCapabilityRequest } from "@domain/mcp/McpToolTrust";

export interface McpToolExecutionRequest {
  readonly toolId?: string;
  readonly context?: ExecutionContextEnvelope;
  readonly serverId: string;
  readonly toolName: string;
  readonly arguments?: Readonly<Record<string, unknown>>;
  readonly executionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly runtimePermissions?: ReadonlyArray<McpToolPermissionScope>;
  readonly sandboxRequest?: McpToolSandboxCapabilityRequest;
  readonly resolvedCredentials?: Readonly<Record<string, string>>;
  readonly credentialContext?: {
    readonly projectId?: string;
    readonly userId?: string;
  };
}

