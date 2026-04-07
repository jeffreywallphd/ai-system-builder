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
} from "@domain/dataset-studio/contracts/DatasetEvent";
import type {
  DatasetAssetReference,
  DatasetInstanceReference,
} from "@domain/dataset-studio/contracts/StudioDatasetCompatibility";

export interface PublishDatasetEventInput {
  readonly event: DatasetEvent;
}

export type DatasetEventSubscription = () => void;

export type DatasetEventListener = (event: DatasetEvent) => void;

export interface DatasetEventDeliveryFailure {
  readonly eventId: string;
  readonly listenerIndex: number;
  readonly message: string;
  readonly occurredAt: string;
}

export interface InMemoryDatasetEventPublisherOptions {
  readonly deduplicationWindow?: number;
  readonly maxDeliveryFailures?: number;
}

export interface DatasetEventSubscriptionFilter {
  readonly eventTypes?: ReadonlyArray<DatasetEventType>;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
  readonly instanceId?: string;
  readonly systemId?: string;
  readonly recordId?: string;
  readonly selectionId?: string;
  readonly imageReference?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface SubscribeToDatasetEventsInput {
  readonly listener: DatasetEventListener;
  readonly filter?: DatasetEventSubscriptionFilter;
}

export interface DatasetEventPublisher {
  publish(input: PublishDatasetEventInput): Promise<DatasetEvent> | DatasetEvent;
}

export interface DatasetEventSubscriber {
  subscribe(input: SubscribeToDatasetEventsInput): DatasetEventSubscription;
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

interface InMemoryDatasetEventSubscriptionState {
  readonly listener: DatasetEventListener;
  readonly filter?: DatasetEventSubscriptionFilter;
}

export function matchesDatasetEventSubscriptionFilter(
  event: DatasetEvent,
  filter?: DatasetEventSubscriptionFilter,
): boolean {
  if (!filter) {
    return true;
  }

  if (filter.eventTypes && filter.eventTypes.length > 0 && !filter.eventTypes.includes(event.eventType)) {
    return false;
  }

  if (filter.datasetAssetId && event.dataset.assetId !== filter.datasetAssetId) {
    return false;
  }

  if (filter.datasetVersionId && event.dataset.versionId !== filter.datasetVersionId) {
    return false;
  }

  if (filter.instanceId && event.instance?.instanceId !== filter.instanceId) {
    return false;
  }

  if (filter.systemId) {
    const systemIds = [event.instance?.systemId, event.payloadMetadata?.systemId].filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
    if (!systemIds.includes(filter.systemId)) {
      return false;
    }
  }

  const record = event.payload.record;
  if (filter.recordId && record.recordId !== filter.recordId) {
    return false;
  }

  if (filter.selectionId && record.selectionId !== filter.selectionId) {
    return false;
  }

  if (filter.imageReference && record.imageReference !== filter.imageReference) {
    return false;
  }

  if (filter.metadata && !matchesMetadataFilter(event, filter.metadata)) {
    return false;
  }

  return true;
}

function matchesMetadataFilter(event: DatasetEvent, metadata: Readonly<Record<string, string>>): boolean {
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return true;
  }

  const candidateMaps: ReadonlyArray<Readonly<Record<string, unknown>> | undefined> = Object.freeze([
    event.actor.metadata,
    event.payloadMetadata?.lineage,
    event.payload.derivedMetadata,
  ]);

  return entries.every(([key, expected]) => (
    candidateMaps.some((candidate) => (
      typeof candidate?.[key] === "string" && candidate[key] === expected
    ))
  ));
}

export class InMemoryDatasetEventPublisher implements DatasetEventPublisher, DatasetEventSubscriber {
  private readonly deduplicationWindow: number;
  private readonly maxDeliveryFailures: number;
  private readonly events: DatasetEvent[] = [];
  private readonly listeners = new Set<InMemoryDatasetEventSubscriptionState>();
  private readonly eventIds = new Set<string>();
  private readonly eventIdOrder: string[] = [];
  private readonly deliveryFailures: DatasetEventDeliveryFailure[] = [];

  constructor(options: InMemoryDatasetEventPublisherOptions = {}) {
    this.deduplicationWindow = options.deduplicationWindow && options.deduplicationWindow > 0
      ? Math.floor(options.deduplicationWindow)
      : 500;
    this.maxDeliveryFailures = options.maxDeliveryFailures && options.maxDeliveryFailures > 0
      ? Math.floor(options.maxDeliveryFailures)
      : 100;
  }

  public publish(input: PublishDatasetEventInput): DatasetEvent {
    const event = createDatasetEvent(input.event);
    if (this.eventIds.has(event.eventId)) {
      return event;
    }
    this.events.push(event);
    this.eventIds.add(event.eventId);
    this.eventIdOrder.push(event.eventId);
    this.trimDeduplicationWindow();

    let listenerIndex = 0;
    for (const subscription of this.listeners) {
      if (matchesDatasetEventSubscriptionFilter(event, subscription.filter)) {
        try {
          subscription.listener(event);
        } catch (error) {
          this.recordDeliveryFailure({
            eventId: event.eventId,
            listenerIndex,
            occurredAt: new Date().toISOString(),
            message: error instanceof Error ? error.message : "Dataset event listener failed.",
          });
        }
      }
      listenerIndex += 1;
    }

    return event;
  }

  public subscribe(input: SubscribeToDatasetEventsInput): DatasetEventSubscription {
    const subscription = Object.freeze({ listener: input.listener, filter: input.filter });
    this.listeners.add(subscription);
    return () => {
      this.listeners.delete(subscription);
    };
  }

  public listPublishedEvents(): ReadonlyArray<DatasetEvent> {
    return Object.freeze([...this.events]);
  }

  public listDeliveryFailures(): ReadonlyArray<DatasetEventDeliveryFailure> {
    return Object.freeze([...this.deliveryFailures]);
  }

  public clear(): void {
    this.events.length = 0;
    this.eventIds.clear();
    this.eventIdOrder.length = 0;
    this.deliveryFailures.length = 0;
  }

  private trimDeduplicationWindow(): void {
    while (this.eventIdOrder.length > this.deduplicationWindow) {
      const droppedEventId = this.eventIdOrder.shift();
      if (droppedEventId) {
        this.eventIds.delete(droppedEventId);
      }
    }
  }

  private recordDeliveryFailure(failure: DatasetEventDeliveryFailure): void {
    this.deliveryFailures.push(Object.freeze(failure));
    if (this.deliveryFailures.length > this.maxDeliveryFailures) {
      this.deliveryFailures.splice(0, this.deliveryFailures.length - this.maxDeliveryFailures);
    }
  }
}

function createDatasetEventId(): string {
  return `dataset-event-${Math.random().toString(36).slice(2, 12)}`;
}

