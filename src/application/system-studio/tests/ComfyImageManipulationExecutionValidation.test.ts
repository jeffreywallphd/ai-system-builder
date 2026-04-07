import { describe, expect, it } from "bun:test";
import { ImageManipulationWorkflowTemplate } from "../../workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyImageManipulationBaseGraph } from "../ComfyImageManipulationBaseGraph";
import { createComfyImageManipulationDefaultConfig } from "../ComfyImageManipulationPropertySchema";
import { ComfyRuntimeSystemDiagnosticsVersion } from "../../runtime/ComfyRuntimeSystemDiagnostics";
import {
  createComfyExecutionReadinessFailure,
  validateComfyImageManipulationExecutionReadiness,
} from "../ComfyImageManipulationExecutionValidation";
import { ComfyImageManipulationExecutionContractVersion } from "../ComfyImageManipulationExecutionAdapterContract";

function createRuntimeDiagnostics(input?: {
  readonly modelEntries?: ReadonlyArray<{
    readonly requirementId: string;
    readonly kind: "checkpoint" | "vae" | "faceid-model";
    readonly status: "present-valid" | "missing-required" | "missing-optional" | "incompatible" | "unknown-unverifiable";
    readonly required?: boolean;
    readonly resolvedFileName?: string;
  }>;
  readonly customNodeEntries?: ReadonlyArray<{
    readonly requirementId: string;
    readonly status: "installed" | "updated" | "already-current" | "already-installed" | "failed";
  }>;
}): {
  readonly diagnosticsVersion: typeof ComfyRuntimeSystemDiagnosticsVersion;
} {
  const modelEntries = (input?.modelEntries ?? []).map((entry) => Object.freeze({
    requirementId: entry.requirementId,
    kind: entry.kind,
    displayName: entry.requirementId,
    required: entry.required ?? true,
    applicability: "always" as const,
    status: entry.status,
    inspectedDirectory: `/runtime/${entry.kind}`,
    resolvedFileName: entry.resolvedFileName,
    issues: Object.freeze([]),
  }));
  const customNodeEntries = (input?.customNodeEntries ?? []).map((entry) => Object.freeze({
    requirementId: entry.requirementId,
    status: entry.status,
  }));

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
              entries: Object.freeze(modelEntries),
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
            entries: Object.freeze(customNodeEntries),
          }),
        }),
      }),
    ]),
  });
}

