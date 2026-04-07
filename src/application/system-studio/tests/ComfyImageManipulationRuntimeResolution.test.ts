import { describe, expect, it } from "bun:test";
import { ImageManipulationWorkflowTemplate } from "../../workflow-template-studio/ImageManipulationWorkflowTemplate";
import {
  resolveComfyImageManipulationRuntimeConfiguration,
} from "../ComfyImageManipulationRuntimeResolution";
import { createRuntimeCapabilityBindingContract } from "../../system-runtime/RuntimeCapabilityBindingContract";

describe("ComfyImageManipulationRuntimeResolution", () => {
  it("resolves endpoint/runtime defaults from template and environment metadata", () => {
    const resolution = resolveComfyImageManipulationRuntimeConfiguration({
      workflowTemplate: {
        ...ImageManipulationWorkflowTemplate,
        metadata: {
          ...ImageManipulationWorkflowTemplate.metadata,
          runtimeApiBaseUrl: "http://127.0.0.1:8188",
        },
      },
      datasetHandles: [
        {
          kind: "dataset-instance",
          referenceId: "input-image-dataset",
          instanceId: "dataset-instance-ref:reference-image:input",
          storageInstanceRef: "storage-instance://shared-input",
        },
        {
          kind: "dataset-instance",
          referenceId: "output-image-dataset",
          instanceId: "dataset-instance-ref:reference-image:output",
          storageInstanceRef: "storage-instance://shared-output",
        },
      ],
      runtimeEnvironment: {
        backendId: "runtime:comfyui-local",
        runtimeProfile: "comfyui",
      },
    });

    expect(resolution.backendId).toBe("runtime:comfyui-local");
    expect(resolution.endpoint.apiBaseUrl).toBe("http://127.0.0.1:8188");
    expect(resolution.storage.inputStorageInstanceRefs).toEqual(["storage-instance://shared-input"]);
    expect(resolution.storage.outputStorageInstanceRefs).toEqual(["storage-instance://shared-output"]);
    expect(resolution.diagnostics.issues.length).toBe(0);
  });

  it("resolves runtime capability config when a binding is provided", () => {
    const binding = createRuntimeCapabilityBindingContract({
      bindingId: "binding:image-edit",
      systemAssetId: "asset:system:reference-image-manipulation",
      executionProvider: { providerId: "provider:comfyui", providerKind: "image-runtime", labels: [] },
      workflowExecutionProfile: {
        profileId: "profile:image-edit",
        workflowAssetId: "asset:workflow:image-to-image",
        executionIntent: "image-editing",
        requiredCapabilityTags: [],
      },
      modelBindingId: "model-binding:checkpoint",
      executionOptionCapability: {
        sampler: { required: true, allowedValues: ["euler"], defaultValue: "euler" },
        resolution: { required: true, defaultValue: { width: 1024, height: 1024 } },
      },
      executionOptions: {
        sampler: "euler",
        resolution: { width: 1024, height: 1024 },
      },
      availability: { status: "available", missingCapabilities: [] },
    });

    const resolution = resolveComfyImageManipulationRuntimeConfiguration({
      workflowTemplate: ImageManipulationWorkflowTemplate,
      datasetHandles: [],
      runtimeEnvironment: {
        apiBaseUrl: "http://127.0.0.1:8188",
      },
      capabilityBinding: binding,
    });

    expect(resolution.executionConfig).toBeDefined();
    expect(resolution.dependencies.resolved).toContain("provider:comfyui");
    expect(resolution.dependencies.resolved).toContain("model-binding:checkpoint");
  });
});
