import type { McpToolDescriptor } from "./McpToolDescriptor";

export interface McpToolSearchResult {
  readonly query: string;
  readonly totalCount: number;
  readonly limit: number;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
}
