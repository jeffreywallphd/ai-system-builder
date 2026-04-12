import type { McpServerStatus } from "./McpServerStatus";

export interface McpServerValidationResult {
  readonly valid: boolean;
  readonly checkedAt: string;
  readonly issues: ReadonlyArray<{
    readonly code: string;
    readonly message: string;
    readonly severity: "info" | "warning" | "error";
    readonly field?: string;
  }>;
  readonly normalizedServer?: Readonly<Record<string, unknown>>;
}

export interface McpServerDescriptor {
  readonly id: string;
  readonly name: string;
  readonly transport: "stdio" | "http" | "sse" | "inmemory";
  readonly sourceType?: "builtin-local" | "workspace-local" | "external-remote" | "imported";
  readonly enabled?: boolean;
  readonly command?: string;
  readonly args?: ReadonlyArray<string>;
  readonly url?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly connectOnStartup?: boolean;
  readonly status: McpServerStatus["state"];
  readonly lifecycleState?: McpServerStatus["lifecycleState"];
  readonly sessionState?: McpServerStatus["sessionState"];
  readonly connected?: boolean;
  readonly reachable?: boolean;
  readonly configValid?: boolean;
  readonly checkedAt?: string;
  readonly connectedAt?: string;
  readonly disconnectedAt?: string;
  readonly lastSyncAt?: string;
  readonly toolCount: number;
  readonly resourceCount: number;
  readonly promptCount?: number;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly validation?: McpServerValidationResult;
  readonly errorMessage?: string;
}
