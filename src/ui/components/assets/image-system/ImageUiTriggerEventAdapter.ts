import { createUiTriggerEvent, type UiTriggerEvent } from "@application/workflow-studio/UiTriggerEventContract";
import type { ImageUiEvent } from "./ImageUiContracts";

function mapImageContextToUiReferences(event: ImageUiEvent): UiTriggerEvent["context"] {
  const dataset = event.context?.dataset;
  const system = event.context?.system;
  return Object.freeze({
    workflowAssetId: event.context?.workflowAssetId,
    workflowRunId: event.context?.workflowRunId,
    datasetAssetId: dataset?.datasetAssetId,
    datasetVersionId: dataset?.datasetVersionId,
    systemAssetId: system?.systemAssetId,
    systemVersionId: system?.systemVersionId,
  });
}

export function mapImageUiEventToUiTriggerEvent(imageEvent: ImageUiEvent): UiTriggerEvent | undefined {
  const event = imageEvent;
  if (event.type === "parameter-submitted") {
    return createUiTriggerEvent({
      eventId: `ui:${event.eventId}`,
      occurredAt: event.occurredAt,
      kind: "submit",
      name: "ui.image.parameter.submit",
      source: {
        studio: "system-studio",
        componentId: event.sourceComponent,
        componentType: "image-parameter-form",
        actionId: "submit",
      },
      payload: {
        imageId: event.payload.imageId,
        values: event.payload.values,
        issueCount: event.payload.issueCount,
      },
      context: mapImageContextToUiReferences(event),
      metadata: {
        imageEventType: event.type,
      },
    });
  }

  if (event.type === "image-selected" || event.type === "gallery-item-selected" || event.type === "comparison-target-changed") {
    const imageId = event.payload.imageId;
    if (!imageId) {
      return undefined;
    }

    return createUiTriggerEvent({
      eventId: `ui:${event.eventId}`,
      occurredAt: event.occurredAt,
      kind: "selection",
      name: "ui.image.selection.changed",
      source: {
        studio: "system-studio",
        componentId: event.sourceComponent,
        componentType: "image-selection",
        actionId: "select-image",
      },
      payload: {
        imageId,
        selectedIds: "selectedIds" in event.payload ? event.payload.selectedIds : [imageId],
      },
      context: mapImageContextToUiReferences(event),
      metadata: {
        imageEventType: event.type,
      },
    });
  }

  if (event.type === "gallery-item-opened") {
    return createUiTriggerEvent({
      eventId: `ui:${event.eventId}`,
      occurredAt: event.occurredAt,
      kind: "click",
      name: "ui.image.gallery.open",
      source: {
        studio: "system-studio",
        componentId: event.sourceComponent,
        componentType: "image-output-gallery",
        actionId: "open-image",
      },
      payload: {
        imageId: event.payload.imageId,
      },
      context: mapImageContextToUiReferences(event),
      metadata: {
        imageEventType: event.type,
      },
    });
  }

  return undefined;
}

