export const ExecutionAuditEventKinds = Object.freeze({
  requested: "requested",
  accepted: "accepted",
  completed: "completed",
  failed: "failed",
  retryAttempted: "retry-attempted",
  retryExhausted: "retry-exhausted",
} as const);

export type ExecutionAuditEventKind = typeof ExecutionAuditEventKinds[keyof typeof ExecutionAuditEventKinds];

export interface ExecutionAuditRecord {
  readonly auditId: string;
  readonly occurredAt: string;
  readonly eventKind: ExecutionAuditEventKind;
  readonly requestSource: "external-api" | "external-tool" | "studio-shell-internal" | "internal-trusted" | "unknown";
  readonly caller: {
    readonly callerKind?: string;
    readonly callerId?: string;
    readonly sessionId?: string;
    readonly roles?: ReadonlyArray<string>;
    readonly authenticatedPrincipalId?: string;
  };
  readonly tenant: {
    readonly tenantId?: string;
    readonly source?: string;
  };
  readonly execution: {
    readonly executionId: string;
    readonly sessionId?: string;
    readonly status?: string;
    readonly systemId?: string;
    readonly versionId?: string;
    readonly parentExecutionId?: string;
    readonly childExecutionIds?: ReadonlyArray<string>;
  };
  readonly metadata?: Readonly<Record<string, string>>;
  readonly detail?: {
    readonly message?: string;
    readonly errorCode?: string;
    readonly retryAttempt?: number;
    readonly retryMaxAttempts?: number;
    readonly retryClassification?: string;
  };
}

export function createExecutionAuditRecord(input: Omit<ExecutionAuditRecord, "auditId" | "occurredAt"> & {
  readonly auditId?: string;
  readonly occurredAt?: string;
}): ExecutionAuditRecord {
  const now = input.occurredAt ?? new Date().toISOString();
  const auditId = input.auditId?.trim() || `exec-audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return Object.freeze({
    ...input,
    auditId,
    occurredAt: now,
    caller: Object.freeze({
      ...input.caller,
      roles: input.caller.roles ? Object.freeze([...input.caller.roles]) : undefined,
    }),
    tenant: Object.freeze({ ...input.tenant }),
    execution: Object.freeze({
      ...input.execution,
      childExecutionIds: input.execution.childExecutionIds
        ? Object.freeze([...new Set(input.execution.childExecutionIds)].sort((left, right) => left.localeCompare(right)))
        : undefined,
    }),
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    detail: input.detail ? Object.freeze({ ...input.detail }) : undefined,
  });
}
