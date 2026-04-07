import type { DatasetEvent, DatasetEventType } from "@domain/dataset-studio/contracts/DatasetEvent";

export interface DatasetEventPreviewModel {
  readonly eventId: string;
  readonly eventType: DatasetEventType;
  readonly summary: string;
  readonly occurredAt: string;
  readonly datasetAssetId: string;
  readonly datasetVersionId?: string;
  readonly datasetInstanceId?: string;
  readonly recordId?: string;
  readonly selectionId?: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface DatasetEventDiagnosticsOptions {
  readonly capacity?: number;
  readonly metadataLimit?: number;
}

export function buildDatasetEventPreviewModel(
  event: DatasetEvent,
  options: { readonly metadataLimit?: number } = {},
): DatasetEventPreviewModel {
  const metadataLimit = options.metadataLimit && options.metadataLimit > 0 ? options.metadataLimit : 8;
  const metadata = buildBoundedMetadata(event, metadataLimit);
  const recordId = event.payload.record.recordId;
  const selectionId = event.payload.record.selectionId;
  const datasetInstanceId = event.instance?.instanceId;

  const summary = [
    event.eventType,
    `dataset=${event.dataset.assetId}`,
    datasetInstanceId ? `instance=${datasetInstanceId}` : undefined,
    recordId ? `record=${recordId}` : undefined,
    selectionId ? `selection=${selectionId}` : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0).join(" | ");

  return Object.freeze({
    eventId: event.eventId,
    eventType: event.eventType,
    summary,
    occurredAt: event.occurredAt,
    datasetAssetId: event.dataset.assetId,
    datasetVersionId: event.dataset.versionId,
    datasetInstanceId,
    recordId,
    selectionId,
    metadata,
  });
}

function buildBoundedMetadata(event: DatasetEvent, metadataLimit: number): Readonly<Record<string, string>> {
  const maps: ReadonlyArray<Readonly<Record<string, unknown>> | undefined> = Object.freeze([
    event.actor.metadata,
    event.payloadMetadata?.lineage,
    event.payload.derivedMetadata,
  ]);

  const normalized: Record<string, string> = {};
  for (const map of maps) {
    if (!map) {
      continue;
    }

    for (const [key, value] of Object.entries(map)) {
      const normalizedKey = key.trim();
      if (!normalizedKey || normalizedKey in normalized) {
        continue;
      }
      if (typeof value === "string") {
        normalized[normalizedKey] = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        normalized[normalizedKey] = String(value);
      }

      if (Object.keys(normalized).length >= metadataLimit) {
        return Object.freeze(normalized);
      }
    }
  }

  return Object.freeze(normalized);
}

export class InMemoryDatasetEventDiagnosticsStore {
  private readonly capacity: number;
  private readonly metadataLimit: number;
  private readonly entries: DatasetEventPreviewModel[] = [];

  constructor(options: DatasetEventDiagnosticsOptions = {}) {
    this.capacity = options.capacity && options.capacity > 0 ? options.capacity : 250;
    this.metadataLimit = options.metadataLimit && options.metadataLimit > 0 ? options.metadataLimit : 8;
  }

  public record(event: DatasetEvent): DatasetEventPreviewModel {
    const preview = buildDatasetEventPreviewModel(event, { metadataLimit: this.metadataLimit });
    this.entries.push(preview);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    return preview;
  }

  public list(): ReadonlyArray<DatasetEventPreviewModel> {
    return Object.freeze([...this.entries]);
  }

  public clear(): void {
    this.entries.length = 0;
  }
}

