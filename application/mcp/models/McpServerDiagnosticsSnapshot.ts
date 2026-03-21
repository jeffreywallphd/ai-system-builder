export interface McpServerDiagnosticsEntry {
  readonly timestamp: string;
  readonly severity: "debug" | "info" | "warning" | "error";
  readonly event: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface McpServerDiagnosticsSnapshot {
  readonly serverId: string;
  readonly checkedAt: string;
  readonly runtimeHealthy: boolean;
  readonly sessionState: "disconnected" | "connecting" | "connected" | "stale" | "error";
  readonly entries: ReadonlyArray<McpServerDiagnosticsEntry>;
  readonly retainedEntryCount: number;
  readonly lastError?: string;
}
