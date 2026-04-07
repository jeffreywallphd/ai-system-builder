import type { SystemContextContract } from "../../domain/system-studio/SystemContextContract";
import {
  createDefaultSystemStudioContextExtractor,
  type SystemStudioContextExtractionIssue,
  type SystemStudioContextExtractionSource,
  type SystemStudioContextExtractor,
} from "./SystemStudioContextExtraction";
import {
  createDefaultSystemContextDatasetReferenceResolver,
  type ResolveSystemContextDatasetsResult,
  type SystemContextDatasetReferenceResolver,
} from "./SystemContextDatasetReferenceResolver";
import {
  createDefaultWorkflowSystemContextBindingAdapter,
  type WorkflowSystemContextBindingAdapter,
} from "./SystemContextWorkflowInputMapper";
import {
  createDefaultUiTriggerEventPayloadEnricher,
  type UiTriggerEventPayloadEnricher,
} from "./UiTriggerEventPayloadEnrichmentService";
import { createUiTriggerEvent, UiTriggerEventKinds, type UiTriggerEvent } from "./UiTriggerEventContract";
import {
  SystemContextValidationService,
  type SystemContextValidationRequest,
  type SystemContextValidationResult,
} from "./SystemContextValidationService";
import { WorkflowExecutionTriggerSourceKinds, type WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type { WorkflowExecutionTriggerEntry } from "./WorkflowTriggerExecutionEntryService";

export interface SystemContextDebugPreviewRequest {
  readonly source: SystemStudioContextExtractionSource;
  readonly validation?: Omit<SystemContextValidationRequest, "context">;
  readonly triggerPreview?: {
    readonly event?: UiTriggerEvent;
    readonly triggerEntry?: WorkflowExecutionTriggerEntry;
  };
}

export interface SystemContextDebugPreviewResult {
  readonly context: SystemContextContract;
  readonly extractionIssues: ReadonlyArray<SystemStudioContextExtractionIssue>;
  readonly validation: SystemContextValidationResult;
  readonly datasetResolution: ResolveSystemContextDatasetsResult;
  readonly workflowContext: WorkflowExecutionPlanTranslationRequest["context"];
  readonly enrichedTriggerPayload: Readonly<Record<string, unknown>>;
}

export class SystemContextDebugPreviewService {
  constructor(
    private readonly extractor: SystemStudioContextExtractor = createDefaultSystemStudioContextExtractor(),
    private readonly validator: SystemContextValidationService = new SystemContextValidationService(),
    private readonly datasetResolver: SystemContextDatasetReferenceResolver = createDefaultSystemContextDatasetReferenceResolver(),
    private readonly bindingAdapter: WorkflowSystemContextBindingAdapter = createDefaultWorkflowSystemContextBindingAdapter(),
    private readonly payloadEnricher: UiTriggerEventPayloadEnricher = createDefaultUiTriggerEventPayloadEnricher(),
  ) {}

  public preview(request: SystemContextDebugPreviewRequest): SystemContextDebugPreviewResult {
    const extracted = this.extractor.extract(request.source);
    const validation = this.validator.validate({
      ...(request.validation ?? {}),
      context: extracted.context,
    });
    const datasetResolution = this.datasetResolver.resolve({ datasets: validation.normalizedContext.datasets });
    const workflowContext = this.bindingAdapter.map(validation.normalizedContext);

    const event = request.triggerPreview?.event
      ?? createUiTriggerEvent({
        kind: UiTriggerEventKinds.submit,
        name: "debug.system-context.preview",
        source: {
          studio: "system-studio",
          componentId: "system-context-debug-preview",
          actionId: "preview",
        },
        payload: {
          values: validation.normalizedContext.parameters,
        },
      });

    const triggerEntry = request.triggerPreview?.triggerEntry
      ?? Object.freeze({
        sourceKind: WorkflowExecutionTriggerSourceKinds.manualUser,
        triggerId: "debug-preview-trigger",
        triggerType: "user-manual",
        activationType: "ui-submit",
        payload: Object.freeze({
          ...event.payload,
          uiEventId: event.eventId,
          uiEventName: event.name,
          uiEventKind: event.kind,
        }),
      } satisfies WorkflowExecutionTriggerEntry);

    const enrichedTriggerPayload = this.payloadEnricher.enrich({
      event,
      triggerEntry,
      systemContext: validation.normalizedContext,
      workflowContext,
    });

    return Object.freeze({
      context: extracted.context,
      extractionIssues: extracted.issues,
      validation,
      datasetResolution,
      workflowContext,
      enrichedTriggerPayload,
    });
  }
}
