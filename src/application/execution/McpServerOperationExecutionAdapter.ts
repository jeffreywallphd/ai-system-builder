import type { IExecutionArtifact, IExecutionDiagnostics, IExecutionEngineEvent, IExecutionProvenance } from "./ExecutionContracts";
import type { IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";
import type { IExecutionRunSummary } from "../../domain/execution/ExecutionRun";
import type { LocalMcpServerCreateResult } from "../mcp/models/LocalMcpServerCreateResult";
import type { McpServerOperationAction, McpServerOperationExecutionInput, McpServerOperationExecutionResult } from "./McpServerOperationExecutionPlanFactory";

export const McpServerOperationExecutionArtifacts = Object.freeze({
  operationResult: "mcp-server-operation-result",
});

export function createMcpServerOperationExecutionArtifact<TValue>(
  kind: string,
  value: TValue,
): IExecutionArtifact<TValue> {
  return Object.freeze({ kind, value });
}

export function getMcpServerOperationResult(
  result: IExecutionUnitExecutionResult | undefined,
): McpServerOperationExecutionResult | undefined {
  const artifact = result?.artifacts?.find((candidate) => candidate.kind === McpServerOperationExecutionArtifacts.operationResult);
  return artifact?.value as McpServerOperationExecutionResult | undefined;
}

export function getMcpServerOperationResultFromEvent(
  event: IExecutionEngineEvent | undefined,
): McpServerOperationExecutionResult | undefined {
  if (event?.detail?.kind !== McpServerOperationExecutionArtifacts.operationResult) {
    return undefined;
  }
  return event.detail.value as McpServerOperationExecutionResult | undefined;
}

export function toMcpServerOperationExecutionProvenance(
  action: McpServerOperationAction,
  result: McpServerOperationExecutionResult,
): IExecutionProvenance {
  const runtime = result.runtime;
  const status = result.status;
  const diagnostics = toMcpServerOperationDiagnostics(result);
  const isUnavailable = runtime.enabled === false || runtime.state === "disabled" || runtime.state === "unavailable";
  const selectionReason = runtime.state === "degraded"
    ? "The MCP runtime reported degraded health while processing this server operation."
    : runtime.state === "ready"
      ? undefined
      : `The MCP runtime reported '${runtime.state}' while processing this server operation.`;

  return Object.freeze({
    classification: isUnavailable ? "unavailable" : "delegated",
    executorId: "python-mcp-runtime-manager",
    runtime: "python-mcp-runtime",
    detail: describeOperationDetail(action, result),
    selectionReason,
    fallback: isUnavailable
      ? Object.freeze({
          kind: "mcp-runtime-unavailable",
          isActive: true,
          reason: extractPrimaryError(result) ?? "The MCP runtime is unavailable.",
        })
      : undefined,
    diagnostics,
    metadata: Object.freeze({
      action,
      runtimeState: runtime.state,
      healthState: runtime.healthState,
      serverId: status.serverId,
      serverName: status.name,
      transport: status.transport,
      lifecycleState: status.lifecycleState,
      sessionState: status.sessionState,
      connected: status.connected,
      configured: status.configured,
      enabled: status.enabled,
      toolCount: status.toolCount,
      resourceCount: status.resourceCount,
      promptCount: status.promptCount,
      created: isCreateResult(result) ? result.created : undefined,
    }),
    sourceKind: "mcp-server-operation",
  });
}

export function toMcpServerOperationOutputMetadata(
  action: McpServerOperationAction,
  input: McpServerOperationExecutionInput,
  result?: McpServerOperationExecutionResult,
): Readonly<Record<string, unknown>> {
  if (!result) {
    const serverId = input.action === "create-local-server" ? input.draft.serverId.trim() : input.serverId.trim();
    const serverName = input.action === "create-local-server" ? input.draft.serverName.trim() : serverId;
    return Object.freeze({
      action,
      serverId,
      serverName,
      phase: "submitted",
    });
  }

  const status = result.status;
  return Object.freeze({
    action,
    serverId: status.serverId,
    serverName: status.name,
    transport: status.transport,
    runtimeState: result.runtime.state,
    healthState: result.runtime.healthState,
    serverState: status.state,
    lifecycleState: status.lifecycleState,
    sessionState: status.sessionState,
    connected: status.connected,
    configured: status.configured,
    enabled: status.enabled,
    toolCount: status.toolCount,
    resourceCount: status.resourceCount,
    promptCount: status.promptCount,
    created: isCreateResult(result) ? result.created : undefined,
    sourceType: result.server.sourceType,
  });
}

export function toMcpServerOperationOutputSummary(
  action: McpServerOperationAction,
  result?: McpServerOperationExecutionResult,
): IExecutionRunSummary {
  if (!result) {
    return Object.freeze({
      headline: describePendingHeadline(action),
      detail: describePendingDetail(action),
      metadata: Object.freeze({ action, phase: "submitted" }),
    });
  }

  const detail = describeOperationDetail(action, result);
  const status = result.status;
  const headline = resolveHeadline(action, result);

  return Object.freeze({
    headline,
    detail,
    metadata: Object.freeze({
      action,
      runtimeState: result.runtime.state,
      serverState: status.state,
      connected: status.connected,
      created: isCreateResult(result) ? result.created : undefined,
    }),
  });
}

export function toMcpServerOperationDiagnostics(
  result: McpServerOperationExecutionResult,
): ReadonlyArray<IExecutionDiagnostics> {
  const diagnostics: IExecutionDiagnostics[] = [];
  const seen = new Set<string>();
  const pushDiagnostic = (code: string, severity: IExecutionDiagnostics["severity"], message: string | undefined, detail?: string) => {
    const normalizedMessage = message?.trim();
    if (!normalizedMessage) {
      return;
    }
    const key = `${code}:${severity}:${normalizedMessage}:${detail ?? ""}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    diagnostics.push(Object.freeze({ code, severity, message: normalizedMessage, detail }));
  };

  pushDiagnostic("mcp-server-status", "error", result.status.errorMessage, `${result.status.name} reported a server-level error.`);
  pushDiagnostic("mcp-server-descriptor", "error", result.server.errorMessage, `${result.server.name} reported a descriptor-level error.`);

  const runtimeReason = typeof result.runtime.metadata?.reason === "string" ? result.runtime.metadata.reason : undefined;
  const runtimeMessage = runtimeReason
    ? `MCP runtime reported ${runtimeReason.replace(/-/g, " ")}.`
    : result.runtime.state !== "ready"
      ? `MCP runtime state is ${result.runtime.state}.`
      : undefined;
  pushDiagnostic(
    "mcp-runtime-state",
    result.runtime.state === "degraded" ? "warning" : result.runtime.state === "ready" ? "info" : "error",
    runtimeMessage,
  );

  if (!result.status.connected && result.status.state === "disconnected" && result.status.transport === "stdio" && result.runtime.state === "ready") {
    pushDiagnostic(
      "mcp-server-disconnected",
      "warning",
      `${result.status.name} remains disconnected after the requested operation.`,
      result.status.lifecycleState ? `Lifecycle state: ${result.status.lifecycleState}.` : undefined,
    );
  }

  return Object.freeze(diagnostics);
}

function resolveHeadline(action: McpServerOperationAction, result: McpServerOperationExecutionResult): string {
  switch (action) {
    case "connect":
      return result.status.connected ? "MCP server connected" : "MCP server connection recorded";
    case "reconnect":
      return result.status.connected ? "MCP server reconnected" : "MCP server reconnect recorded";
    case "disconnect":
      return result.status.connected ? "MCP server disconnect incomplete" : "MCP server disconnected";
    case "create-local-server":
      return isCreateResult(result) && result.created ? "Local MCP server created" : "Local MCP server creation recorded";
    default:
      return "MCP server operation recorded";
  }
}

function describePendingHeadline(action: McpServerOperationAction): string {
  switch (action) {
    case "connect":
      return "Connecting MCP server";
    case "reconnect":
      return "Reconnecting MCP server";
    case "disconnect":
      return "Disconnecting MCP server";
    case "create-local-server":
      return "Creating local MCP server";
    default:
      return "Running MCP server operation";
  }
}

function describePendingDetail(action: McpServerOperationAction): string {
  switch (action) {
    case "connect":
      return "The MCP runtime manager has accepted the connect request.";
    case "reconnect":
      return "The MCP runtime manager has accepted the reconnect request.";
    case "disconnect":
      return "The MCP runtime manager has accepted the disconnect request.";
    case "create-local-server":
      return "The MCP runtime manager has accepted the local-server provisioning request.";
    default:
      return "The MCP runtime manager has accepted the request.";
  }
}

function describeOperationDetail(
  action: McpServerOperationAction,
  result: McpServerOperationExecutionResult,
): string {
  const primaryError = extractPrimaryError(result);
  if (primaryError) {
    return primaryError;
  }

  const status = result.status;
  const runtimeState = result.runtime.state;
  const lifecycle = status.lifecycleState ? ` Lifecycle ${status.lifecycleState}.` : "";
  const session = status.sessionState ? ` Session ${status.sessionState}.` : "";
  const transport = status.transport ? ` via ${status.transport}` : "";

  switch (action) {
    case "connect":
      return `${status.name} is ${status.connected ? "connected" : status.state}${transport}. Runtime ${runtimeState}.${lifecycle}${session}`.trim();
    case "reconnect":
      return `${status.name} reported ${status.state}${transport} after reconnect. Runtime ${runtimeState}.${lifecycle}${session}`.trim();
    case "disconnect":
      return `${status.name} is ${status.connected ? "still connected" : "disconnected"}${transport}. Runtime ${runtimeState}.${lifecycle}${session}`.trim();
    case "create-local-server":
      return isCreateResult(result) && result.created
        ? `${status.name} was created${transport} and reported ${status.state}. Runtime ${runtimeState}.${lifecycle}${session}`.trim()
        : `${status.name} provisioning completed without a new durable server record. Runtime ${runtimeState}.${lifecycle}${session}`.trim();
    default:
      return `${status.name} reported ${status.state}. Runtime ${runtimeState}.`;
  }
}

function extractPrimaryError(result: McpServerOperationExecutionResult): string | undefined {
  return result.status.errorMessage?.trim()
    || result.server.errorMessage?.trim()
    || (typeof result.runtime.metadata?.reason === "string" ? `MCP runtime reported ${result.runtime.metadata.reason.replace(/-/g, " ")}.` : undefined)
    || (result.runtime.state !== "ready" ? `MCP runtime state is ${result.runtime.state}.` : undefined);
}

function isCreateResult(result: McpServerOperationExecutionResult): result is LocalMcpServerCreateResult {
  return "created" in result;
}

export function freezeMcpServerOperationResult<TValue extends McpServerOperationExecutionResult>(value: TValue): TValue {
  return Object.freeze(JSON.parse(JSON.stringify(value)) as TValue);
}
