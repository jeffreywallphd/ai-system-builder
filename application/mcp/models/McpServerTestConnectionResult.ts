import type { McpServerDiagnosticsEntry } from "./McpServerDiagnosticsSnapshot";

export interface McpServerTestConnectionResult {
  readonly serverId: string;
  readonly success: boolean;
  readonly checkedAt: string;
  readonly reachable: boolean;
  readonly handshakeSucceeded: boolean;
  readonly latencyMs?: number;
  readonly tools: number;
  readonly resources: number;
  readonly prompts: number;
  readonly errorMessage?: string;
  readonly diagnostics: ReadonlyArray<McpServerDiagnosticsEntry>;
}
