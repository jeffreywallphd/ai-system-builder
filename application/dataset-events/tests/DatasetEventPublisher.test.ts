import { describe, expect, it } from "bun:test";
import { DatasetEventTypes, type DatasetEventType } from "../../../domain/dataset-studio/contracts/DatasetEvent";
import {
  InMemoryDatasetEventPublisher,
  createDatasetEventEnvelope,
  matchesDatasetEventSubscriptionFilter,
} from "../DatasetEventPublisher";

function buildEvent(eventType: DatasetEventType, overrides: {
  readonly eventId?: string;
  readonly instanceId?: string;
  readonly recordId?: string;
  readonly metadataValue?: string;
} = {}) {
  const recordId = overrides.recordId ?? "record-1";
  return createDatasetEventEnvelope({
    eventType,
    eventId: overrides.eventId,
    dataset: { assetId: "dataset:image-asset", versionId: "v1" },
    instance: {
      systemId: "system:image",
      instanceId: overrides.instanceId ?? "instance:input",
      dataset: { assetId: "dataset:image-asset", versionId: "v1" },
    },
    actor: {
      actorKind: "system",
      actorId: "system:image",
      source: "system-runtime",
      metadata: { sourceTag: overrides.metadataValue ?? "workflow" },
    },
    payloadMetadata: {
      systemId: "system:image",
      lineage: { stage: "ingest" },
    },
    payload: {
      record: {
        dataset: { assetId: "dataset:image-asset", versionId: "v1" },
        selectionId: recordId,
        recordId,
        imageReference: `image://${recordId}`,
      },
      derivedMetadata: { quality: "high" },
    },
  });
}

describe("DatasetEventPublisher", () => {
  it("builds validated envelopes and stores published dataset events", () => {
    const publisher = new InMemoryDatasetEventPublisher();
    const envelope = buildEvent(DatasetEventTypes.imageAdded);

    const published = publisher.publish({ event: envelope });

    expect(published.eventType).toBe(DatasetEventTypes.imageAdded);
    expect(publisher.listPublishedEvents()).toHaveLength(1);
    expect(publisher.listPublishedEvents()[0]?.payload.record.recordId).toBe("record-1");
  });

  it("rejects payloads that do not match their declared event type", () => {
    expect(() => createDatasetEventEnvelope({
      eventType: DatasetEventTypes.imageUpdated,
      dataset: { assetId: "dataset:image-asset" },
      actor: {
        actorKind: "system",
        source: "system-runtime",
      },
      payload: {
        record: {
          dataset: { assetId: "dataset:image-asset" },
          selectionId: "record-1",
          recordId: "record-1",
        },
      },
    } as never)).toThrow();
  });

  it("supports subscription filtering by dataset instance and event type and can be disposed", () => {
    const publisher = new InMemoryDatasetEventPublisher();
    const received: string[] = [];

    const unsubscribe = publisher.subscribe({
      filter: {
        eventTypes: [DatasetEventTypes.imageSelected],
        instanceId: "instance:selected",
      },
      listener: (event) => {
        received.push(event.eventId);
      },
    });

    publisher.publish({ event: buildEvent(DatasetEventTypes.imageAdded, { eventId: "event-a" }) });
    publisher.publish({ event: buildEvent(DatasetEventTypes.imageSelected, { eventId: "event-b", instanceId: "instance:input" }) });
    publisher.publish({ event: buildEvent(DatasetEventTypes.imageSelected, { eventId: "event-c", instanceId: "instance:selected" }) });

    expect(received).toEqual(["event-c"]);

    unsubscribe();
    publisher.publish({ event: buildEvent(DatasetEventTypes.imageSelected, { eventId: "event-d", instanceId: "instance:selected" }) });

    expect(received).toEqual(["event-c"]);
  });

  it("supports bounded filtering by record reference and metadata", () => {
    const match = buildEvent(DatasetEventTypes.imageGenerated, {
      eventId: "event-match",
      recordId: "record-42",
      metadataValue: "workflow",
    });
    const nonMatch = buildEvent(DatasetEventTypes.imageGenerated, {
      eventId: "event-other",
      recordId: "record-77",
      metadataValue: "manual",
    });

    const filter = {
      datasetAssetId: "dataset:image-asset",
      recordId: "record-42",
      metadata: {
        sourceTag: "workflow",
        stage: "ingest",
      },
    };

    expect(matchesDatasetEventSubscriptionFilter(match, filter)).toBe(true);
    expect(matchesDatasetEventSubscriptionFilter(nonMatch, filter)).toBe(false);
  });
});
