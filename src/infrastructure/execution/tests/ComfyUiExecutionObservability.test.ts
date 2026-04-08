import { describe, expect, it, mock } from "bun:test";
import { ComfyImageManipulationTemplateTranslationAdapter } from "@infrastructure/comfyui/execution/mappers/ComfyImageManipulationTemplateTranslationAdapter";
import { createComfyUiExecutionAdapterInfrastructure } from "../comfyui/ComfyUiExecutionAdapterComposition";
import { ComfyUiExecutionAdapterConfig } from "@infrastructure/config/ComfyUiExecutionAdapterConfig";
import { normalizeComfyUiExecutionState } from "../comfyui/ComfyUiExecutionStatusNormalizer";
import {
  ComfyUiExecutionObservability,
  type ComfyUiExecutionObservabilityEvent,
  type ComfyUiExecutionObservabilityLogger,
} from "../comfyui/ComfyUiExecutionObservability";

class CapturingObservabilityLogger implements ComfyUiExecutionObservabilityLogger {
  public readonly infoEvents: ComfyUiExecutionObservabilityEvent[] = [];
  public readonly warnEvents: ComfyUiExecutionObservabilityEvent[] = [];
  public readonly errorEvents: ComfyUiExecutionObservabilityEvent[] = [];

  public info(event: ComfyUiExecutionObservabilityEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: ComfyUiExecutionObservabilityEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: ComfyUiExecutionObservabilityEvent): void {
    this.errorEvents.push(event);
  }

  public all(): ReadonlyArray<ComfyUiExecutionObservabilityEvent> {
    return [...this.infoEvents, ...this.warnEvents, ...this.errorEvents];
  }
}

