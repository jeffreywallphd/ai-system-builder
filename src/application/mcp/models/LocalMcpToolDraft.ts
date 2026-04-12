export interface LocalMcpToolDraft {
  readonly serverId: string;
  readonly serverName: string;
  readonly serverDescription?: string;
  readonly toolName: string;
  readonly toolTitle?: string;
  readonly toolDescription?: string;
  readonly inputSchema?: Readonly<Record<string, unknown>>;
  readonly outputSchema?: Readonly<Record<string, unknown>>;
  readonly code: string;
  readonly connectOnStartup?: boolean;
  readonly timeoutMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
