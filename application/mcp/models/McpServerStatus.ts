export interface McpServerStatus {
  readonly serverId: string;
  readonly name: string;
  readonly transport: "stdio" | "http" | "sse" | "inmemory";
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly state: "connected" | "connecting" | "disconnected" | "error";
  readonly connected: boolean;
  readonly checkedAt: string;
  readonly connectedAt?: string;
  readonly disconnectedAt?: string;
  readonly toolCount: number;
  readonly resourceCount: number;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly errorMessage?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
