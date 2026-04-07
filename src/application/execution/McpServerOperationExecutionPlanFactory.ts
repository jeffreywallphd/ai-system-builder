import { ExecutionPlan, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import type { LocalMcpToolDraft } from "../mcp/models/LocalMcpToolDraft";
import type { LocalMcpServerCreateResult } from "../mcp/models/LocalMcpServerCreateResult";
import type { McpServerConnectionResult } from "../mcp/models/McpServerConnectionResult";
import type { IExecutionPlanResult, IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";
import { getMcpServerOperationResult } from "./McpServerOperationExecutionAdapter";
import { ExecutionRuntimeCapabilityProfiles, toExecutionRuntimeCapabilityMetadata } from "./ExecutionRuntimeCapabilities";

export type McpServerOperationAction = "connect" | "reconnect" | "disconnect" | "create-local-server";

export type McpServerOperationExecutionInput =
  | Readonly<{
      action: "connect" | "reconnect" | "disconnect";
      serverId: string;
    }>
  | Readonly<{
      action: "create-local-server";
      draft: LocalMcpToolDraft;
    }>;

export type McpServerOperationExecutionResult = McpServerConnectionResult | LocalMcpServerCreateResult;

export interface IMcpServerOperationExecutionPlanEnvelope {
  readonly unitId: string;
  readonly terminalUnitId: string;
  readonly plan: ExecutionPlan;
  readonly unitInputs: Readonly<Record<string, McpServerOperationExecutionInput>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createMcpServerOperationExecutionPlan(
  input: McpServerOperationExecutionInput,
): IMcpServerOperationExecutionPlanEnvelope {
  const action = input.action;
  const serverId = resolveServerId(input);
  const unitId = `mcp-server-operation:${action}:${serverId}`;

  return Object.freeze({
    unitId,
    terminalUnitId: unitId,
    plan: new ExecutionPlan({
      id: `mcp-server-operation:${action}:${serverId}`,
      units: [
        {
          id: unitId,
          kind: ExecutionUnitKinds.mcpServerOperation,
          label: describeLabel(action, input),
        },
      ],
    }),
    unitInputs: Object.freeze({
      [unitId]: Object.freeze(cloneInput(input)),
    }),
    metadata: Object.freeze({
      executionKind: ExecutionUnitKinds.mcpServerOperation,
      mcpAction: action,
      serverId,
      serverName: action === "create-local-server" ? input.draft.serverName.trim() : serverId,
      truthfulnessSummary: "Delegated to the MCP runtime manager and recorded using durable execution-run history.",
      workspaceLocal: action === "create-local-server" ? input.draft.metadata?.authoringMode === "workspace-local" : false,
      runtimeCapabilities: toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.mcpServerOperation),
      ...toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.mcpServerOperation),
    }),
  });
}

export function createMcpServerProvisionAndConnectExecutionPlan(
  draft: LocalMcpToolDraft,
): IMcpServerOperationExecutionPlanEnvelope {
  const serverId = draft.serverId.trim();
  const createUnitId = `mcp-server-operation:create-local-server:${serverId}`;
  const connectUnitId = `mcp-server-operation:connect:${serverId}`;
  const flowId = `mcp-provision-connect:${serverId}:${Date.now()}`;

  return Object.freeze({
    unitId: createUnitId,
    terminalUnitId: connectUnitId,
    plan: new ExecutionPlan({
      id: `mcp-provision-connect:${serverId}`,
      units: [
        {
          id: createUnitId,
          kind: ExecutionUnitKinds.mcpServerOperation,
          label: describeLabel("create-local-server", { action: "create-local-server", draft }),
        },
        {
          id: connectUnitId,
          kind: ExecutionUnitKinds.mcpServerOperation,
          label: describeLabel("connect", { action: "connect", serverId }),
          dependsOn: [createUnitId],
        },
      ],
    }),
    unitInputs: Object.freeze({
      [createUnitId]: Object.freeze(cloneInput({ action: "create-local-server", draft })),
      [connectUnitId]: Object.freeze(cloneInput({ action: "connect", serverId })),
    }),
    metadata: Object.freeze({
      executionKind: ExecutionUnitKinds.mcpServerOperation,
      executionFlowId: flowId,
      mcpAction: "create-local-server-and-connect",
      serverId,
      serverName: draft.serverName.trim(),
      truthfulnessSummary: "Delegated to the MCP runtime manager as a dependency-aware provisioning and connection plan.",
      workspaceLocal: draft.metadata?.authoringMode === "workspace-local",
      runtimeCapabilities: toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.mcpProvisionAndConnect),
      ...toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.mcpProvisionAndConnect),
    }),
  });
}

export function requireMcpServerOperationResult(
  planResult: IExecutionPlanResult,
  unitId: string,
): McpServerOperationExecutionResult {
  const result = getMcpServerOperationResult(planResult.unitResults[unitId]);
  if (!result) {
    throw new Error(`Execution plan '${planResult.planId}' did not return an MCP server operation result.`);
  }
  return result;
}

export function requireMcpServerOperationResultFromUnitResult(
  result: IExecutionUnitExecutionResult,
): McpServerOperationExecutionResult {
  const operationResult = getMcpServerOperationResult(result);
  if (!operationResult) {
    throw new Error(`Execution unit '${result.unitId}' did not return an MCP server operation result.`);
  }
  return operationResult;
}

function resolveServerId(input: McpServerOperationExecutionInput): string {
  return input.action === "create-local-server"
    ? input.draft.serverId.trim()
    : input.serverId.trim();
}

function describeLabel(action: McpServerOperationAction, input: McpServerOperationExecutionInput): string {
  const serverName = input.action === "create-local-server"
    ? input.draft.serverName.trim() || input.draft.serverId.trim()
    : input.serverId.trim();

  switch (action) {
    case "connect":
      return `Connect MCP server ${serverName}`;
    case "reconnect":
      return `Reconnect MCP server ${serverName}`;
    case "disconnect":
      return `Disconnect MCP server ${serverName}`;
    case "create-local-server":
      return `Create local MCP server ${serverName}`;
    default:
      return serverName;
  }
}

function cloneInput(input: McpServerOperationExecutionInput): McpServerOperationExecutionInput {
  if (input.action !== "create-local-server") {
    return {
      action: input.action,
      serverId: input.serverId.trim(),
    };
  }

  return {
    action: input.action,
    draft: Object.freeze(JSON.parse(JSON.stringify(input.draft)) as LocalMcpToolDraft),
  };
}

