import { describe, expect, it } from "bun:test";
import { DatasetEventTypes } from "../../../domain/dataset-studio/contracts/DatasetEvent";
import {
  InMemoryDatasetEventPublisher,
  createDatasetEventEnvelope,
} from "../DatasetEventPublisher";

describe("DatasetEventPublisher", () => {
  it("builds validated envelopes and stores published dataset events", () => {
    const publisher = new InMemoryDatasetEventPublisher();
    const envelope = createDatasetEventEnvelope({
      eventType: DatasetEventTypes.imageAdded,
      dataset: { assetId: "dataset:image-asset", versionId: "v1" },
      instance: {
        systemId: "system:image",
        instanceId: "instance:input",
        dataset: { assetId: "dataset:image-asset", versionId: "v1" },
      },
      actor: {
        actorKind: "system",
        actorId: "system:image",
        source: "system-runtime",
      },
      payload: {
        record: {
          dataset: { assetId: "dataset:image-asset", versionId: "v1" },
          selectionId: "record-1",
          recordId: "record-1",
        },
      },
    });

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
});
