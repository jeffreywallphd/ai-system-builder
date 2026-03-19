import type { McpServerStatus } from "./McpServerStatus";

export interface McpServerDescriptor {
  readonly id: string;
  readonly name: string;
  readonly transport: "stdio" | "http" | "sse" | "inmemory";
  readonly enabled?: boolean;
  readonly command?: string;
  readonly args?: ReadonlyArray<string>;
  readonly url?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly connectOnStartup?: boolean;
  readonly status: McpServerStatus["state"];
  readonly connected?: boolean;
  readonly checkedAt?: string;
  readonly connectedAt?: string;
  readonly disconnectedAt?: string;
  readonly toolCount: number;
  readonly resourceCount: number;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
}
