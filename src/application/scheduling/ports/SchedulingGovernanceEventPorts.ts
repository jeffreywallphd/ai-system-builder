export const SchedulingGovernanceEventChannels = Object.freeze({
  audit: "audit",
  operational: "operational",
});

export type SchedulingGovernanceEventChannel =
  typeof SchedulingGovernanceEventChannels[keyof typeof SchedulingGovernanceEventChannels];

export const SchedulingGovernanceEventTypes = Object.freeze({
  priorityPlacementSelected: "scheduling-priority-placement-selected",
  deferredNoPlacement: "scheduling-deferred-no-placement",
  reservationConflict: "scheduling-reservation-conflict",
  assignmentMaterializationConflict: "scheduling-assignment-materialization-conflict",
});

export type SchedulingGovernanceEventType =
  typeof SchedulingGovernanceEventTypes[keyof typeof SchedulingGovernanceEventTypes];

export interface SchedulingGovernanceEvent {
  readonly channel: SchedulingGovernanceEventChannel;
  readonly type: SchedulingGovernanceEventType;
  readonly occurredAt: string;
  readonly outcome: "succeeded" | "deferred" | "conflict" | "rejected";
  readonly decisionId?: string;
  readonly reservationOwner?: string;
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly workspaceId?: string;
  readonly runId?: string;
  readonly nodeId?: string;
  readonly queueId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ISchedulingGovernanceEventSink {
  recordSchedulingGovernanceEvent(event: SchedulingGovernanceEvent): Promise<void>;
}

const SensitiveSchedulingDetailKeyPattern = /(prompt|parameter|payload|token|secret|diagnostic|internal|claim[-_]?token)/i;
const MaxSchedulingGovernanceStringLength = 256;
const MaxSchedulingGovernanceArrayLength = 20;
const MaxSchedulingGovernanceObjectEntries = 24;

export async function publishSchedulingGovernanceEventBestEffort(
  sink: ISchedulingGovernanceEventSink | undefined,
  event: SchedulingGovernanceEvent,
): Promise<void> {
  if (!sink) {
    return;
  }

  try {
    await sink.recordSchedulingGovernanceEvent(sanitizeSchedulingGovernanceEvent(event));
  } catch {
    // Scheduling governance publication is best-effort and must not alter orchestration control flow.
  }
}

function sanitizeSchedulingGovernanceEvent(event: SchedulingGovernanceEvent): SchedulingGovernanceEvent {
  return Object.freeze({
    channel: event.channel,
    type: event.type,
    occurredAt: normalizeSchedulingEventRequired(event.occurredAt, "occurredAt"),
    outcome: event.outcome,
    decisionId: normalizeSchedulingEventOptional(event.decisionId),
    reservationOwner: normalizeSchedulingEventOptional(event.reservationOwner),
    actorUserIdentityId: normalizeSchedulingEventOptional(event.actorUserIdentityId),
    actorServiceId: normalizeSchedulingEventOptional(event.actorServiceId),
    workspaceId: normalizeSchedulingEventOptional(event.workspaceId),
    runId: normalizeSchedulingEventOptional(event.runId),
    nodeId: normalizeSchedulingEventOptional(event.nodeId),
    queueId: normalizeSchedulingEventOptional(event.queueId),
    details: sanitizeSchedulingEventDetails(event.details),
  });
}

function sanitizeSchedulingEventDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details).slice(0, MaxSchedulingGovernanceObjectEntries)) {
    if (SensitiveSchedulingDetailKeyPattern.test(key)) {
      continue;
    }
    output[key] = sanitizeSchedulingEventUnknown(value);
  }

  return Object.freeze(output);
}

function sanitizeSchedulingEventUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MaxSchedulingGovernanceStringLength
      ? `${value.slice(0, MaxSchedulingGovernanceStringLength)}...`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, MaxSchedulingGovernanceArrayLength).map((entry) => sanitizeSchedulingEventUnknown(entry)));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, MaxSchedulingGovernanceObjectEntries)) {
      if (SensitiveSchedulingDetailKeyPattern.test(key)) {
        continue;
      }
      output[key] = sanitizeSchedulingEventUnknown(nestedValue);
    }
    return Object.freeze(output);
  }

  return String(value);
}

function normalizeSchedulingEventRequired(value: string, field: string): string {
  const normalized = normalizeSchedulingEventOptional(value);
  if (!normalized) {
    throw new Error(`Scheduling governance event requires non-empty ${field}.`);
  }
  return normalized;
}

function normalizeSchedulingEventOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
