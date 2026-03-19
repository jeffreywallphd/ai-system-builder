import type { McpConnectionStatus } from "./McpConnectionStatus";
import type { McpServerDescriptor } from "./McpServerDescriptor";

export interface McpServerSearchResult {
  readonly query: string;
  readonly totalCount: number;
  readonly limit: number;
  readonly servers: ReadonlyArray<McpServerDescriptor>;
  readonly status: McpConnectionStatus;
}
