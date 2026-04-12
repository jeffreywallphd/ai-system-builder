import type { IMcpToolExecutionAuditSink, McpToolExecutionAuditEvent } from "@application/ports/interfaces/IMcpToolExecutionAuditSink";

const defaultStorageKey = "ai-loom-studio.mcp-tool-execution-audit";

export class LocalStorageMcpToolExecutionAuditSink implements IMcpToolExecutionAuditSink {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage = typeof window !== "undefined" ? window.localStorage : undefined,
    private readonly maxEntries = 200,
  ) {}

  public async record(event: McpToolExecutionAuditEvent): Promise<void> {
    const current = this.readEntries();
    const next = Object.freeze([...current, sanitizeEvent(event)].slice(-this.maxEntries));
    this.storage?.setItem(this.storageKey, JSON.stringify(next));
  }

  private readEntries(): ReadonlyArray<McpToolExecutionAuditEvent> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return Object.freeze([]);
    }
    try {
      return Object.freeze(JSON.parse(raw) as ReadonlyArray<McpToolExecutionAuditEvent>);
    } catch {
      return Object.freeze([]);
    }
  }
}

function sanitizeEvent(event: McpToolExecutionAuditEvent): McpToolExecutionAuditEvent {
  return Object.freeze({
    ...event,
    metadata: event.metadata ? Object.freeze({ ...event.metadata }) : undefined,
  });
}

