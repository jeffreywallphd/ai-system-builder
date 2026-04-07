import { describe, expect, it } from "bun:test";
import { DatasetEventTypes } from "../../../domain/dataset-studio/contracts/DatasetEvent";
import { createDatasetEventEnvelope, InMemoryDatasetEventPublisher } from "../DatasetEventPublisher";
import { buildDatasetEventPreviewModel, InMemoryDatasetEventDiagnosticsStore } from "../DatasetEventDiagnostics";

function buildEvent(eventId: string) {
  return createDatasetEventEnvelope({
    eventId,
    eventType: DatasetEventTypes.imageSelected,
    occurredAt: "2026-03-30T00:00:00.000Z",
    dataset: { assetId: "dataset:image-asset", versionId: "v2" },
    instance: {
      systemId: "system:image",
      instanceId: "instance:review",
      dataset: { assetId: "dataset:image-asset", versionId: "v2" },
    },
    actor: {
      actorKind: "workflow",
      actorId: "workflow-1",
      source: "workflow-runtime",
      metadata: { trigger: "dataset" },
    },
    payloadMetadata: {
      lineage: { phase: "selection" },
    },
    payload: {
      record: {
        dataset: { assetId: "dataset:image-asset", versionId: "v2" },
        selectionId: "record-9",
        recordId: "record-9",
      },
      selectionContext: {
        reason: "manual-review",
      },
      derivedMetadata: {
        confidence: 0.92,
        approved: true,
      },
    },
  });
}

describe("DatasetEventDiagnostics", () => {
  it("builds readable preview models for dataset events", () => {
    const preview = buildDatasetEventPreviewModel(buildEvent("event-1"));

    expect(preview.summary).toContain("image_selected");
    expect(preview.summary).toContain("dataset=dataset:image-asset");
    expect(preview.datasetInstanceId).toBe("instance:review");
    expect(preview.recordId).toBe("record-9");
    expect(preview.occurredAt).toBe("2026-03-30T00:00:00.000Z");
    expect(preview.metadata.trigger).toBe("dataset");
    expect(preview.metadata.phase).toBe("selection");
    expect(preview.metadata.confidence).toBe("0.92");
  });

  it("records bounded event diagnostics and preserves latest entries", () => {
    const store = new InMemoryDatasetEventDiagnosticsStore({ capacity: 2, metadataLimit: 2 });
    store.record(buildEvent("event-1"));
    store.record(buildEvent("event-2"));
    store.record(buildEvent("event-3"));

    const entries = store.list();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.eventId).toBe("event-2");
    expect(entries[1]?.eventId).toBe("event-3");
    expect(Object.keys(entries[0]?.metadata ?? {})).toHaveLength(2);
  });

  it("supports end-to-end recording from event publisher subscriptions", () => {
    const publisher = new InMemoryDatasetEventPublisher();
    const diagnostics = new InMemoryDatasetEventDiagnosticsStore();

    const unsubscribe = publisher.subscribe({
      filter: { eventTypes: [DatasetEventTypes.imageSelected] },
      listener: (event) => {
        diagnostics.record(event);
      },
    });

    publisher.publish({ event: buildEvent("event-e2e") });
    unsubscribe();

    expect(diagnostics.list()).toHaveLength(1);
    expect(diagnostics.list()[0]?.eventId).toBe("event-e2e");
  });
});
