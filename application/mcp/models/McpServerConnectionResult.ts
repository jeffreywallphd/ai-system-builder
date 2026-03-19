import type { McpConnectionStatus } from "./McpConnectionStatus";
import type { McpServerDescriptor } from "./McpServerDescriptor";

export interface McpServerConnectionResult {
  readonly action: "connect" | "reconnect" | "disconnect";
  readonly server: McpServerDescriptor;
  readonly status: McpConnectionStatus;
  readonly checkedAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
