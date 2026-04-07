import { describe, expect, it } from "bun:test";
import { DatasetEventTypes } from "@domain/dataset-studio/contracts/DatasetEvent";
import {
  createEmptyWorkflowDraft,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowExecutionTriggerSourceKinds } from "../WorkflowExecutionAlignmentContracts";
import {
  WorkflowDatasetEventNames,
  mapDatasetEventToWorkflowTriggerEntries,
} from "../WorkflowDatasetEventTriggerAdapter";

function buildDatasetEvent(eventType: string) {
  const record = {
    dataset: {
      assetId: "dataset:image-manipulation",
      versionId: "v1",
    },
    selectionId: "record-1",
    recordId: "record-1",
  };
  return {
    eventId: "dataset-event-1",
    eventType,
    occurredAt: "2026-04-01T00:00:00.000Z",
    contractVersion: "1.0.0",
    dataset: {
      assetId: "dataset:image-manipulation",
      versionId: "v1",
    },
    instance: {
      systemId: "system:image",
      instanceId: "instance:output",
      dataset: {
        assetId: "dataset:image-manipulation",
        versionId: "v1",
      },
    },
    actor: {
      actorKind: "runtime",
      source: "system-runtime",
    },
    payloadMetadata: {
      systemId: "system:image",
    },
    payload: eventType === DatasetEventTypes.imageUpdated
      ? {
        record,
        updatedFields: ["image.metadata"],
      }
      : eventType === DatasetEventTypes.imageGenerated
        ? {
          record,
          generationContext: {
            sourceWorkflowId: "workflow:image",
          },
        }
        : eventType === DatasetEventTypes.imageSelected
          ? {
            record,
            selectionContext: {
              selectionMode: "single",
              reason: "focus",
            },
          }
          : {
            record,
          },
  } as const;
}

describe("WorkflowDatasetEventTriggerAdapter", () => {
  it("maps supported dataset event types to state trigger entries", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-dataset-generated",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: {
          sourceType: "system",
          eventCategory: "system-state-changed",
          eventName: WorkflowDatasetEventNames.imageGenerated,
        },
      }],
    };

    const mapped = mapDatasetEventToWorkflowTriggerEntries({
      draft,
      event: buildDatasetEvent(DatasetEventTypes.imageGenerated),
    });

    expect(mapped.issues).toHaveLength(0);
    expect(mapped.entries).toHaveLength(1);
    expect(mapped.entries[0]).toMatchObject({
      sourceKind: WorkflowExecutionTriggerSourceKinds.stateData,
      triggerId: "trigger-dataset-generated",
      triggerType: WorkflowDraftTriggerTypes.stateSystemEvent,
      activationType: "dataset-event",
    });
    expect(mapped.entries[0]?.payload?.datasetEventType).toBe(DatasetEventTypes.imageGenerated);
  });

  it("supports image-added, image-updated, image-generated, and image-selected event-name routing", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-added",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: { sourceType: "system", eventCategory: "system-state-changed", eventName: WorkflowDatasetEventNames.imageAdded },
      }, {
        id: "trigger-updated",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: { sourceType: "system", eventCategory: "system-state-changed", eventName: WorkflowDatasetEventNames.imageUpdated },
      }, {
        id: "trigger-generated",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: { sourceType: "system", eventCategory: "system-state-changed", eventName: WorkflowDatasetEventNames.imageGenerated },
      }, {
        id: "trigger-selected",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: { sourceType: "system", eventCategory: "system-state-changed", eventName: WorkflowDatasetEventNames.imageSelected },
      }],
    };

    const added = mapDatasetEventToWorkflowTriggerEntries({ draft, event: buildDatasetEvent(DatasetEventTypes.imageAdded) });
    const updated = mapDatasetEventToWorkflowTriggerEntries({ draft, event: buildDatasetEvent(DatasetEventTypes.imageUpdated) });
    const generated = mapDatasetEventToWorkflowTriggerEntries({ draft, event: buildDatasetEvent(DatasetEventTypes.imageGenerated) });
    const selected = mapDatasetEventToWorkflowTriggerEntries({ draft, event: buildDatasetEvent(DatasetEventTypes.imageSelected) });

    expect(added.entries[0]?.triggerId).toBe("trigger-added");
    expect(updated.entries[0]?.triggerId).toBe("trigger-updated");
    expect(generated.entries[0]?.triggerId).toBe("trigger-generated");
    expect(selected.entries[0]?.triggerId).toBe("trigger-selected");
  });

  it("returns no trigger entries for non-matching event-name subscriptions", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-other",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: {
          sourceType: "system",
          eventCategory: "system-state-changed",
          eventName: "dataset.other_event",
        },
      }],
    };

    const mapped = mapDatasetEventToWorkflowTriggerEntries({
      draft,
      event: buildDatasetEvent(DatasetEventTypes.imageUpdated),
    });

    expect(mapped.issues).toHaveLength(0);
    expect(mapped.entries).toHaveLength(0);
  });

  it("handles malformed dataset events without throwing", () => {
    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-malformed",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: {
          sourceType: "system",
          eventCategory: "system-state-changed",
          eventName: WorkflowDatasetEventNames.imageAdded,
        },
      }],
    };

    const mapped = mapDatasetEventToWorkflowTriggerEntries({
      draft,
      event: {
        ...(buildDatasetEvent(DatasetEventTypes.imageAdded) as unknown as Record<string, unknown>),
        occurredAt: "not-a-date",
      } as never,
    });

    expect(mapped.entries).toHaveLength(0);
    expect(mapped.issues).toHaveLength(1);
    expect(mapped.issues[0]?.code).toBe("dataset-event-malformed");
  });
});

