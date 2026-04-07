import type { IMcpServerCatalog } from "../ports/interfaces/IMcpServerCatalog";
import type { McpConnectionStatus } from "./models/McpConnectionStatus";

export class GetMcpConnectionStatusUseCase {
  constructor(private readonly catalog: IMcpServerCatalog) {}

  public async execute(): Promise<McpConnectionStatus> {
    return this.catalog.getConnectionStatus();
  }
}
