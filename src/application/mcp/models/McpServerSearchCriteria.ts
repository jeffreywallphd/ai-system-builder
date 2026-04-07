import type { McpServerDescriptor } from "./McpServerDescriptor";

export interface McpServerSearchCriteria {
  readonly query?: string;
  readonly statuses?: ReadonlyArray<McpServerDescriptor["status"]>;
  readonly transports?: ReadonlyArray<McpServerDescriptor["transport"]>;
  readonly sourceTypes?: ReadonlyArray<NonNullable<McpServerDescriptor["sourceType"]>>;
  readonly limit?: number;
}
