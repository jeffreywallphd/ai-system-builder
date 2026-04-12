import type { UnifiedExecutionEngine } from "../execution/UnifiedExecutionEngine";
import {
  createMcpServerOperationExecutionPlan,
  requireMcpServerOperationResult,
} from "../execution/McpServerOperationExecutionPlanFactory";
import type { IMcpServerManager } from "../ports/interfaces/IMcpServerManager";
import type { McpServerConnectionResult } from "./models/McpServerConnectionResult";

export interface IReconnectMcpServerRequest {
  readonly serverId: string;
}

export class ReconnectMcpServerUseCase {
  constructor(
    private readonly serverManager: IMcpServerManager,
    private readonly executionEngine?: UnifiedExecutionEngine,
  ) {}

  public async execute(request: IReconnectMcpServerRequest): Promise<McpServerConnectionResult> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("Reconnecting an MCP server requires a serverId.");
    }

    if (this.executionEngine) {
      const executionPlan = createMcpServerOperationExecutionPlan({ action: "reconnect", serverId });
      const result = await this.executionEngine.execute(executionPlan);
      return requireMcpServerOperationResult(result, executionPlan.unitId) as McpServerConnectionResult;
    }

    return this.serverManager.reconnectServer(serverId);
  }
}
