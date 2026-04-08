import { describe, expect, it } from "bun:test";
import {
  ImageManipulationTranslationContractsSchemaVersion,
  ImageManipulationTranslationDiagnosticCategories,
  ImageManipulationTranslationDiagnosticSeverities,
  ImageManipulationTranslationStatuses,
  parseImageManipulationTranslationRequestEnvelope,
  parseImageManipulationTranslationResultEnvelope,
  serializeImageManipulationTranslationRequestEnvelope,
  serializeImageManipulationTranslationResultEnvelope,
  validateImageManipulationTranslationRequest,
  validateImageManipulationTranslationResult,
  type ImageManipulationTranslationRequest,
  type ImageManipulationTranslationResult,
} from "../ports";

function createValidRequest(): ImageManipulationTranslationRequest {
  return {
    contractVersion: ImageManipulationTranslationContractsSchemaVersion,
    translationRequestId: "translation-request:run-1",
    runId: "run-1",
    workspaceId: "workspace-alpha",
    requestedAt: "2026-04-08T18:00:00.000Z",
    requestedByActorId: "user-1",
    correlationId: "corr-1",
    authoritative: {
      workflow: {
        workflowId: "workflow-image-v2",
        workflowLineageId: "workflow-lineage-alpha",
        workflowVersionTag: "1.1.0",
        workflowRevision: 2,
        operationKind: "image-to-image",
        backendTranslation: {
          translatorId: "translator:image-to-image",
          contractVersion: "1.0.0",
          templateId: "template:image-to-image",
          templateVersion: "2.0.0",
          inputBindings: [{
            inputId: "source-image",
            backendField: "inputs.source",
          }],
          parameterBindings: [{
            parameterId: "prompt",
            backendField: "params.prompt",
          }],
          outputBindings: [{
            outputId: "generated-image",
            backendField: "outputs.images[0]",
          }],
        },
      },
      system: {
        systemId: "system-image-1",
        systemVersionId: "system-image-1:v4",
        runtimeProfileId: "runtime:comfy:gpu-default",
        workflowBinding: {
          workflowId: "workflow-image-v2",
          workflowLineageId: "workflow-lineage-alpha",
          workflowVersionTag: "1.1.0",
          workflowRevision: 2,
          requiredInputIds: ["source-image"],
          requiredParameterIds: ["prompt"],
          requiredOutputIds: ["generated-image"],
        },
        parameterBaseline: {
          values: {
            prompt: "cinematic portrait lighting",
            variationStrength: 0.45,
          },
          profileReferences: ["profile://image/defaults/v1"],
        },
      },
    },
    templateResolution: {
      translatorId: "translator:image-to-image",
      contractVersion: "1.0.0",
      templateId: "template:image-to-image",
      templateVersion: "2.0.0",
      adapterFamily: "adapter.comfyui.image-manipulation",
      operationTypeKey: "image-to-image-restyle",
    },
    slotBindings: [{
      bindingId: "slot-binding-1",
      inputId: "source-image",
      backendField: "inputs.source",
      sourceKind: "input-asset",
      logicalReference: "asset://image/source-1",
      required: true,
    }],
    parameterMappings: [{
      parameterId: "prompt",
      backendField: "params.prompt",
      value: "cinematic portrait lighting",
      valueType: "string",
      source: "system-baseline",
    }],
    outputExpectations: [{
      outputId: "generated-image",
      backendField: "outputs.images[0]",
      required: true,
      allowsMultiple: false,
      logicalTargetReference: "dataset-instance://system-output-images",
      expectedValueType: "image-asset-reference",
    }],
    capabilityRequirements: {
      requiredCapabilities: ["gpu", "model:sdxl", "operation:image-to-image"],
      preferredBackendFamily: "adapter.comfyui.image-manipulation",
      minimumAdapterVersion: "1.0.0",
    },
    metadata: {
      launchSource: "system-studio",
    },
  };
}

function createValidSuccessResult(): ImageManipulationTranslationResult {
  return {
    status: ImageManipulationTranslationStatuses.succeeded,
    executionPayload: {
      payloadVersion: "1.0.0",
      backendFamily: "adapter.comfyui.image-manipulation",
      operationKind: "image-to-image",
      template: {
        translatorId: "translator:image-to-image",
        contractVersion: "1.0.0",
        templateId: "template:image-to-image",
        templateVersion: "2.0.0",
      },
      requestContext: {
        translationRequestId: "translation-request:run-1",
        runId: "run-1",
        workspaceId: "workspace-alpha",
        workflowId: "workflow-image-v2",
        systemId: "system-image-1",
        correlationId: "corr-1",
      },
      inputs: {
        "inputs.source": "asset://image/source-1",
      },
      parameters: {
        "params.prompt": "cinematic portrait lighting",
      },
      outputs: [{
        outputId: "generated-image",
        backendField: "outputs.images[0]",
        required: true,
        allowsMultiple: false,
        logicalTargetReference: "dataset-instance://system-output-images",
      }],
      requiredCapabilities: ["gpu", "model:sdxl"],
    },
    diagnostics: [{
      code: "translation-info-template-version",
      severity: ImageManipulationTranslationDiagnosticSeverities.info,
      category: ImageManipulationTranslationDiagnosticCategories.templateResolution,
      path: "templateResolution.templateVersion",
      message: "Resolved template version 2.0.0.",
      blocking: false,
    }],
    metadata: {
      translatedAt: "2026-04-08T18:00:01.000Z",
      translatorId: "translator:image-to-image",
      contractVersion: "1.0.0",
      templateId: "template:image-to-image",
      templateVersion: "2.0.0",
      backendFamily: "adapter.comfyui.image-manipulation",
      mappingSummary: {
        slotBindingCount: 1,
        parameterMappingCount: 1,
        outputExpectationCount: 1,
      },
      diagnosticsSummary: {
        count: 1,
        infoCount: 1,
        warningCount: 0,
        errorCount: 0,
        blockingCount: 0,
      },
    },
  };
}

