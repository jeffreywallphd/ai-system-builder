import type { IMcpToolCatalog } from "../ports/interfaces/IMcpToolCatalog";
import type { McpConnectionStatus } from "./models/McpConnectionStatus";
import type { McpResourceDescriptor } from "./models/McpResourceDescriptor";
import type { McpToolDescriptor } from "./models/McpToolDescriptor";

export interface IListMcpToolsResult {
  readonly status: McpConnectionStatus;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly resources: ReadonlyArray<McpResourceDescriptor>;
}

export class ListMcpToolsUseCase {
  private readonly catalog: IMcpToolCatalog;

  constructor(catalog: IMcpToolCatalog) {
    this.catalog = catalog;
  }

  public async execute(): Promise<IListMcpToolsResult> {
    const [status, tools, resources] = await Promise.all([
      this.catalog.getConnectionStatus(),
      this.catalog.listTools(),
      typeof this.catalog.listResources === "function"
        ? this.catalog.listResources()
        : Promise.resolve(Object.freeze([] as const)),
    ]);

    return Object.freeze({
      status,
      tools: Object.freeze([...tools]),
      resources: Object.freeze([...resources]),
    });
  }
}
