import type { SystemContextContract } from "../../domain/system-studio/SystemContextContract";
import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type { UiTriggerEvent } from "./UiTriggerEventContract";
import type { WorkflowExecutionTriggerEntry } from "./WorkflowTriggerExecutionEntryService";

export const UiTriggerPayloadEnvelopeVersion = "1.0.0";

export interface EnrichUiTriggerEventPayloadRequest {
  readonly event: UiTriggerEvent;
  readonly triggerEntry: WorkflowExecutionTriggerEntry;
  readonly systemContext: SystemContextContract;
  readonly workflowContext: WorkflowExecutionPlanTranslationRequest["context"];
}

export interface UiTriggerEventPayloadEnricher {
  readonly enrich: (request: EnrichUiTriggerEventPayloadRequest) => Readonly<Record<string, unknown>>;
}

function mapDatasetResolutionSummary(metadata: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined {
  if (!metadata) {
    return undefined;
  }

  const resolution = metadata.datasetResolution;
  if (!resolution || typeof resolution !== "object" || Array.isArray(resolution)) {
    return undefined;
  }

  return Object.freeze({ ...(resolution as Readonly<Record<string, unknown>>) });
}

export function createDefaultUiTriggerEventPayloadEnricher(): UiTriggerEventPayloadEnricher {
  return Object.freeze({
    enrich: (request) => {
      const runtimeMetadata = request.workflowContext.metadata;
      return Object.freeze({
        ...(request.triggerEntry.payload ?? {}),
        __systemContextEnvelope: Object.freeze({
          version: UiTriggerPayloadEnvelopeVersion,
          source: "ui-trigger-system-context",
          triggerEventId: request.event.eventId,
          triggerEventName: request.event.name,
          triggerEventKind: request.event.kind,
        }),
        systemContext: request.systemContext,
        systemContextSummary: Object.freeze({
          selectedImageCount: request.systemContext.selectedImages.length,
          parameterKeys: Object.freeze(Object.keys(request.systemContext.parameters)),
          datasetReferenceCount: request.systemContext.datasets.length,
          runtime: request.systemContext.runtime,
        }),
        datasetContext: Object.freeze({
          references: request.systemContext.datasets,
          resolution: mapDatasetResolutionSummary(runtimeMetadata),
        }),
        workflowContextBinding: Object.freeze({
          inputValues: Object.freeze({ ...(request.workflowContext.inputValues ?? {}) }),
          metadata: Object.freeze({ ...(runtimeMetadata ?? {}) }),
        }),
      });
    },
  });
}
