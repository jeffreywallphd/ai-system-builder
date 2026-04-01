import {
  DatasetEventTypes,
  createDatasetEvent,
  type DatasetEvent,
  type DatasetEventType,
} from "../../domain/dataset-studio/contracts/DatasetEvent";
import { WorkflowDraftTriggerTypes, type WorkflowDraft } from "../../domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowExecutionTriggerSourceKinds } from "./WorkflowExecutionAlignmentContracts";
import type { WorkflowExecutionTriggerEntry } from "./WorkflowTriggerExecutionEntryService";
import { mapWorkflowDraftTriggersToExecutionTriggerPlan } from "./WorkflowDraftTriggerExecutionPlanner";

export const WorkflowDatasetEventNames = Object.freeze({
  imageAdded: "dataset.image_added",
  imageUpdated: "dataset.image_updated",
  imageGenerated: "dataset.image_generated",
  imageSelected: "dataset.image_selected",
} as const);

export interface WorkflowDatasetEventTriggerMappingIssue {
  readonly code: "dataset-event-malformed" | "dataset-event-unsupported";
  readonly message: string;
}

export interface MapDatasetEventToWorkflowTriggerEntriesResult {
  readonly entries: ReadonlyArray<WorkflowExecutionTriggerEntry>;
  readonly issues: ReadonlyArray<WorkflowDatasetEventTriggerMappingIssue>;
}

export function mapDatasetEventTypeToWorkflowEventName(eventType: DatasetEventType): string {
  if (eventType === DatasetEventTypes.imageAdded) {
    return WorkflowDatasetEventNames.imageAdded;
  }
  if (eventType === DatasetEventTypes.imageUpdated) {
    return WorkflowDatasetEventNames.imageUpdated;
  }
  if (eventType === DatasetEventTypes.imageGenerated) {
    return WorkflowDatasetEventNames.imageGenerated;
  }
  if (eventType === DatasetEventTypes.imageSelected) {
    return WorkflowDatasetEventNames.imageSelected;
  }
  throw new Error(`Dataset event type '${String(eventType)}' is not supported for workflow trigger mapping.`);
}

export function mapDatasetEventToWorkflowTriggerEntries(input: {
  readonly draft: WorkflowDraft;
  readonly event: DatasetEvent;
}): MapDatasetEventToWorkflowTriggerEntriesResult {
  let event: DatasetEvent;
  try {
    event = createDatasetEvent(input.event);
  } catch (error) {
    return Object.freeze({
      entries: Object.freeze([]),
      issues: Object.freeze([Object.freeze({
        code: "dataset-event-malformed",
        message: error instanceof Error ? error.message : "Dataset event is malformed.",
      })]),
    });
  }

  let expectedEventName: string;
  try {
    expectedEventName = mapDatasetEventTypeToWorkflowEventName(event.eventType);
  } catch (error) {
    return Object.freeze({
      entries: Object.freeze([]),
      issues: Object.freeze([Object.freeze({
        code: "dataset-event-unsupported",
        message: error instanceof Error ? error.message : "Dataset event type is not supported.",
      })]),
    });
  }

  const eventTypeAlias = event.eventType.trim().toLowerCase();
  const triggerEntries = mapWorkflowDraftTriggersToExecutionTriggerPlan(input.draft)
    .filter((plan) => plan.runtimeKind === "state")
    .filter((plan) => (
      plan.triggerType === WorkflowDraftTriggerTypes.stateSystemEvent
      || plan.triggerType === WorkflowDraftTriggerTypes.stateDataAvailable
    ))
    .filter((plan) => {
      const eventName = plan.eventName?.trim().toLowerCase();
      return eventName === expectedEventName || eventName === eventTypeAlias;
    })
    .map((plan) => Object.freeze({
      sourceKind: WorkflowExecutionTriggerSourceKinds.stateData,
      triggerId: plan.triggerId,
      triggerType: plan.triggerType,
      activationType: "dataset-event",
      payload: Object.freeze({
        datasetEventId: event.eventId,
        datasetEventType: event.eventType,
        occurredAt: event.occurredAt,
        dataset: event.dataset,
        instance: event.instance,
        actor: event.actor,
        payload: event.payload,
        payloadMetadata: event.payloadMetadata,
      }),
      metadata: Object.freeze({
        datasetEventType: event.eventType,
        datasetEventId: event.eventId,
        datasetAssetId: event.dataset.assetId,
        datasetInstanceId: event.instance?.instanceId,
      }),
    } satisfies WorkflowExecutionTriggerEntry));

  return Object.freeze({
    entries: Object.freeze(triggerEntries),
    issues: Object.freeze([]),
  });
}
