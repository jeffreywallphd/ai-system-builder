import type { McpConnectionStatus } from "./McpConnectionStatus";
import type { McpServerDescriptor } from "./McpServerDescriptor";
import type { McpServerStatus } from "./McpServerStatus";

export interface LocalMcpServerCreateResult {
  readonly server: McpServerDescriptor;
  readonly status: McpServerStatus;
  readonly runtime: McpConnectionStatus;
  readonly checkedAt: string;
  readonly created: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
