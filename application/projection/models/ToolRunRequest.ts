export interface ToolRunRequest {
  readonly toolId: string;
  readonly values: Readonly<Record<string, unknown>>;
}