describe("ComfyImageManipulationExecutionValidation", () => {
  it("marks default template configuration execution-ready with no extra user input", () => {
    const result = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: createComfyImageManipulationDefaultConfig(),
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
        storageInstanceRef: "storage-instance://shared-input",
      }],
      runtimeMetadata: {
        executionId: "exec-validation-ready",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(result.ready).toBeTrue();
    expect(result.executionPath).toBe("non-faceid");
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.inspection.mappingResolved).toBeTrue();
    expect(result.inspection.datasetBindingResolved).toBeTrue();
    expect(result.runtimeResolution?.endpoint.apiBaseUrl).toBe("http://127.0.0.1:8188");
  });

  it("validates FaceID-only requirements only when FaceID is enabled", () => {
    const faceIdResult = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: {
        ...createComfyImageManipulationDefaultConfig(),
        faceId: {
          enabled: true,
          referenceBindings: [],
          weight: 0.8,
          startStepFraction: 0,
          endStepFraction: 1,
        },
      },
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      }],
      runtimeMetadata: {
        executionId: "exec-validation-faceid-missing",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(faceIdResult.ready).toBeFalse();
    expect(faceIdResult.executionPath).toBe("faceid");
    expect(faceIdResult.issues.some((issue) => issue.code === "faceid-reference-binding-missing")).toBeTrue();

    const nonFaceIdResult = validateComfyImageManipulationExecutionReadiness({
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
        executionId: "exec-validation-faceid-off",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
    });

    expect(nonFaceIdResult.ready).toBeTrue();
    expect(nonFaceIdResult.issues.some((issue) => issue.code === "faceid-reference-binding-missing")).toBeFalse();
  });

  it("returns normalized execution-ready failure diagnostics", () => {
    const readiness = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        composition: {
          ...ImageManipulationWorkflowTemplate.composition!,
          outputBindings: [],
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
        executionId: "exec-validation-failure",
      },
    });

    expect(readiness.ready).toBeFalse();
    const failure = createComfyExecutionReadinessFailure(readiness, "exec-validation-failure");
    expect(failure.error.code).toBe("invalid-request");
    expect(failure.error.category).toBe("validation");
    expect(((failure.error.details as { issues?: ReadonlyArray<{ code: string }> }).issues ?? []).length).toBeGreaterThan(0);
  });

  it("fails when default checkpoint dependency is missing in runtime diagnostics", () => {
    const result = validateComfyImageManipulationExecutionReadiness({
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
        executionId: "exec-validation-checkpoint-missing",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
      runtimeDiagnostics: createRuntimeDiagnostics({
        modelEntries: [
          { requirementId: "checkpoint-default", kind: "checkpoint", status: "missing-required" },
          { requirementId: "vae-default", kind: "vae", status: "present-valid", resolvedFileName: "vae.safetensors" },
        ],
      }) as unknown as Parameters<typeof validateComfyImageManipulationExecutionReadiness>[0]["runtimeDiagnostics"],
    });

    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "runtime-model-required-missing")).toBeTrue();
    expect(result.issues.some((issue) => issue.classification === "required-missing-dependency")).toBeTrue();
  });

  it("fails when configured VAE model reference cannot be resolved by runtime validation layer", () => {
    const result = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: {
        ...createComfyImageManipulationDefaultConfig(),
        models: {
          ...createComfyImageManipulationDefaultConfig().models,
          vaeModel: "custom-vae-ref",
        },
      },
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      }],
      runtimeMetadata: {
        executionId: "exec-validation-vae-unresolved",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
      runtimeDiagnostics: createRuntimeDiagnostics({
        modelEntries: [
          { requirementId: "checkpoint-default", kind: "checkpoint", status: "present-valid", resolvedFileName: "checkpoint.safetensors" },
          { requirementId: "vae-default", kind: "vae", status: "present-valid", resolvedFileName: "different-vae.safetensors" },
        ],
      }) as unknown as Parameters<typeof validateComfyImageManipulationExecutionReadiness>[0]["runtimeDiagnostics"],
    });

    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "runtime-model-reference-unresolved")).toBeTrue();
    expect(result.issues.some((issue) => issue.classification === "unresolved-dependency-reference")).toBeTrue();
  });

  it("fails when required VAE dependency is unavailable in runtime validation diagnostics", () => {
    const result = validateComfyImageManipulationExecutionReadiness({
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
        executionId: "exec-validation-vae-missing",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
      runtimeDiagnostics: createRuntimeDiagnostics({
        modelEntries: [
          { requirementId: "checkpoint-default", kind: "checkpoint", status: "present-valid", resolvedFileName: "checkpoint.safetensors" },
          { requirementId: "vae-default", kind: "vae", status: "missing-required" },
        ],
      }) as unknown as Parameters<typeof validateComfyImageManipulationExecutionReadiness>[0]["runtimeDiagnostics"],
    });

    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "runtime-model-required-missing")).toBeTrue();
    expect(result.issues.some((issue) => issue.classification === "required-missing-dependency")).toBeTrue();
  });

  it("fails FaceID path readiness when required custom node dependency is unavailable", () => {
    const baseConfig = createComfyImageManipulationDefaultConfig();
    const result = validateComfyImageManipulationExecutionReadiness({
      contractVersion: ComfyImageManipulationExecutionContractVersion,
      workflowTemplate: ImageManipulationWorkflowTemplate,
      baseGraph: ComfyImageManipulationBaseGraph,
      resolvedConfig: {
        ...baseConfig,
        faceId: {
          ...baseConfig.faceId,
          enabled: true,
        },
      },
      datasetHandles: [{
        kind: "dataset-instance",
        referenceId: "input-image-dataset",
        instanceId: "dataset-instance-ref:reference-image:input",
      }],
      runtimeMetadata: {
        executionId: "exec-validation-faceid-custom-node",
      },
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
      runtimeDiagnostics: createRuntimeDiagnostics({
        modelEntries: [
          { requirementId: "checkpoint-default", kind: "checkpoint", status: "present-valid", resolvedFileName: "checkpoint.safetensors" },
          { requirementId: "vae-default", kind: "vae", status: "present-valid", resolvedFileName: "vae.safetensors" },
          { requirementId: "faceid-model", kind: "faceid-model", status: "present-valid", resolvedFileName: "faceid.onnx" },
        ],
        customNodeEntries: [
          { requirementId: "comfyui-ipadapter-plus", status: "failed" },
          { requirementId: "comfyui-instantid", status: "already-installed" },
        ],
      }) as unknown as Parameters<typeof validateComfyImageManipulationExecutionReadiness>[0]["runtimeDiagnostics"],
    });

    expect(result.executionPath).toBe("faceid");
    expect(result.ready).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "custom-node-dependency-incompatible")).toBeTrue();
    expect(result.issues.some((issue) => issue.classification === "incompatible-dependency")).toBeTrue();
  });
});
