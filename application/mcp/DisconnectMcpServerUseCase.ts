import type { UnifiedExecutionEngine } from "../execution/UnifiedExecutionEngine";
import {
  createMcpServerOperationExecutionPlan,
  requireMcpServerOperationResult,
} from "../execution/McpServerOperationExecutionPlanFactory";
import type { IMcpServerManager } from "../ports/interfaces/IMcpServerManager";
import type { McpServerConnectionResult } from "./models/McpServerConnectionResult";

export interface IDisconnectMcpServerRequest {
  readonly serverId: string;
}

export class DisconnectMcpServerUseCase {
  constructor(
    private readonly serverManager: IMcpServerManager,
    private readonly executionEngine?: UnifiedExecutionEngine,
  ) {}

  public async execute(request: IDisconnectMcpServerRequest): Promise<McpServerConnectionResult> {
    const serverId = request.serverId.trim();
    if (!serverId) {
      throw new Error("Disconnecting an MCP server requires a serverId.");
    }

    if (this.executionEngine) {
      const executionPlan = createMcpServerOperationExecutionPlan({ action: "disconnect", serverId });
      const result = await this.executionEngine.execute(executionPlan);
      return requireMcpServerOperationResult(result, executionPlan.unitId) as McpServerConnectionResult;
    }

    return this.serverManager.disconnectServer(serverId);
  }
}
