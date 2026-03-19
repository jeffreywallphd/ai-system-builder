export interface McpToolSearchQuery {
  readonly query?: string;
  readonly serverIds?: ReadonlyArray<string>;
  readonly categories?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
}
