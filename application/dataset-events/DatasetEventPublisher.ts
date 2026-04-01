import {
  DatasetEventContractVersions,
  createDatasetEvent,
  validateDatasetEventPayloadForType,
  type DatasetEvent,
  type DatasetEventActor,
  type DatasetEventContractVersion,
  type DatasetEventPayload,
  type DatasetEventPayloadMetadata,
  type DatasetEventType,
} from "../../domain/dataset-studio/contracts/DatasetEvent";
import type {
  DatasetAssetReference,
  DatasetInstanceReference,
} from "../../domain/dataset-studio/contracts/StudioDatasetCompatibility";

export interface PublishDatasetEventInput {
  readonly event: DatasetEvent;
}

export interface DatasetEventPublisher {
  publish(input: PublishDatasetEventInput): Promise<DatasetEvent> | DatasetEvent;
}

export interface CreateDatasetEventEnvelopeInput {
  readonly eventType: DatasetEventType;
  readonly dataset: DatasetAssetReference;
  readonly instance?: DatasetInstanceReference;
  readonly actor: DatasetEventActor;
  readonly payload: DatasetEventPayload;
  readonly payloadMetadata?: DatasetEventPayloadMetadata;
  readonly eventId?: string;
  readonly occurredAt?: string;
  readonly contractVersion?: DatasetEventContractVersion;
}

export function createDatasetEventEnvelope(input: CreateDatasetEventEnvelopeInput): DatasetEvent {
  const payload = validateDatasetEventPayloadForType(input.eventType, input.payload);
  return createDatasetEvent({
    eventId: input.eventId ?? createDatasetEventId(),
    eventType: input.eventType,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    contractVersion: input.contractVersion ?? DatasetEventContractVersions.v1,
    dataset: input.dataset,
    instance: input.instance,
    actor: input.actor,
    payload,
    payloadMetadata: input.payloadMetadata,
  });
}

export class InMemoryDatasetEventPublisher implements DatasetEventPublisher {
  private readonly events: DatasetEvent[] = [];

  public publish(input: PublishDatasetEventInput): DatasetEvent {
    const event = createDatasetEvent(input.event);
    this.events.push(event);
    return event;
  }

  public listPublishedEvents(): ReadonlyArray<DatasetEvent> {
    return Object.freeze([...this.events]);
  }

  public clear(): void {
    this.events.length = 0;
  }
}

function createDatasetEventId(): string {
  return `dataset-event-${Math.random().toString(36).slice(2, 12)}`;
}
