import type { McpServerDescriptor } from "./McpServerDescriptor";
import type { McpToolDescriptor, McpPromptDescriptor } from "./McpToolDescriptor";
import type { McpResourceDescriptor } from "./McpResourceDescriptor";

export interface McpServerSnapshot {
  readonly server: McpServerDescriptor;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly resources: ReadonlyArray<McpResourceDescriptor>;
  readonly prompts?: ReadonlyArray<McpPromptDescriptor>;
}

export interface McpSyncResult {
  readonly serverId: string;
  readonly success: boolean;
  readonly checkedAt: string;
  readonly snapshot?: McpServerSnapshot;
  readonly errorMessage?: string;
}
