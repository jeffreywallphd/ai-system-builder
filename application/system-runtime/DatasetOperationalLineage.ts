export const DatasetOperationalLineageEventKinds = Object.freeze({
  previewAccess: "preview-access",
  recordRead: "record-read",
  recordQuery: "record-query",
  recordWrite: "record-write",
} as const);

export type DatasetOperationalLineageEventKind =
  typeof DatasetOperationalLineageEventKinds[keyof typeof DatasetOperationalLineageEventKinds];

export interface DatasetOperationalLineageContext {
  readonly workflowAssetId?: string;
  readonly workflowExecutionId?: string;
  readonly studioId?: string;
  readonly actorId?: string;
  readonly source?: string;
}

export interface DatasetOperationalLineageEvent {
  readonly eventId: string;
  readonly eventKind: DatasetOperationalLineageEventKind;
  readonly systemId: string;
  readonly instanceId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly recordId?: string;
  readonly recordIds?: ReadonlyArray<string>;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly operation?: string;
  readonly resultCount?: number;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly context?: DatasetOperationalLineageContext;
  readonly occurredAt: string;
}

export interface RecordDatasetOperationalLineageInput {
  readonly eventKind: DatasetOperationalLineageEventKind;
  readonly systemId: string;
  readonly instanceId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly recordId?: string;
  readonly recordIds?: ReadonlyArray<string>;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly operation?: string;
  readonly resultCount?: number;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly context?: DatasetOperationalLineageContext;
  readonly occurredAt?: string;
}

export interface DatasetOperationalLineageSink {
  record(input: RecordDatasetOperationalLineageInput): DatasetOperationalLineageEvent;
}

export class InMemoryDatasetOperationalLineageSink implements DatasetOperationalLineageSink {
  private readonly events: DatasetOperationalLineageEvent[] = [];

  public constructor(private readonly maxEvents = 2000) {}

  public record(input: RecordDatasetOperationalLineageInput): DatasetOperationalLineageEvent {
    const event = createDatasetOperationalLineageEvent(input);
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
    return event;
  }

  public listRecent(limit?: number): ReadonlyArray<DatasetOperationalLineageEvent> {
    const normalizedLimit = typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(1, Math.floor(limit))
      : this.events.length;
    return Object.freeze(this.events.slice(Math.max(0, this.events.length - normalizedLimit)));
  }
}

export function createDatasetOperationalLineageEvent(
  input: RecordDatasetOperationalLineageInput,
): DatasetOperationalLineageEvent {
  const occurredAt = normalizeTimestamp(input.occurredAt);
  const recordIds = normalizeStringList(input.recordIds);

  return Object.freeze({
    eventId: `${occurredAt}:${Math.random().toString(36).slice(2, 10)}`,
    eventKind: input.eventKind,
    systemId: normalizeRequired(input.systemId, "systemId"),
    instanceId: normalizeRequired(input.instanceId, "instanceId"),
    datasetAssetId: normalizeRequired(input.datasetAssetId, "datasetAssetId"),
    datasetAssetVersionId: normalizeOptional(input.datasetAssetVersionId),
    recordId: normalizeOptional(input.recordId),
    recordIds,
    query: input.query ? Object.freeze({ ...input.query }) : undefined,
    operation: normalizeOptional(input.operation),
    resultCount: typeof input.resultCount === "number" && Number.isFinite(input.resultCount)
      ? Math.max(0, Math.floor(input.resultCount))
      : undefined,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    context: normalizeContext(input.context),
    occurredAt,
  });
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeContext(context?: DatasetOperationalLineageContext): DatasetOperationalLineageContext | undefined {
  if (!context) {
    return undefined;
  }
  const normalized = Object.freeze({
    workflowAssetId: normalizeOptional(context.workflowAssetId),
    workflowExecutionId: normalizeOptional(context.workflowExecutionId),
    studioId: normalizeOptional(context.studioId),
    actorId: normalizeOptional(context.actorId),
    source: normalizeOptional(context.source),
  });
  if (!normalized.workflowAssetId
    && !normalized.workflowExecutionId
    && !normalized.studioId
    && !normalized.actorId
    && !normalized.source) {
    return undefined;
  }
  return normalized;
}

function normalizeTimestamp(value?: string): string {
  const normalized = normalizeOptional(value) ?? new Date().toISOString();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("occurredAt must be a valid timestamp.");
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}
