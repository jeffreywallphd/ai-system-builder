import type { IMcpToolCatalog } from "../ports/interfaces/IMcpToolCatalog";
import type { McpConnectionStatus } from "./models/McpConnectionStatus";
import type { McpToolDescriptor } from "./models/McpToolDescriptor";

export interface IListMcpToolsResult {
  readonly status: McpConnectionStatus;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
}

export class ListMcpToolsUseCase {
  private readonly catalog: IMcpToolCatalog;

  constructor(catalog: IMcpToolCatalog) {
    this.catalog = catalog;
  }

  public async execute(): Promise<IListMcpToolsResult> {
    const [status, tools] = await Promise.all([
      this.catalog.getConnectionStatus(),
      this.catalog.listTools(),
    ]);

    return Object.freeze({
      status,
      tools: Object.freeze([...tools]),
    });
  }
}
