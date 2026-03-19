import type { McpServerStatus } from "./McpServerStatus";

export interface McpConnectionStatus {
  readonly enabled: boolean;
  readonly state: "disabled" | "ready" | "degraded" | "unavailable";
  readonly checkedAt: string;
  readonly servers: ReadonlyArray<McpServerStatus>;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