describe("ImageManipulationTranslationContracts", () => {
  it("validates translation requests that bridge authoritative workflow/system definitions to backend translation inputs", () => {
    const parsed = validateImageManipulationTranslationRequest(createValidRequest());
    expect(parsed.authoritative.workflow.workflowId).toBe("workflow-image-v2");
    expect(parsed.authoritative.system.systemId).toBe("system-image-1");
    expect(parsed.templateResolution.templateId).toBe(parsed.authoritative.workflow.backendTranslation.templateId);
    expect(parsed.slotBindings[0]?.logicalReference).toBe("asset://image/source-1");
    expect(Object.isFrozen(parsed)).toBeTrue();
  });

  it("rejects filesystem path leakage in logical references", () => {
    const base = createValidRequest();
    const invalid: ImageManipulationTranslationRequest = {
      ...base,
      slotBindings: [{
        ...base.slotBindings[0]!,
        logicalReference: "C:\\unsafe\\path\\image.png",
      }],
    };

    expect(() => validateImageManipulationTranslationRequest(invalid)).toThrow(
      "Logical reference values cannot be raw filesystem paths.",
    );
  });

  it("serializes and reloads request envelopes with schema-version enforcement", () => {
    const request = validateImageManipulationTranslationRequest(createValidRequest());
    const envelope = serializeImageManipulationTranslationRequestEnvelope(request);
    const reloaded = parseImageManipulationTranslationRequestEnvelope(envelope);

    expect(reloaded?.schemaVersion).toBe(ImageManipulationTranslationContractsSchemaVersion);
    expect(reloaded?.request.translationRequestId).toBe(request.translationRequestId);

    expect(() => parseImageManipulationTranslationRequestEnvelope({
      schemaVersion: "0.9.0",
      request,
    })).toThrow("unsupported-image-manipulation-translation-request-schema-version:0.9.0");
  });

  it("validates successful translation responses and preserves internal backend execution payload boundaries", () => {
    const result = validateImageManipulationTranslationResult(createValidSuccessResult());
    expect(result.status).toBe(ImageManipulationTranslationStatuses.succeeded);
    if (result.status === ImageManipulationTranslationStatuses.succeeded) {
      expect(result.executionPayload.template.templateId).toBe("template:image-to-image");
      expect(result.executionPayload.requestContext.workflowId).toBe("workflow-image-v2");
      expect(result.metadata.templateId).toBe(result.executionPayload.template.templateId);
    }
  });

  it("requires blocking/error diagnostics on failed translation results and supports result envelope parsing", () => {
    expect(() => validateImageManipulationTranslationResult({
      status: ImageManipulationTranslationStatuses.failed,
      diagnostics: [{
        code: "translation-warning-missing-target",
        severity: ImageManipulationTranslationDiagnosticSeverities.warning,
        category: ImageManipulationTranslationDiagnosticCategories.outputMapping,
        path: "outputExpectations.generated-image",
        message: "Output target missing; default target may apply.",
        blocking: false,
      }],
      metadata: {
        translatedAt: "2026-04-08T18:00:01.000Z",
        translatorId: "translator:image-to-image",
        contractVersion: "1.0.0",
        templateId: "template:image-to-image",
        mappingSummary: {
          slotBindingCount: 1,
          parameterMappingCount: 1,
          outputExpectationCount: 1,
        },
        diagnosticsSummary: {
          count: 1,
          infoCount: 0,
          warningCount: 1,
          errorCount: 0,
          blockingCount: 0,
        },
      },
    })).toThrow("Failed translation results must include at least one blocking/error diagnostic.");

    const successResult = validateImageManipulationTranslationResult(createValidSuccessResult());
    const envelope = serializeImageManipulationTranslationResultEnvelope(successResult);
    const reloaded = parseImageManipulationTranslationResultEnvelope(envelope);
    expect(reloaded?.schemaVersion).toBe(ImageManipulationTranslationContractsSchemaVersion);
    expect(reloaded?.result.status).toBe(ImageManipulationTranslationStatuses.succeeded);
  });
});