describe("ComfyUi execution observability and redaction", () => {
  it("emits translation flow observability without leaking prompt text", async () => {
    const logger = new CapturingObservabilityLogger();
    const observability = new ComfyUiExecutionObservability({
      logger,
      now: () => new Date("2026-04-08T18:00:00.000Z"),
    });
    const adapter = new ComfyImageManipulationTemplateTranslationAdapter({
      observability,
      now: () => new Date("2026-04-08T18:00:00.000Z"),
    });

    await adapter.translateToBackendPayload({
      contractVersion: "1.0.0",
      translationRequestId: "translation-1",
      runId: "run-1",
      workspaceId: "workspace-1",
      requestedAt: "2026-04-08T17:59:00.000Z",
      correlationId: "corr-translation-1",
      authoritative: {
        workflow: {
          workflowId: "workflow-1",
          workflowLineageId: "workflow-lineage-1",
          workflowVersionTag: "1.0.0",
          workflowRevision: 1,
          operationKind: "image-to-image",
          backendTranslation: {
            translatorId: "adapter.comfyui.image-manipulation",
            contractVersion: "1.0.0",
            templateId: "image-template:image-to-image-restyle:v1",
            templateVersion: "v1",
            inputBindings: [{ inputId: "sourceImage", backendField: "inputs.source-image" }],
            parameterBindings: [
              { parameterId: "prompt", backendField: "parameters.prompt" },
              { parameterId: "variationStrength", backendField: "parameters.variation-strength" },
            ],
            outputBindings: [{ outputId: "generatedImage", backendField: "outputs.generated-image" }],
          },
        },
        system: {
          systemId: "system-1",
          workflowBinding: {
            workflowId: "workflow-1",
            workflowLineageId: "workflow-lineage-1",
            workflowVersionTag: "1.0.0",
            workflowRevision: 1,
            requiredInputIds: ["sourceImage"],
            requiredParameterIds: ["prompt", "variationStrength"],
            requiredOutputIds: ["generatedImage"],
          },
          parameterBaseline: {
            values: Object.freeze({}),
            profileReferences: Object.freeze([]),
          },
        },
      },
      templateResolution: {
        translatorId: "adapter.comfyui.image-manipulation",
        contractVersion: "1.0.0",
        templateId: "image-template:image-to-image-restyle:v1",
        templateVersion: "v1",
        adapterFamily: "adapter.comfyui.image-manipulation",
        operationTypeKey: "operation.image-to-image",
      },
      slotBindings: [{
        bindingId: "slot-1",
        inputId: "sourceImage",
        backendField: "inputs.source-image",
        sourceKind: "input-asset",
        logicalReference: "asset://image/source-1",
        required: true,
      }],
      parameterMappings: [{
        parameterId: "prompt",
        backendField: "parameters.prompt",
        source: "runtime-override",
        value: "secret portrait prompt text",
      }, {
        parameterId: "variationStrength",
        backendField: "parameters.variation-strength",
        source: "runtime-override",
        value: 0.4,
      }],
      outputExpectations: [{
        outputId: "generatedImage",
        backendField: "outputs.generated-image",
        required: true,
        allowsMultiple: false,
        logicalTargetReference: "dataset-instance://output/generated",
      }],
      capabilityRequirements: {
        requiredCapabilities: ["operation:image"],
        preferredBackendFamily: "backend-family.comfyui.image-manipulation",
      },
    });

    const events = logger.all();
    expect(events.some((event) => event.event === "translation.started")).toBeTrue();
    expect(events.some((event) => event.event === "translation.succeeded")).toBeTrue();
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("secret portrait prompt text");
  });

  it("logs dispatch and transport failures with redaction and execution correlation ids", async () => {
    const logger = new CapturingObservabilityLogger();
    const fetchFn = mock(async () => new Response(
      "prompt=do-not-log-this C:\\unsafe\\path token=abc123",
      { status: 500 },
    ));
    const composed = createComfyUiExecutionAdapterInfrastructure({
      config: new ComfyUiExecutionAdapterConfig({
        enabled: true,
        baseUrl: "http://localhost:8188",
      }),
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T19:00:00.000Z"),
      observabilityLogger: logger,
    });
    if (!composed) {
      throw new Error("Expected composed infrastructure.");
    }

    await expect(composed.runDispatchAdapter.dispatch(Object.freeze({
      commandId: "cmd-1",
      dispatchAttemptId: "dispatch-1",
      preparedAt: "2026-04-08T19:00:00.000Z",
      run: Object.freeze({
        runId: "run-1",
        workflowId: "workflow-1",
        workspaceId: "workspace-1",
        submittedAt: "2026-04-08T18:59:00.000Z",
        source: "api",
        correlationId: "corr-1",
      }),
      queue: Object.freeze({
        queueId: "queue-1",
      }),
      assignment: Object.freeze({
        nodeId: "node-1",
        reservationOwner: "scheduler",
        claimToken: "claim-1",
      }),
      runtimeTarget: Object.freeze({
        systemId: "comfyui",
        versionId: "runtime-1",
        async: true,
      }),
      backend: Object.freeze({
        kind: "comfyui",
      }),
      inputs: Object.freeze({
        tags: Object.freeze([]),
        parameters: Object.freeze({
          "comfy.request": Object.freeze({
            client_id: "run-1",
            prompt: Object.freeze({
              "1": Object.freeze({
                class_type: "LoadImage",
                inputs: Object.freeze({
                  image: "asset://private",
                }),
              }),
            }),
          }),
        }),
      }),
      references: Object.freeze({
        storageReferences: Object.freeze([]),
        resourceReferences: Object.freeze([]),
        policyPrerequisites: Object.freeze([]),
      }),
    }))).rejects.toBeDefined();

    const events = logger.all();
    expect(events.some((event) => event.event === "dispatch.started" && event.runId === "run-1")).toBeTrue();
    expect(events.some((event) => event.event === "transport.request-failed")).toBeTrue();
    expect(events.some((event) => event.event === "dispatch.failed" && event.dispatchAttemptId === "dispatch-1")).toBeTrue();
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("do-not-log-this");
    expect(serialized).not.toContain("C:\\unsafe\\path");
    expect(serialized).not.toContain("abc123");
  });

  it("emits progress-normalization observability with normalized state summaries", () => {
    const logger = new CapturingObservabilityLogger();
    const observability = new ComfyUiExecutionObservability({
      logger,
      now: () => new Date("2026-04-08T20:00:00.000Z"),
    });

    const snapshot = normalizeComfyUiExecutionState({
      executionJobId: "job-1",
      runId: "run-1",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-1",
      backendSnapshot: {
        state: "mystery-state",
        checkedAt: "2026-04-08T20:00:00.000Z",
      },
    }, {
      observability,
    });

    expect(snapshot.state).toBe("preparing");
    const normalizationEvent = logger.warnEvents.find((event) => event.event === "progress-normalization.completed");
    expect(normalizationEvent).toBeDefined();
    expect(normalizationEvent?.details?.normalizedState).toBe("preparing");
  });
});
