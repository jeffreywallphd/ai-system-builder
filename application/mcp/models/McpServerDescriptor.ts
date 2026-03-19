export interface McpServerDescriptor {
  readonly id: string;
  readonly name: string;
  readonly transport: "stdio" | "http" | "sse" | "inmemory";
  readonly status: "connected" | "connecting" | "disconnected" | "error";
  readonly toolCount: number;
  readonly resourceCount: number;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
}
