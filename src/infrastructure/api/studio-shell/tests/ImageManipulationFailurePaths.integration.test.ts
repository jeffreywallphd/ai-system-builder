import { describe, expect, it } from "bun:test";
import { InMemoryStudioShellRepository } from "@infrastructure/studio-shell/InMemoryStudioShellRepository";
import { StudioShellBackendApi } from "../StudioShellBackendApi";
import { ComfyImageManipulationBaseGraph } from "@application/system-studio/ComfyImageManipulationBaseGraph";
import {
  ComfyImageManipulationExecutionContractVersion,
} from "@application/system-studio/ComfyImageManipulationExecutionAdapterContract";
import {
  createComfyExecutionReadinessFailure,
  validateComfyImageManipulationExecutionReadiness,
} from "@application/system-studio/ComfyImageManipulationExecutionValidation";
import {
  ComfyImageManipulationPropertySchema,
  createComfyImageManipulationDefaultConfig,
} from "@application/system-studio/ComfyImageManipulationPropertySchema";
import {
  ImageManipulationTemplateValidationCategories,
  validateImageManipulationTemplateCompleteness,
} from "@application/system-studio/ImageManipulationSystemCompletenessValidationService";
import { SystemBuildTemplateCatalog } from "@application/system-studio/SystemBuildTemplateCatalog";
import { ImageManipulationWorkflowTemplate } from "@application/workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyRuntimeSystemDiagnosticsVersion } from "@application/runtime/ComfyRuntimeSystemDiagnostics";

function createRuntimeDiagnosticsWithMissingCheckpoint() {
  return Object.freeze({
    diagnosticsVersion: ComfyRuntimeSystemDiagnosticsVersion,
    generatedAt: "2026-04-03T12:00:00.000Z",
    runtimeDependencyId: "runtime:comfyui",
    runtimeAssetId: "asset:config-profile:comfyui-runtime-installation",
    runtimeAssetVersionId: "asset:config-profile:comfyui-runtime-installation:v1",
    workflowProfile: "image-manipulation-default",
    orchestrationState: "ready",
    readiness: Object.freeze({
      state: "ready",
      recoverable: false,
      summary: "ok",
      reasons: Object.freeze(["ok"]),
    }),
    repository: Object.freeze({
      stateBefore: "installed",
      stateAfter: "installed",
      operation: "already-current",
      installLocationKey: "runtime-comfyui-install",
      installDirectory: "/runtime/repositories/runtime-comfyui-install",
      validationValid: true,
    }),
    phaseStatus: Object.freeze({
      "model-validation": "completed",
      "custom-nodes": "completed",
    }),
    runtimeLifecycle: Object.freeze({
      state: "healthy",
    }),
    persistedStateRecovery: Object.freeze({
      loaded: false,
      recovered: false,
      reconciliation: "none",
    }),
    validationFailures: Object.freeze([]),
    nextActions: Object.freeze([]),
    failures: Object.freeze([]),
    phaseDiagnostics: Object.freeze([
      Object.freeze({
        phase: "model-validation",
        status: "completed",
        message: "ok",
        startedAt: "2026-04-03T12:00:00.000Z",
        finishedAt: "2026-04-03T12:00:01.000Z",
        issues: Object.freeze([]),
        metadata: Object.freeze({
          modelValidation: Object.freeze({
            result: Object.freeze({
              entries: Object.freeze([
                Object.freeze({
                  requirementId: "checkpoint-default",
                  kind: "checkpoint",
                  displayName: "checkpoint-default",
                  required: true,
                  applicability: "always",
                  status: "missing-required",
                  inspectedDirectory: "/runtime/checkpoint",
                  issues: Object.freeze([]),
                }),
                Object.freeze({
                  requirementId: "vae-default",
                  kind: "vae",
                  displayName: "vae-default",
                  required: true,
                  applicability: "always",
                  status: "present-valid",
                  inspectedDirectory: "/runtime/vae",
                  resolvedFileName: "vae.safetensors",
                  issues: Object.freeze([]),
                }),
              ]),
            }),
          }),
        }),
      }),
      Object.freeze({
        phase: "custom-nodes",
        status: "completed",
        message: "ok",
        startedAt: "2026-04-03T12:00:00.000Z",
        finishedAt: "2026-04-03T12:00:01.000Z",
        issues: Object.freeze([]),
        metadata: Object.freeze({
          customNodeInstall: Object.freeze({
            entries: Object.freeze([]),
          }),
        }),
      }),
    ]),
  });
}

