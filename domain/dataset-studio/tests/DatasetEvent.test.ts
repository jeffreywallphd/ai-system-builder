import { describe, expect, it } from "bun:test";
import {
  DatasetEventContractVersions,
  DatasetEventTypes,
  createDatasetEvent,
  validateDatasetEventPayloadForType,
} from "../contracts/DatasetEvent";

function createBaseEventInput() {
  return {
    eventId: "evt-1",
    occurredAt: "2026-04-01T10:00:00.000Z",
    contractVersion: DatasetEventContractVersions.v1,
    dataset: { assetId: "dataset-asset-1", versionId: "v1" },
    instance: {
      systemId: "system-1",
      instanceId: "instance-1",
      dataset: { assetId: "dataset-asset-1", versionId: "v1" },
    },
    actor: {
      actorKind: "workflow" as const,
      actorId: "workflow-runner",
      source: "workflow-trigger",
      sessionId: "session-1",
      metadata: { surface: "dataset-studio" },
    },
    payloadMetadata: {
      workflowId: "workflow-1",
      workflowRunId: "run-22",
      systemId: "system-1",
      lineage: { edge: "generated-from" },
    },
  };
}

describe("DatasetEvent contracts", () => {
  it("builds valid events for all required dataset image event types", () => {
    const base = createBaseEventInput();
    const commonRecord = {
      dataset: { assetId: "dataset-asset-1", versionId: "v1" },
      selectionId: "selection-1",
      recordId: "record-1",
      imageReference: "image://record-1",
    };

    const added = createDatasetEvent({
      ...base,
      eventType: DatasetEventTypes.imageAdded,
      payload: {
        record: commonRecord,
        derivedMetadata: { width: 1024, height: 768 },
      },
    });

    const updated = createDatasetEvent({
      ...base,
      eventId: "evt-2",
      eventType: DatasetEventTypes.imageUpdated,
      payload: {
        record: commonRecord,
        previousRecord: { ...commonRecord, recordId: "record-0" },
        updatedFields: ["tags", "metadata"],
      },
    });

    const generated = createDatasetEvent({
      ...base,
      eventId: "evt-3",
      eventType: DatasetEventTypes.imageGenerated,
      payload: {
        record: commonRecord,
        generationContext: { model: "model-asset-1", operation: "txt2img" },
      },
    });

    const selected = createDatasetEvent({
      ...base,
      eventId: "evt-4",
      eventType: DatasetEventTypes.imageSelected,
      payload: {
        record: commonRecord,
        selectionContext: {
          selectionMode: "single",
          reason: "quality-review",
          rank: 0,
        },
      },
    });

    expect(added.eventType).toBe(DatasetEventTypes.imageAdded);
    expect(updated.eventType).toBe(DatasetEventTypes.imageUpdated);
    expect(generated.eventType).toBe(DatasetEventTypes.imageGenerated);
    expect(selected.eventType).toBe(DatasetEventTypes.imageSelected);
  });

  it("rejects invalid payloads for specific event types", () => {
    expect(() => validateDatasetEventPayloadForType(
      DatasetEventTypes.imageUpdated,
      {
        record: {
          dataset: { assetId: "dataset-1" },
          selectionId: "selection-1",
          recordId: "record-1",
        },
        updatedFields: [],
      },
    )).toThrow();

    expect(() => createDatasetEvent({
      ...createBaseEventInput(),
      eventType: DatasetEventTypes.imageAdded,
      occurredAt: "not-a-date",
      payload: {
        record: {
          dataset: { assetId: "dataset-1" },
          selectionId: "selection-1",
          recordId: "record-1",
        },
      },
    })).toThrow("DatasetEvent.occurredAt");
  });

  it("enforces required fields while allowing optional metadata fields", () => {
    expect(() => createDatasetEvent({
      ...createBaseEventInput(),
      eventId: " ",
      eventType: DatasetEventTypes.imageAdded,
      payload: {
        record: {
          dataset: { assetId: "dataset-1" },
          selectionId: "selection-1",
          recordId: "record-1",
        },
      },
    })).toThrow();

    const event = createDatasetEvent({
      ...createBaseEventInput(),
      eventId: "evt-optional",
      actor: {
        actorKind: "user",
        source: "studio-ui",
      },
      payloadMetadata: undefined,
      eventType: DatasetEventTypes.imageSelected,
      payload: {
        record: {
          dataset: { assetId: "dataset-1" },
          selectionId: "selection-1",
          recordId: "record-1",
        },
      },
    });

    expect(event.payloadMetadata).toBeUndefined();
    expect(event.actor.actorId).toBeUndefined();
  });

  it("rejects payload shapes that do not match the event type", () => {
    expect(() => createDatasetEvent({
      ...createBaseEventInput(),
      eventType: DatasetEventTypes.imageSelected,
      payload: {
        record: {
          dataset: { assetId: "dataset-1" },
          selectionId: "selection-1",
          recordId: "record-1",
        },
        updatedFields: ["metadata"],
      },
    } as never)).toThrow();
  });
});
