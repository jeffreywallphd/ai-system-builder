import { describe, expect, it, mock } from "bun:test";
import {
  ImageManipulationTranslationContractsSchemaVersion,
  ImageManipulationTranslationStatuses,
  type ImageManipulationTranslationRequest,
} from "@application/image-workflows/ports";
import {
  createInitialSupportedImageWorkflowTemplateRegistry,
  type InitialImageWorkflowTemplateDefinition,
} from "@application/image-workflows/InitialSupportedImageWorkflowTemplateRegistry";
import {
  RunExecutionBackendKinds,
  type CanonicalRunExecutionCommand,
} from "@application/runs/ports/RunExecutionDispatchPorts";
import { ComfyImageManipulationTemplateTranslationAdapter } from "@infrastructure/comfyui/execution/mappers/ComfyImageManipulationTemplateTranslationAdapter";
import { ComfyUiTransportClient } from "../comfyui/ComfyUiTransportClient";
import { ComfyUiRunExecutionDispatchAdapter, ComfyUiRunExecutionDispatchError } from "../runs/ComfyUiRunExecutionDispatchAdapter";
import { ComfyUiRunExecutionTransportGateway } from "../runs/ComfyUiRunExecutionTransportGateway";

function buildRequestFromTemplate(
  template: InitialImageWorkflowTemplateDefinition,
): ImageManipulationTranslationRequest {
  const parameterValues = template.configuration.defaults.parameterValues;

  return {
    contractVersion: ImageManipulationTranslationContractsSchemaVersion,
    translationRequestId: `translation:${template.templateFamilyId}`,
    runId: `run:${template.templateFamilyId}`,
    workspaceId: "workspace:integration",
    requestedAt: "2026-04-08T22:00:00.000Z",
    authoritative: {
      workflow: {
        workflowId: template.templateFamilyId,
        workflowLineageId: template.templateFamilyId.replace(/:v\d+$/i, ""),
        workflowVersionTag: "1.0.0",
        workflowRevision: 1,
        operationKind: template.operationKind,
        backendTranslation: {
          translatorId: template.translation.adapterFamily,
          contractVersion: "1.0.0",
          templateId: template.templateFamilyId,
          templateVersion: "v1",
          inputBindings: template.translation.inputMappings.map((entry) => Object.freeze({
            inputId: entry.inputId,
            backendField: entry.translationKey,
          })),
          parameterBindings: template.translation.parameterMappings.map((entry) => Object.freeze({
            parameterId: entry.parameterId,
            backendField: entry.translationKey,
          })),
          outputBindings: template.translation.outputMappings.map((entry) => Object.freeze({
            outputId: entry.outputId,
            backendField: entry.translationKey,
          })),
        },
      },
      system: {
        systemId: `system:${template.templateFamilyId}`,
        workflowBinding: {
          workflowId: template.templateFamilyId,
          workflowLineageId: template.templateFamilyId.replace(/:v\d+$/i, ""),
          workflowVersionTag: "1.0.0",
          workflowRevision: 1,
          requiredInputIds: template.minimumRequirements.inputSlots
            .filter((entry) => entry.required)
            .map((entry) => entry.inputId),
          requiredParameterIds: template.minimumRequirements.parameterSpecifications
            .filter((entry) => entry.required)
            .map((entry) => entry.parameterId),
          requiredOutputIds: template.minimumRequirements.outputExpectations
            .filter((entry) => entry.required)
            .map((entry) => entry.outputId),
        },
        parameterBaseline: {
          values: parameterValues,
          profileReferences: [],
        },
      },
    },
    templateResolution: {
      translatorId: template.translation.adapterFamily,
      contractVersion: "1.0.0",
      templateId: template.templateFamilyId,
      templateVersion: "v1",
      adapterFamily: template.translation.adapterFamily,
      operationTypeKey: template.translation.operationTypeKey,
    },
    slotBindings: template.translation.inputMappings.map((entry, index) => Object.freeze({
      bindingId: `slot-${index + 1}`,
      inputId: entry.inputId,
      backendField: entry.translationKey,
      sourceKind: "input-asset",
      logicalReference: `asset://input/${entry.inputId}`,
      required: entry.required,
    })),
    parameterMappings: template.translation.parameterMappings.map((entry) => Object.freeze({
      parameterId: entry.parameterId,
      backendField: entry.translationKey,
      value: parameterValues[entry.parameterId],
      source: "system-baseline",
    })),
    outputExpectations: template.translation.outputMappings.map((entry) => Object.freeze({
      outputId: entry.outputId,
      backendField: entry.translationKey,
      required: entry.required,
      allowsMultiple: false,
      logicalTargetReference: `dataset-instance://output/${entry.outputId}`,
    })),
    capabilityRequirements: {
      requiredCapabilities: [template.compatibility.requiredOperationCapability],
      preferredBackendFamily: template.compatibility.translationBackendFamilies[0],
    },
  };
}

