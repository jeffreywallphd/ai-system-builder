import { describe, expect, it } from "bun:test";
import { ComfyRuntimeSystemDiagnosticsVersion } from "../../runtime/ComfyRuntimeSystemDiagnostics";
import { ImageManipulationWorkflowTemplate } from "../../workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyImageManipulationBaseGraph } from "../ComfyImageManipulationBaseGraph";
import { ComfyImageManipulationExecutionContractVersion } from "../ComfyImageManipulationExecutionAdapterContract";
import { createComfyImageManipulationDefaultConfig } from "../ComfyImageManipulationPropertySchema";
import {
  validateComfyImageManipulationExecutionReadiness,
} from "../ComfyImageManipulationExecutionValidation";
import {
  ImageManipulationTemplateValidationCategories,
  validateImageManipulationTemplateCompleteness,
} from "../ImageManipulationSystemCompletenessValidationService";
import { ImageManipulationSystemTemplate } from "../ImageManipulationSystemTemplate";
import { SystemBuildTemplateCatalog } from "../SystemBuildTemplateCatalog";

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

describe("Image manipulation runnable-template contract regression", () => {
  it("keeps the seeded default template runnable and complete with no extra setup", () => {
    const templateEntry = SystemBuildTemplateCatalog[0]!;
    const result = validateImageManipulationTemplateCompleteness({
      template: ImageManipulationSystemTemplate,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      buildTemplateContent: templateEntry.draftSeed.contentTemplate,
    });

    expect(result.runnable).toBeTrue();
    expect(result.issues).toHaveLength(0);
    expect(result.categories[ImageManipulationTemplateValidationCategories.runnableDefaults].errors).toBe(0);
    expect(result.categories[ImageManipulationTemplateValidationCategories.pageWorkflowRuntimeWiring].errors).toBe(0);
    expect(result.categories[ImageManipulationTemplateValidationCategories.sharedStorageCompatibility].errors).toBe(0);
    expect(result.categories[ImageManipulationTemplateValidationCategories.runtimeDependencyReadiness].errors).toBe(0);
  });

  it("fails when required page/workflow/runtime/schema bindings regress", () => {
    const result = validateImageManipulationTemplateCompleteness({
      template: {
        ...ImageManipulationSystemTemplate,
        uiBindingBoundary: {
          ...ImageManipulationSystemTemplate.uiBindingBoundary,
          emits: ImageManipulationSystemTemplate.uiBindingBoundary.emits.filter((eventId) => eventId !== "runRequested"),
        },
        compositionBindings: {
          ...ImageManipulationSystemTemplate.compositionBindings,
          runtimeBindingId: "" as typeof ImageManipulationSystemTemplate.compositionBindings.runtimeBindingId,
          propertySchemaBindingId: "schema:invalid" as typeof ImageManipulationSystemTemplate.compositionBindings.propertySchemaBindingId,
        },
      },
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          parameterMappings: ImageManipulationWorkflowTemplate.composition!.parameterMappings.filter((entry) => (
            entry.parameterId !== "positivePrompt"
          )),
        },
      },
    });

    expect(result.runnable).toBeFalse();
    expect(result.issues.map((entry) => entry.code)).toContain("page-execution-action-binding-missing");
    expect(result.issues.map((entry) => entry.code)).toContain("runtime-binding-id-missing");
    expect(result.issues.map((entry) => entry.code)).toContain("property-schema-binding-mismatch");
    expect(result.issues.map((entry) => entry.code)).toContain("schema-field-workflow-mapping-missing");
  });

  it("fails when shared storage references regress to system-owned/path assumptions", () => {
    const result = validateImageManipulationTemplateCompleteness({
      template: {
        ...ImageManipulationSystemTemplate,
        datasetInstances: ImageManipulationSystemTemplate.datasetInstances.map((entry) => (
          entry.bindingId === "output-image-dataset"
            ? { ...entry, instanceId: "/systems/system-a/output" }
            : entry
        )),
      },
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          outputBindings: ImageManipulationWorkflowTemplate.composition!.outputBindings.map((binding) => ({
            ...binding,
            targetStorageInstanceRef: "C:\\runtime\\output",
          })),
        },
      },
    });

    expect(result.runnable).toBeFalse();
    expect(result.issues.map((entry) => entry.code)).toContain("dataset-binding-system-path-assumption-forbidden");
    expect(result.issues.map((entry) => entry.code)).toContain("workflow-output-storage-instance-ref-raw-path-forbidden");
    expect(result.categories[ImageManipulationTemplateValidationCategories.sharedStorageCompatibility].errors).toBeGreaterThan(0);
  });

  it("fails execution readiness when runtime layer output binding uses non-logical storage references", () => {
    const readiness = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          outputBindings: ImageManipulationWorkflowTemplate.composition!.outputBindings.map((binding) => ({
            ...binding,
            targetStorageInstanceRef: "/tmp/output",
          })),
        },
      },
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      }],
      runtimeMetadata: {
        executionId: "exec-regression-storage-reference-invalid",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(readiness.ready).toBeFalse();
    expect(readiness.issues.some((issue) => issue.code === "materialization-storage-reference-invalid")).toBeTrue();
  });

  it("fails execution readiness when required default model dependency is missing", () => {
    const readiness = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      }],
      runtimeMetadata: {
        executionId: "exec-regression-missing-checkpoint",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
      runtimeDiagnostics: createRuntimeDiagnosticsWithMissingCheckpoint() as unknown as Parameters<typeof validateComfyImageManipulationExecutionReadiness>[0]["runtimeDiagnostics"],
    });

    expect(readiness.ready).toBeFalse();
    const issue = readiness.issues.find((entry) => entry.code === "runtime-model-required-missing");
    expect(issue).toBeDefined();
    expect(issue?.classification).toBe("required-missing-dependency");
  });
});
