import type { McpServerDescriptor } from "./models/McpServerDescriptor";
import type { IMcpServerCatalog } from "../ports/interfaces/IMcpServerCatalog";

export class ListConfiguredMcpServersUseCase {
  constructor(private readonly catalog: IMcpServerCatalog) {}

  public async execute(): Promise<ReadonlyArray<McpServerDescriptor>> {
    const servers = await this.catalog.listConfiguredServers();
    return Object.freeze([...servers]);
  }
}
