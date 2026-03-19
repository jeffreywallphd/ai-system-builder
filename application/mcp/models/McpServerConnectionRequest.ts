export interface McpServerConnectionRequest {
  readonly serverId: string;
  readonly reconnect?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
