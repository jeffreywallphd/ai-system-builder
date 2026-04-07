import { ExecutionStatuses, ExecutionUnitKinds } from "../../src/domain/execution/ExecutionPlan";
import type { IMcpServerManager } from "../../application/ports/interfaces/IMcpServerManager";
import type { IExecutionEngineEvent } from "../../application/execution/ExecutionContracts";
import type {
  IExecutionUnitExecutionRequest,
  IExecutionUnitExecutionResult,
  IExecutionUnitHandler,
} from "../../application/execution/UnifiedExecutionEngine";
import type {
  McpServerOperationAction,
  McpServerOperationExecutionInput,
  McpServerOperationExecutionResult,
} from "../../application/execution/McpServerOperationExecutionPlanFactory";
import {
  createMcpServerOperationExecutionArtifact,
  freezeMcpServerOperationResult,
  McpServerOperationExecutionArtifacts,
  toMcpServerOperationDiagnostics,
  toMcpServerOperationExecutionProvenance,
  toMcpServerOperationOutputMetadata,
  toMcpServerOperationOutputSummary,
} from "../../application/execution/McpServerOperationExecutionAdapter";

function toExecutionStatus(
  action: McpServerOperationAction,
  result: McpServerOperationExecutionResult,
): IExecutionUnitExecutionResult["status"] {
  const hasError = Boolean(result.status.errorMessage || result.server.errorMessage);
  const outcomeMismatch = (action === "connect" || action === "reconnect")
    ? !result.status.connected
    : action === "disconnect"
      ? result.status.connected
      : false;

  if (hasError || outcomeMismatch || result.runtime.state === "disabled" || result.runtime.state === "unavailable") {
    return ExecutionStatuses.failed;
  }
  return ExecutionStatuses.completed;
}

function toExecutionEvent(
  request: IExecutionUnitExecutionRequest,
  input: McpServerOperationExecutionInput,
): IExecutionEngineEvent {
  return Object.freeze({
    planId: request.plan.id,
    runId: request.runId,
    unitId: request.unit.id,
    status: ExecutionStatuses.running,
    message: describeStartMessage(input.action),
    outputMetadata: toMcpServerOperationOutputMetadata(input.action, input),
    outputSummary: toMcpServerOperationOutputSummary(input.action),
  });
}

export class McpServerOperationExecutionUnitHandler implements IExecutionUnitHandler {
  constructor(private readonly serverManager: IMcpServerManager) {}

  public canHandle(unit: IExecutionUnitExecutionRequest["unit"]): boolean {
    return unit.kind === ExecutionUnitKinds.mcpServerOperation;
  }

  public async execute(
    request: IExecutionUnitExecutionRequest,
    onEvent?: (event: IExecutionEngineEvent) => void,
  ): Promise<IExecutionUnitExecutionResult> {
    const input = request.unitInputs?.[request.unit.id] as McpServerOperationExecutionInput | undefined;
    if (!input) {
      throw new Error(`Execution unit '${request.unit.id}' is missing MCP server-operation input.`);
    }

    onEvent?.(toExecutionEvent(request, input));
    const result = freezeMcpServerOperationResult(await this.executeOperation(input));

    return Object.freeze({
      unitId: request.unit.id,
      status: toExecutionStatus(input.action, result),
      outputMetadata: toMcpServerOperationOutputMetadata(input.action, input, result),
      outputSummary: toMcpServerOperationOutputSummary(input.action, result),
      errorMessage: toExecutionStatus(input.action, result) === ExecutionStatuses.failed
        ? result.status.errorMessage
          ?? result.server.errorMessage
          ?? describeOutcomeMismatch(input.action, result)
          ?? `The MCP runtime could not complete '${input.action}'.`
        : undefined,
      provenance: toMcpServerOperationExecutionProvenance(input.action, result),
      diagnostics: toMcpServerOperationDiagnostics(result),
      artifacts: Object.freeze([
        createMcpServerOperationExecutionArtifact(McpServerOperationExecutionArtifacts.operationResult, result),
      ]),
    });
  }

  private async executeOperation(
    input: McpServerOperationExecutionInput,
  ): Promise<McpServerOperationExecutionResult> {
    switch (input.action) {
      case "connect":
        return this.serverManager.connectServer({ serverId: input.serverId });
      case "reconnect":
        return this.serverManager.reconnectServer(input.serverId);
      case "disconnect":
        return this.serverManager.disconnectServer(input.serverId);
      case "create-local-server":
        return this.serverManager.createLocalServer(input.draft);
      default:
        throw new Error(`Unsupported MCP server operation '${String((input as { action?: string }).action)}'.`);
    }
  }
}

function describeStartMessage(action: McpServerOperationAction): string {
  switch (action) {
    case "connect":
      return "Submitting MCP server connect request.";
    case "reconnect":
      return "Submitting MCP server reconnect request.";
    case "disconnect":
      return "Submitting MCP server disconnect request.";
    case "create-local-server":
      return "Submitting local MCP server provisioning request.";
    default:
      return "Submitting MCP server operation request.";
  }
}

function describeOutcomeMismatch(
  action: McpServerOperationAction,
  result: McpServerOperationExecutionResult,
): string | undefined {
  if ((action === "connect" || action === "reconnect") && !result.status.connected) {
    return `${result.status.name} did not report a connected session after '${action}'.`;
  }

  if (action === "disconnect" && result.status.connected) {
    return `${result.status.name} still reports a connected session after 'disconnect'.`;
  }

  return undefined;
}
