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
import { PersistReferenceImageOutputDiagnosticStages } from "../StudioShellBackendApi";

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
  async function createReferenceImageDraft(api: StudioShellBackendApi, studioId: string): Promise<{ readonly draftId: string }> {
    const templateEntry = SystemBuildTemplateCatalog[0]!;
    const initialized = await api.initializeStudio(studioId, "System Studio");
    const created = await api.createDraft({
      studioId,
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
    return Object.freeze({
      draftId: created.data!.draft!.draftId,
    });
  }

  it("rejects invalid uploads early when payload is missing", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const prepared = await createReferenceImageDraft(api, "studio-invalid-upload");

    const uploaded = await api.ingestReferenceImageUpload({
      studioId: "studio-invalid-upload",
      draftId: prepared.draftId,
      fileName: "invalid.png",
      mimeType: "image/png",
      payloadBase64: "",
    });

    expect(uploaded.ok).toBeFalse();
    expect(uploaded.error?.code).toBe("invalid-request");
    expect(uploaded.error?.message).toContain("payload is required");
  });

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

  it("normalizes incompatible saved runtime context as recoverable failure with runtime-configuration guidance", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const prepared = await createReferenceImageDraft(api, "studio-incompatible-runtime-context");
    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-incompatible-runtime-context",
      draftId: prepared.draftId,
      fileName: "context-source.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    expect(upload.ok).toBeTrue();

    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-incompatible-runtime-context",
      draftId: prepared.draftId,
      executionId: "run:incompatible-context:1",
      sourceRecordId: upload.data?.recordId,
      sourceAssetId: upload.data?.image.assetId,
      parameterSnapshot: { resultCount: 1 },
      runtimeContext: {
        contractVersion: "1.0.0",
        selectedImages: [{
          selectionId: upload.data!.recordId,
          imageId: upload.data!.recordId,
          assetRef: {
            assetId: upload.data!.image.assetId,
            recordId: upload.data!.recordId,
          },
        }],
        parameters: { resultCount: 1 },
        datasets: [{
          referenceId: "active-input",
          instanceId: "dataset-instance:reference-image:input",
          datasetAssetId: "asset:dataset:image-reference-input",
          role: "active-input",
        }, {
          referenceId: "system-output",
          instanceId: "dataset-instance:reference-image:output",
          datasetAssetId: "asset:dataset:incompatible-output",
          role: "system-owned-output",
        }],
        runtime: {
          systemAssetId: "asset:system:reference-image-template",
          runtimeSessionId: "runtime:session:incompatible-context:1",
        },
      },
      runtimeResult: {
        status: "completed",
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:incompatible-context:1",
                  status: "completed",
                  outputs: [{
                    nodeId: "save_image",
                    kind: "image",
                    reference: "memory://incompatible-context-1.png",
                  }],
                },
              },
            },
          },
        },
      },
    });

    expect(persisted.ok).toBeTrue();
    expect(persisted.data?.status).toBe("failed");
    expect(persisted.data?.executionOutcome).toBe("recoverable-failure");
    expect(persisted.data?.diagnostics.some((entry) => (
      entry.stage === PersistReferenceImageOutputDiagnosticStages.runtimeConfigurationResolution
      && entry.code === "output-target-incompatible"
      && entry.retryable
    ))).toBeTrue();
  });

  it("treats transient dispatch failures as retryable and keeps authoritative run history coherent", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const prepared = await createReferenceImageDraft(api, "studio-dispatch-failure");
    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-dispatch-failure",
      draftId: prepared.draftId,
      executionId: "run:dispatch-failure:1",
      sourceAssetId: "generated-output:upload://dispatch-source.png",
      runtimeResult: {
        status: "failed",
        diagnostics: [{
          source: "dispatch",
          severity: "error",
          code: "dispatch-timeout",
          message: "Dispatch to backend timed out before acceptance.",
        }],
      },
    });

    expect(persisted.ok).toBeTrue();
    expect(persisted.data?.status).toBe("failed");
    expect(persisted.data?.executionOutcome).toBe("non-recoverable-failure");
    expect(persisted.data?.persistenceBlocked).toBeTrue();
    expect(persisted.data?.diagnostics[0]?.stage).toBe(PersistReferenceImageOutputDiagnosticStages.executionSubmission);
    expect(persisted.data?.diagnostics[0]?.retryable).toBeTrue();

    const history = await api.listReferenceImageRunHistory({
      studioId: "studio-dispatch-failure",
      draftId: prepared.draftId,
      limit: 10,
      offset: 0,
    });
    expect(history.ok).toBeTrue();
    expect(history.data?.summary.totalRuns).toBe(1);
    expect(history.data?.runs[0]?.runId).toBe("run:dispatch-failure:1");
    expect(history.data?.runs[0]?.status).toBe("failed");
    expect(history.data?.runs[0]?.lineage?.status).toBe("incomplete");
  });

  it("captures cancelled runs as terminal persistence-blocked outcomes with explicit guidance", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const prepared = await createReferenceImageDraft(api, "studio-cancelled-run");
    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-cancelled-run",
      draftId: prepared.draftId,
      executionId: "run:cancelled:1",
      sourceAssetId: "generated-output:upload://cancel-source.png",
      runtimeResult: {
        status: "cancelled",
        diagnostics: [{
          source: "dispatch",
          severity: "warning",
          code: "cancelled-by-user",
          message: "Execution cancelled by operator request.",
        }],
      },
    });

    expect(persisted.ok).toBeTrue();
    expect(persisted.data?.status).toBe("failed");
    expect(persisted.data?.userMessage).toContain("cancelled");
    expect(persisted.data?.diagnostics[0]?.code).toBe("execution-cancelled");
    expect(persisted.data?.diagnostics[0]?.retryable).toBeFalse();
    expect(persisted.data?.executionOutcome).toBe("non-recoverable-failure");
    expect(persisted.data?.persistenceBlocked).toBeTrue();
  });

  it("returns recoverable failure when output collection data is missing after completion", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const prepared = await createReferenceImageDraft(api, "studio-missing-output-collection");
    const upload = await api.ingestReferenceImageUpload({
      studioId: "studio-missing-output-collection",
      draftId: prepared.draftId,
      fileName: "missing-output-source.png",
      mimeType: "image/png",
      payloadBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
    });
    expect(upload.ok).toBeTrue();

    const persisted = await api.persistReferenceImageOutputs({
      studioId: "studio-missing-output-collection",
      draftId: prepared.draftId,
      executionId: "run:missing-output:1",
      sourceRecordId: upload.data?.recordId,
      sourceAssetId: upload.data?.image.assetId,
      parameterSnapshot: { resultCount: 1 },
      runtimeContext: {
        contractVersion: "1.0.0",
        selectedImages: [{
          selectionId: upload.data!.recordId,
          imageId: upload.data!.recordId,
          assetRef: {
            assetId: upload.data!.image.assetId,
            recordId: upload.data!.recordId,
          },
        }],
        parameters: { resultCount: 1 },
        datasets: [{
          referenceId: "active-input",
          instanceId: "dataset-instance:reference-image:input",
          datasetAssetId: "asset:dataset:image-reference-input",
          role: "active-input",
        }, {
          referenceId: "system-output",
          instanceId: "dataset-instance:reference-image:output",
          datasetAssetId: "asset:dataset:image-reference-output",
          role: "system-owned-output",
        }],
        runtime: {
          systemAssetId: "asset:system:reference-image-template",
          runtimeSessionId: "runtime:session:missing-output:1",
        },
      },
      runtimeResult: {
        status: "completed",
        output: {
          payload: {
            nodeResults: {
              workflow: {
                result: {
                  executionId: "run:missing-output:1",
                  status: "completed",
                },
              },
            },
          },
        },
      },
    });

    expect(persisted.ok).toBeTrue();
    expect(persisted.data?.status).toBe("failed");
    expect(persisted.data?.executionOutcome).toBe("recoverable-failure");
    expect(persisted.data?.diagnostics[0]?.stage).toBe(PersistReferenceImageOutputDiagnosticStages.pollingLifecycle);
    expect(persisted.data?.diagnostics[0]?.code).toBe("runtime-result-missing-comfy-output");
    expect(persisted.data?.diagnostics[0]?.retryable).toBeTrue();

    const history = await api.listReferenceImageRunHistory({
      studioId: "studio-missing-output-collection",
      draftId: prepared.draftId,
      limit: 10,
      offset: 0,
    });
    expect(history.ok).toBeTrue();
    expect(history.data?.summary.totalRuns).toBe(1);
    expect(history.data?.runs[0]?.status).toBe("failed");
  });
});

