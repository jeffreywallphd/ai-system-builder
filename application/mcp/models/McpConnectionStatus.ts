import type { McpServerDescriptor } from "./McpServerDescriptor";

export interface McpConnectionStatus {
  readonly enabled: boolean;
  readonly state: "disabled" | "ready" | "degraded" | "unavailable";
  readonly checkedAt: string;
  readonly servers: ReadonlyArray<McpServerDescriptor>;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
