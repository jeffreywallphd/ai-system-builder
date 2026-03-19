import type { McpServerDescriptor } from "./McpServerDescriptor";

export interface McpServerSearchCriteria {
  readonly query?: string;
  readonly statuses?: ReadonlyArray<McpServerDescriptor["status"]>;
  readonly transports?: ReadonlyArray<McpServerDescriptor["transport"]>;
  readonly limit?: number;
}