function getFirstSupportedTemplate(): InitialImageWorkflowTemplateDefinition {
  const first = createInitialSupportedImageWorkflowTemplateRegistry().list()[0];
  if (!first) {
    throw new Error("Expected at least one supported image workflow template.");
  }
  return first;
}

function createComfyDispatchCommand(input: {
  readonly runId: string;
  readonly workflowId: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}): CanonicalRunExecutionCommand {
  return Object.freeze({
    commandId: `run-execution-command:dispatch-attempt:${input.runId}`,
    dispatchAttemptId: `dispatch-attempt:${input.runId}`,
    preparedAt: "2026-04-08T22:01:00.000Z",
    run: Object.freeze({
      runId: input.runId,
      workflowId: input.workflowId,
      workspaceId: "workspace:integration",
      submittedAt: "2026-04-08T22:00:30.000Z",
      source: "api",
      correlationId: `corr:${input.runId}`,
    }),
    queue: Object.freeze({
      queueId: "queue:image-manipulation",
    }),
    assignment: Object.freeze({
      nodeId: "node:trusted:comfy",
      reservationOwner: "orchestrator:image",
      claimToken: `claim:${input.runId}`,
    }),
    runtimeTarget: Object.freeze({
      systemId: "comfyui",
      versionId: "runtime:v1",
      async: true,
    }),
    backend: Object.freeze({
      kind: RunExecutionBackendKinds.comfyUi,
    }),
    inputs: Object.freeze({
      tags: Object.freeze(["priority:normal"]),
      parameters: input.parameters,
    }),
    references: Object.freeze({
      storageReferences: Object.freeze([]),
      resourceReferences: Object.freeze([]),
      policyPrerequisites: Object.freeze([]),
    }),
  });
}

function createDispatchParametersFromTranslation(
  translated: Readonly<{ inputs: Readonly<Record<string, unknown>>; parameters: Readonly<Record<string, unknown>> }>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...translated.parameters,
    "comfy.request": translated.inputs["comfy.request"],
  });
}

