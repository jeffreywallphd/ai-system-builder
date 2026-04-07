import { z } from "zod";

export const ComfyImageManipulationDatasetBindingAssetId = "asset:config-profile:comfy-image-manipulation-dataset-binding";
export const ComfyImageManipulationDatasetBindingAssetVersionId = "asset:config-profile:comfy-image-manipulation-dataset-binding:v1";
export const ComfyImageManipulationDatasetBindingAssetContractVersion = "1.0.0";

const runtimeHandleSchema = z.object({
  kind: z.literal("dataset-instance"),
  referenceId: z.string().trim().min(1),
  instanceId: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
  datasetAssetId: z.string().trim().min(1).optional(),
  datasetVersionId: z.string().trim().min(1).optional(),
  systemAssetId: z.string().trim().min(1).optional(),
  schemaIntentId: z.string().trim().min(1).optional(),
  storageInstanceRef: z.string().trim().min(1).optional(),
});

export type ComfyImageManipulationDatasetRuntimeHandle = z.infer<typeof runtimeHandleSchema>;

export interface ComfyImageManipulationDatasetBindingAssetDefinition {
  readonly assetId: typeof ComfyImageManipulationDatasetBindingAssetId;
  readonly versionId: typeof ComfyImageManipulationDatasetBindingAssetVersionId;
  readonly contractVersion: typeof ComfyImageManipulationDatasetBindingAssetContractVersion;
  readonly summary: string;
  readonly inputContract: {
    readonly accepts: "dataset-runtime-handles";
    readonly requiredReferenceIds: ReadonlyArray<string>;
  };
  readonly outputContract: {
    readonly emits: "workflow-dataset-binding";
    readonly referenceValueType: "logical-dataset-reference";
  };
  readonly configSurface: {
    readonly inputDatasetReferenceId: "input-image-dataset";
    readonly workflowInputId: "sourceImage";
    readonly supportsSharedStorageInstances: true;
    readonly forbidsRawFilesystemPaths: true;
  };
}

export const ComfyImageManipulationDatasetBindingAsset: ComfyImageManipulationDatasetBindingAssetDefinition = Object.freeze({
  assetId: ComfyImageManipulationDatasetBindingAssetId,
  versionId: ComfyImageManipulationDatasetBindingAssetVersionId,
  contractVersion: ComfyImageManipulationDatasetBindingAssetContractVersion,
  summary: "Resolves workflow source-image dataset binding from logical dataset runtime handles.",
  inputContract: Object.freeze({
    accepts: "dataset-runtime-handles",
    requiredReferenceIds: Object.freeze(["input-image-dataset"]),
  }),
  outputContract: Object.freeze({
    emits: "workflow-dataset-binding",
    referenceValueType: "logical-dataset-reference",
  }),
  configSurface: Object.freeze({
    inputDatasetReferenceId: "input-image-dataset",
    workflowInputId: "sourceImage",
    supportsSharedStorageInstances: true,
    forbidsRawFilesystemPaths: true,
  }),
});

export interface ResolveComfyInputDatasetBindingRequest {
  readonly handles: ReadonlyArray<ComfyImageManipulationDatasetRuntimeHandle>;
  readonly preferredReferenceId?: string;
}

export interface ResolvedComfyInputDatasetBinding {
  readonly bindingId: "input-image-dataset";
  readonly workflowInputId: "sourceImage";
  readonly datasetRef: Readonly<{
    readonly kind: "dataset-instance-reference";
    readonly referenceId: string;
    readonly instanceId: string;
    readonly logicalRef: string;
    readonly storageInstanceRef?: string;
  }>;
}

function forbidPathLikeValue(value: string, label: string): void {
  if (value.includes("/") || value.includes("\\") || value.startsWith(".")) {
    throw new Error(`invalid-request:${label} must be a logical identifier and cannot contain filesystem path segments.`);
  }
}

export function resolveComfyInputDatasetBinding(
  request: ResolveComfyInputDatasetBindingRequest,
): ResolvedComfyInputDatasetBinding {
  const preferredReferenceId = request.preferredReferenceId?.trim() || ComfyImageManipulationDatasetBindingAsset.configSurface.inputDatasetReferenceId;
  const parsedHandles = request.handles.map((entry) => runtimeHandleSchema.parse(entry));
  const handle = parsedHandles.find((entry) => entry.referenceId === preferredReferenceId)
    ?? parsedHandles.find((entry) => entry.role?.includes("input"));
  if (!handle) {
    throw new Error(`invalid-request:Missing dataset runtime handle for '${preferredReferenceId}'.`);
  }

  forbidPathLikeValue(handle.instanceId, "dataset instance id");
  if (handle.storageInstanceRef && handle.storageInstanceRef.startsWith("/storage/")) {
    throw new Error("invalid-request:storage instance references must be logical references, not '/storage/{id}/...' paths.");
  }

  return Object.freeze({
    bindingId: "input-image-dataset",
    workflowInputId: "sourceImage",
    datasetRef: Object.freeze({
      kind: "dataset-instance-reference",
      referenceId: handle.referenceId,
      instanceId: handle.instanceId,
      logicalRef: `dataset-instance://${encodeURIComponent(handle.instanceId)}`,
      storageInstanceRef: handle.storageInstanceRef,
    }),
  });
}
