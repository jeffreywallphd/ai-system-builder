import { ImageManipulationSystemTemplate } from "../system-studio/ImageManipulationSystemTemplate";
import {
  type LaunchSystemRuntimeWindowRequest,
  createSystemRuntimeWindowLaunchContract,
  type SystemRuntimeWindowLaunchContract,
} from "./SystemRuntimeWindowLaunchContract";

function createLaunchId(seed: {
  readonly studioId: string;
  readonly draftId?: string;
  readonly systemAssetId: string;
}): string {
  const base = `${seed.studioId}:${seed.draftId ?? "draft"}:${seed.systemAssetId}:${Date.now().toString(36)}`;
  return `runtime-window:${base}`;
}

export interface ResolveSystemRuntimeWindowLaunchInput {
  readonly launchId?: string;
  readonly createdAt?: Date;
  readonly launchTarget: SystemRuntimeWindowLaunchContract["launchTarget"];
  readonly resolution: SystemRuntimeWindowLaunchContract["resolution"];
  readonly runtimeContextPayload?: SystemRuntimeWindowLaunchContract["runtimeContextPayload"];
  readonly datasetBindings?: SystemRuntimeWindowLaunchContract["datasetBindings"];
  readonly initialSelection?: SystemRuntimeWindowLaunchContract["initialSelection"];
  readonly launchMode?: SystemRuntimeWindowLaunchContract["launchMode"];
  readonly windowIntent?: SystemRuntimeWindowLaunchContract["windowIntent"];
  readonly expectedResult?: SystemRuntimeWindowLaunchContract["expectedResult"];
}

export function resolveSystemRuntimeWindowLaunchContract(
  input: ResolveSystemRuntimeWindowLaunchInput,
): SystemRuntimeWindowLaunchContract {
  return createSystemRuntimeWindowLaunchContract({
    contractVersion: "ai-loom.runtime-window-launch.v1",
    launchId: input.launchId ?? createLaunchId({
      studioId: input.resolution.studioId,
      draftId: input.resolution.draftId,
      systemAssetId: input.launchTarget.systemAssetId,
    }),
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    launchTarget: input.launchTarget,
    resolution: input.resolution,
    runtimeContextPayload: input.runtimeContextPayload ?? {},
    datasetBindings: input.datasetBindings ?? [],
    initialSelection: input.initialSelection ?? {},
    launchMode: input.launchMode ?? "interactive",
    windowIntent: input.windowIntent ?? {
      intent: "runtime-editor",
      focus: "foreground",
    },
    expectedResult: input.expectedResult ?? {
      expectedResult: "execution-summary",
      metadata: {},
    },
  });
}

export interface CreateImageManipulationRuntimeWindowLaunchRequest {
  readonly studioId: string;
  readonly draftId: string;
  readonly sessionId?: string;
  readonly systemAssetId: string;
  readonly systemAssetVersionId?: string;
  readonly targetKind?: "standalone-system" | "embedded-subsystem";
  readonly subsystemId?: string;
  readonly runtimeContextPayload?: Readonly<Record<string, unknown>>;
  readonly initialSelection?: {
    readonly selectedDatasetBindingId?: string;
    readonly activePreviewRole?: string;
    readonly presetId?: string;
    readonly selectedRecordIds?: Readonly<Record<string, string>>;
  };
  readonly launchMode?: SystemRuntimeWindowLaunchContract["launchMode"];
  readonly expectedResult?: SystemRuntimeWindowLaunchContract["expectedResult"];
}

export function createImageManipulationRuntimeWindowLaunchContract(
  input: CreateImageManipulationRuntimeWindowLaunchRequest,
): SystemRuntimeWindowLaunchContract {
  return resolveSystemRuntimeWindowLaunchContract({
    launchTarget: {
      targetKind: input.targetKind ?? "standalone-system",
      systemAssetId: input.systemAssetId,
      systemAssetVersionId: input.systemAssetVersionId,
      subsystemId: input.subsystemId,
      pageBindingId: ImageManipulationSystemTemplate.compositionBindings.pageBindingId,
      runtimeBindingId: ImageManipulationSystemTemplate.compositionBindings.runtimeBindingId,
    },
    resolution: {
      studioId: input.studioId,
      draftId: input.draftId,
      sessionId: input.sessionId,
      systemAssetId: input.systemAssetId,
      systemAssetVersionId: input.systemAssetVersionId,
      template: {
        templateAssetId: ImageManipulationSystemTemplate.systemAsset.assetId,
        workflowTemplateAssetId: ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
        workflowTemplateVersionId: ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
      },
    },
    runtimeContextPayload: input.runtimeContextPayload ?? {},
    datasetBindings: [
      {
        bindingId: "input-image-dataset",
        datasetBindingId: "input-image-dataset",
        datasetAssetId: ImageManipulationSystemTemplate.datasetInstances.input.datasetAssetId,
        sharingScope: "shared",
        metadata: {
          role: "input",
        },
      },
      {
        bindingId: "output-image-dataset",
        datasetBindingId: "output-image-dataset",
        datasetAssetId: ImageManipulationSystemTemplate.datasetInstances.output.datasetAssetId,
        sharingScope: "shared",
        metadata: {
          role: "output",
        },
      },
      {
        bindingId: "reference-image-dataset",
        datasetBindingId: "reference-image-dataset",
        datasetAssetId: ImageManipulationSystemTemplate.datasetInstances.reference.datasetAssetId,
        sharingScope: "shared",
        metadata: {
          role: "reference",
          optional: true,
        },
      },
    ],
    initialSelection: {
      selectedDatasetBindingId: input.initialSelection?.selectedDatasetBindingId ?? "input-image-dataset",
      activePreviewRole: input.initialSelection?.activePreviewRole ?? "output",
      presetId: input.initialSelection?.presetId,
      selectedRecordIds: input.initialSelection?.selectedRecordIds ?? {},
    },
    launchMode: input.launchMode ?? "interactive",
    windowIntent: {
      intent: "runtime-editor",
      focus: "foreground",
      reuseWindowKey: `${input.studioId}:${ImageManipulationSystemTemplate.compositionBindings.pageBindingId}`,
      titleHint: "Image Runtime",
      dimensions: {
        width: 1440,
        height: 960,
      },
    },
    expectedResult: input.expectedResult ?? {
      expectedResult: "execution-summary",
      metadata: {
        templateId: ImageManipulationSystemTemplate.templateId,
      },
    },
  });
}

export function createImageManipulationRuntimeWindowLaunchRequest(
  input: CreateImageManipulationRuntimeWindowLaunchRequest,
): LaunchSystemRuntimeWindowRequest {
  return Object.freeze({
    launchContract: createImageManipulationRuntimeWindowLaunchContract(input),
  });
}
