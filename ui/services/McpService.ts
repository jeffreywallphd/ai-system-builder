import { ListMcpToolsUseCase } from "../../application/mcp/ListMcpToolsUseCase";
import type { IListMcpToolsResult } from "../../application/mcp/ListMcpToolsUseCase";

export class McpService {
  constructor(private readonly listMcpToolsUseCase: ListMcpToolsUseCase) {}

  public async getRuntimeSnapshot(): Promise<IListMcpToolsResult> {
    return this.listMcpToolsUseCase.execute();
  }
}