describe("Image manipulation failure-path integration", () => {
  it("fails runnable completeness via shared-storage contract when output storage binding is missing", () => {
    const result = validateImageManipulationTemplateCompleteness({
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          outputBindings: ImageManipulationWorkflowTemplate.composition!.outputBindings.map((binding) => ({
            ...binding,
            targetStorageInstanceRef: "",
          })),
        },
      },
    });

    const issue = result.issues.find((entry) => entry.code === "storage-reference-shape-incomplete");
    expect(result.runnable).toBeFalse();
    expect(result.categories[ImageManipulationTemplateValidationCategories.sharedStorageCompatibility].errors).toBeGreaterThan(0);
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("error");
    expect(issue?.message.length ?? 0).toBeGreaterThan(0);
  });

  it("fails runnable completeness through workflow/property/runtime wiring contract for invalid workflow mapping", () => {
    const result = validateImageManipulationTemplateCompleteness({
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          parameterMappings: ImageManipulationWorkflowTemplate.composition!.parameterMappings.filter((entry) => (
            !(entry.parameterId === "positivePrompt" && entry.workflowAssetId === "asset:workflow:image-to-image")
          )),
        },
      },
    });

    const issue = result.issues.find((entry) => entry.code === "schema-field-workflow-mapping-missing");
    expect(result.runnable).toBeFalse();
    expect(result.categories[ImageManipulationTemplateValidationCategories.pageWorkflowRuntimeWiring].errors).toBeGreaterThan(0);
    expect(issue?.severity).toBe("error");
    expect(issue?.metadata).toBeDefined();
  });

  it("returns normalized runtime-readiness failures when Comfy runtime endpoint is unavailable", () => {
    const readiness = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [Object.freeze({
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      })],
      runtimeMetadata: Object.freeze({
        executionId: "exec:runtime-unavailable",
      }),
      runtimeEnvironment: Object.freeze({
        apiBaseUrl: "",
      }),
    });
    const failure = createComfyExecutionReadinessFailure(readiness, "exec:runtime-unavailable");
    const runtimeIssue = readiness.issues.find((entry) => entry.stage === "runtime-configuration-resolution");

    expect(readiness.ready).toBeFalse();
    expect(runtimeIssue).toBeDefined();
    expect(runtimeIssue?.code).toBe("validation-failed");
    expect(runtimeIssue?.severity).toBe("error");
    expect(failure.error.code).toBe("invalid-request");
    expect(failure.error.category).toBe("validation");
    expect(((failure.error.details as { issues?: ReadonlyArray<unknown> }).issues ?? []).length).toBeGreaterThan(0);
  });

  it("fails readiness with structured model dependency diagnostics when required models are missing", () => {
    const readiness = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [Object.freeze({
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      })],
      runtimeMetadata: Object.freeze({
        executionId: "exec:missing-model",
      }),
      runtimeEnvironment: Object.freeze({
        apiBaseUrl: "http://127.0.0.1:8188",
      }),
      runtimeDiagnostics: createRuntimeDiagnosticsWithMissingCheckpoint() as unknown as Parameters<typeof validateComfyImageManipulationExecutionReadiness>[0]["runtimeDiagnostics"],
    });
    const issue = readiness.issues.find((entry) => entry.code === "runtime-model-required-missing");

    expect(readiness.ready).toBeFalse();
    expect(issue).toBeDefined();
    expect(issue?.stage).toBe("runtime-dependency-readiness");
    expect(issue?.classification).toBe("required-missing-dependency");
    expect(issue?.severity).toBe("error");
    expect((issue?.details?.requirementId as string | undefined)?.length ?? 0).toBeGreaterThan(0);
  });

  it("fails runnable completeness when default configuration is invalid", () => {
    const firstGroup = ComfyImageManipulationPropertySchema.fields[0]!;
    const firstEntry = firstGroup.entries[0]!;
    const result = validateImageManipulationTemplateCompleteness({
      propertySchema: {
        ...ComfyImageManipulationPropertySchema,
        fields: ComfyImageManipulationPropertySchema.fields.map((group) => (
          group.groupId !== firstGroup.groupId
            ? group
            : {
              ...group,
              entries: [
                ...group.entries,
                {
                  ...firstEntry,
                  id: "missing-default-required",
                  path: "prompts.missingDefaultValue",
                  required: true,
                },
              ],
            }
        )),
      },
    });

    const issue = result.issues.find((entry) => entry.code === "required-property-default-missing");
    expect(result.runnable).toBeFalse();
    expect(result.categories[ImageManipulationTemplateValidationCategories.runnableDefaults].errors).toBeGreaterThan(0);
    expect(issue?.path).toBe("propertySchema.defaultConfig.prompts.missingDefaultValue");
    expect(issue?.severity).toBe("error");
  });

  it("surfaces output retrieval failure as structured API failure in output/gallery flow", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const templateEntry = SystemBuildTemplateCatalog[0]!;

    const initialized = await api.initializeStudio("studio-system", "System Studio");
    const created = await api.createDraft({
      studioId: "studio-system",
      sessionId: initialized.data!.activeSessionId!,
      assetId: templateEntry.draftSeed.assetId,
      content: templateEntry.draftSeed.contentTemplate,
      metadata: {
        title: templateEntry.draftSeed.metadataPatch.title ?? "Image Manipulation System",
        summary: templateEntry.draftSeed.metadataPatch.summary,
        tags: templateEntry.draftSeed.metadataPatch.tags ?? ["system", "image-manipulation"],
        taxonomy: templateEntry.draftSeed.metadataPatch.taxonomy!,
        provenance: templateEntry.draftSeed.metadataPatch.provenance,
      },
      dependencies: templateEntry.draftSeed.dependencies,
    });
    expect(created.ok).toBeTrue();

    const missing = await api.getReferenceImageOutput({
      studioId: "studio-system",
      draftId: created.data!.draft!.draftId,
      recordId: "record:missing-output",
    });

    expect(missing.ok).toBeFalse();
    expect(missing.error?.code).toBe("not-found");
    expect(missing.error?.message).toContain("record:missing-output");
    expect(missing.error?.message).toContain("dataset-instance:reference-image:output");
  });
});

