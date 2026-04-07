export interface McpServerStatus {
  readonly serverId: string;
  readonly name: string;
  readonly transport: "stdio" | "http" | "sse" | "inmemory";
  readonly sourceType?: "builtin-local" | "workspace-local" | "external-remote" | "imported";
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly state: "connected" | "connecting" | "disconnected" | "error";
  readonly lifecycleState?: "stopped" | "starting" | "running" | "stopping" | "error";
  readonly sessionState?: "disconnected" | "connecting" | "connected" | "stale" | "error";
  readonly connected: boolean;
  readonly reachable?: boolean;
  readonly configValid?: boolean;
  readonly checkedAt: string;
  readonly connectedAt?: string;
  readonly disconnectedAt?: string;
  readonly lastSyncAt?: string;
  readonly toolCount: number;
  readonly resourceCount: number;
  readonly promptCount?: number;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly errorMessage?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
