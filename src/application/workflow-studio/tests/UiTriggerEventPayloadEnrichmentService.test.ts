import { describe, expect, it } from "bun:test";
import { createSystemContextContract } from "@domain/system-studio/SystemContextContract";
import { createUiTriggerEvent, UiTriggerEventKinds } from "../UiTriggerEventContract";
import { createDefaultUiTriggerEventPayloadEnricher } from "../UiTriggerEventPayloadEnrichmentService";
import { WorkflowExecutionTriggerSourceKinds } from "../WorkflowExecutionAlignmentContracts";

describe("UiTriggerEventPayloadEnrichmentService", () => {
  it("enriches trigger payloads with normalized system context and workflow binding metadata", () => {
    const enricher = createDefaultUiTriggerEventPayloadEnricher();
    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.submit,
      name: "ui.image.parameter.submit",
      source: { studio: "system-studio", componentId: "parameter-form" },
      payload: { values: { prompt: "enhance" } },
    });
    const systemContext = createSystemContextContract({
      selectedImages: [{ selectionId: "image-1", imageId: "image-1", assetRef: { assetId: "image-1" } }],
      parameters: { prompt: "enhance" },
      datasets: [{ referenceId: "dataset-ref-1", instanceId: "instance-1", datasetAssetId: "dataset:images", role: "active-input" }],
      runtime: { runtimeSessionId: "runtime-1", sourceStudio: "system-studio" },
    });

    const payload = enricher.enrich({
      event,
      triggerEntry: {
        sourceKind: WorkflowExecutionTriggerSourceKinds.manualUser,
        triggerId: "trigger-submit",
        triggerType: "user-manual",
        payload: { uiEventId: event.eventId },
      },
      systemContext,
      workflowContext: {
        inputValues: { prompt: "enhance" },
        metadata: {
          datasetResolution: {
            resolvedCount: 1,
            unresolvedCount: 0,
            issueCount: 0,
          },
        },
      },
    });

    expect(payload.systemContext).toEqual(systemContext);
    expect((payload.systemContextSummary as { selectedImageCount: number }).selectedImageCount).toBe(1);
    expect((payload.datasetContext as { resolution: { resolvedCount: number } }).resolution.resolvedCount).toBe(1);
    expect((payload.workflowContextBinding as { inputValues: { prompt: string } }).inputValues.prompt).toBe("enhance");
  });
});