describe("ComfyUI translation and dispatch integration", () => {
  it("translates the supported template set and dispatches normalized requests through the transport gateway", async () => {
    const registry = createInitialSupportedImageWorkflowTemplateRegistry();
    const translator = new ComfyImageManipulationTemplateTranslationAdapter();
    const submittedBodies: unknown[] = [];

    const fetchFn = mock(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      submittedBodies.push(body);
      return new Response(JSON.stringify({
        prompt_id: `prompt-${submittedBodies.length}`,
        number: submittedBodies.length,
      }));
    });

    const transport = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T22:02:00.000Z"),
    });
    const gateway = new ComfyUiRunExecutionTransportGateway(transport);
    const adapter = new ComfyUiRunExecutionDispatchAdapter({ gateway });

    let expectedPromptIdCounter = 0;
    for (const template of registry.list()) {
      const request = buildRequestFromTemplate(template);
      const translated = await translator.translateToBackendPayload(request);

      expect(translated.status).toBe(ImageManipulationTranslationStatuses.succeeded);
      if (translated.status === ImageManipulationTranslationStatuses.succeeded) {
        const command = createComfyDispatchCommand({
          runId: request.runId,
          workflowId: request.authoritative.workflow.workflowId,
          parameters: createDispatchParametersFromTranslation(translated.executionPayload),
        });

        const receipt = await adapter.dispatch(command);
        expectedPromptIdCounter += 1;

        expect(receipt.backendRunId).toBe(`prompt-${expectedPromptIdCounter}`);
        expect(receipt.status).toBe("accepted");
        expect(receipt.metadata).toEqual(Object.freeze({
          queueNumber: expectedPromptIdCounter,
          runtime: "comfyui",
          submissionKind: "comfyui-prompt",
        }));

        const metadataRecord = receipt.metadata as Readonly<Record<string, unknown>>;
        expect(metadataRecord.prompt).toBeUndefined();
      }
    }

    expect(submittedBodies.length).toBe(registry.list().length);
    for (const body of submittedBodies) {
      expect(body).toBeObject();
      const keys = Object.keys(body as Record<string, unknown>).sort();
      expect(keys).toEqual(["client_id", "prompt"]);
    }
  });

  it("returns blocking translation diagnostics for invalid template mappings and short-circuits dispatch", async () => {
    const translator = new ComfyImageManipulationTemplateTranslationAdapter();
    const template = getFirstSupportedTemplate();
    const request = buildRequestFromTemplate(template);
    const invalidRequest: ImageManipulationTranslationRequest = Object.freeze({
      ...request,
      templateResolution: Object.freeze({
        ...request.templateResolution,
        templateId: "image-template:unsupported-translation:v1",
      }),
      authoritative: Object.freeze({
        ...request.authoritative,
        workflow: Object.freeze({
          ...request.authoritative.workflow,
          backendTranslation: Object.freeze({
            ...request.authoritative.workflow.backendTranslation,
            templateId: "image-template:unsupported-translation:v1",
          }),
        }),
      }),
    });

    const fetchFn = mock(async () => new Response(JSON.stringify({
      prompt_id: "prompt-never-submitted",
    })));
    const transport = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });
    const gateway = new ComfyUiRunExecutionTransportGateway(transport);
    const adapter = new ComfyUiRunExecutionDispatchAdapter({ gateway });

    const translated = await translator.translateToBackendPayload(invalidRequest);
    expect(translated.status).toBe(ImageManipulationTranslationStatuses.failed);
    if (translated.status === ImageManipulationTranslationStatuses.failed) {
      expect(translated.diagnostics.some((entry) => entry.code === "unsupported-template-id")).toBeTrue();
      expect(translated.metadata.diagnosticsSummary.blockingCount).toBeGreaterThan(0);
    }

    if (translated.status === ImageManipulationTranslationStatuses.succeeded) {
      await adapter.dispatch(createComfyDispatchCommand({
        runId: invalidRequest.runId,
        workflowId: invalidRequest.authoritative.workflow.workflowId,
        parameters: createDispatchParametersFromTranslation(translated.executionPayload),
      }));
    }

    expect(fetchFn.mock.calls.length).toBe(0);
  });

  it("normalizes backend-unavailable dispatch failures after successful translation", async () => {
    const translator = new ComfyImageManipulationTemplateTranslationAdapter();
    const template = getFirstSupportedTemplate();
    const request = buildRequestFromTemplate(template);
    const translated = await translator.translateToBackendPayload(request);

    expect(translated.status).toBe(ImageManipulationTranslationStatuses.succeeded);
    if (translated.status !== ImageManipulationTranslationStatuses.succeeded) {
      throw new Error("Expected successful translation before dispatch failure scenario.");
    }

    const fetchFn = mock(async () => {
      throw new Error("ECONNREFUSED");
    });
    const transport = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });
    const gateway = new ComfyUiRunExecutionTransportGateway(transport);
    const adapter = new ComfyUiRunExecutionDispatchAdapter({ gateway });

    try {
      await adapter.dispatch(createComfyDispatchCommand({
        runId: request.runId,
        workflowId: request.authoritative.workflow.workflowId,
        parameters: createDispatchParametersFromTranslation(translated.executionPayload),
      }));
      throw new Error("Expected backend-unavailable dispatch failure.");
    } catch (error) {
      const typed = error as ComfyUiRunExecutionDispatchError;
      expect(typed).toBeInstanceOf(ComfyUiRunExecutionDispatchError);
      expect(typed.failure.category).toBe("connectivity");
      expect(typed.failure.code).toBe("dispatch-connectivity-failed");
      expect(typed.failure.retryable).toBeTrue();
    }
  });

  it("normalizes malformed backend prompt submission responses after successful translation", async () => {
    const translator = new ComfyImageManipulationTemplateTranslationAdapter();
    const template = getFirstSupportedTemplate();
    const request = buildRequestFromTemplate(template);
    const translated = await translator.translateToBackendPayload(request);

    expect(translated.status).toBe(ImageManipulationTranslationStatuses.succeeded);
    if (translated.status !== ImageManipulationTranslationStatuses.succeeded) {
      throw new Error("Expected successful translation before malformed-response scenario.");
    }

    const fetchFn = mock(async () => new Response(JSON.stringify({
      number: 44,
    })));
    const transport = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });
    const gateway = new ComfyUiRunExecutionTransportGateway(transport);
    const adapter = new ComfyUiRunExecutionDispatchAdapter({ gateway });

    try {
      await adapter.dispatch(createComfyDispatchCommand({
        runId: request.runId,
        workflowId: request.authoritative.workflow.workflowId,
        parameters: createDispatchParametersFromTranslation(translated.executionPayload),
      }));
      throw new Error("Expected invalid-response dispatch failure.");
    } catch (error) {
      const typed = error as ComfyUiRunExecutionDispatchError;
      expect(typed).toBeInstanceOf(ComfyUiRunExecutionDispatchError);
      expect(typed.failure.category).toBe("validation");
      expect(typed.failure.code).toBe("dispatch-invalid-request-data");
      expect(typed.failure.retryable).toBeFalse();
    }
  });
});
