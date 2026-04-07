import type { McpConnectionStatus } from "./McpConnectionStatus";
import type { McpServerDescriptor } from "./McpServerDescriptor";
import type { McpServerStatus } from "./McpServerStatus";

export interface McpServerConnectionResult {
  readonly action: "connect" | "reconnect" | "disconnect";
  readonly server: McpServerDescriptor;
  readonly status: McpServerStatus;
  readonly runtime: McpConnectionStatus;
  readonly checkedAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
