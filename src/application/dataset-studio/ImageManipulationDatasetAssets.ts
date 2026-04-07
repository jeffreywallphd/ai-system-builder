import { AssetContractShapeKinds } from "../../domain/contracts/AssetContract";
import { createCanonicalImageMetadataRecordsShape } from "../../domain/dataset-studio/CanonicalDataShapes";
import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import {
  DataAssetRuntimeAccessPatterns,
  DataAssetRuntimeInstanceOwnershipKinds,
  DataAssetRuntimeMutabilityModes,
  DataAssetRuntimeStateScopes,
  DataAssetRuntimeUsabilityModes,
  DataAssetRuntimeWriteBehaviorKinds,
  type DataAssetBase,
} from "../../domain/dataset-studio/DataAssetBase";
import {
  DataAssetDiscoverabilityScopes,
  DataAssetRegistrySpecializations,
  type DataAssetRegistry,
  type DataAssetRegistryEntry,
} from "./DataAssetRegistry";

export const ImageManipulationInputDatasetAssetId = "asset:dataset:image-reference-input";
export const ImageManipulationOutputDatasetAssetId = "asset:dataset:image-reference-output";
export const ImageManipulationFaceIdReferenceDatasetAssetId = "asset:dataset:image-faceid-reference";

function createImageDatasetAsset(input: {
  readonly assetId: string;
  readonly name: string;
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
  readonly revision: number;
  readonly writeBehavior: "system-only" | "workflow-and-system";
}): DataAssetBase {
  const writeBehavior = input.writeBehavior === "system-only"
    ? DataAssetRuntimeWriteBehaviorKinds.systemOnly
    : DataAssetRuntimeWriteBehaviorKinds.workflowAndSystem;

  return new CanonicalDataAsset({
    id: input.assetId,
    name: input.name,
    version: "1.0.0",
    source: {
      type: "generated",
      workflowId: "image-manipulation-system-template",
    },
    location: {
      accessMethod: "virtual",
      location: `dataset://${input.assetId.replaceAll(":", "/")}`,
      format: "image-metadata-records",
    },
    outputShape: createCanonicalImageMetadataRecordsShape({
      items: Object.freeze([]),
      metadata: {
        schemaVersion: "1.0.0",
      },
    }),
    contracts: {
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Canonical image metadata record payloads for system-owned image datasets.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Canonical image metadata records with preview-friendly metadata and asset references.",
      },
      execution: {
        invocationMode: "deferred",
        sideEffects: "bounded",
      },
      parameters: Object.freeze([]),
    },
    composableInputShapeKinds: Object.freeze(["image-metadata-records"]),
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: input.revision,
      publishedVersionId: "1.0.0",
    },
    semanticMetadata: {
      description: input.summary,
      tags: input.tags,
    },
    runtime: {
      usability: DataAssetRuntimeUsabilityModes.runtimeOperational,
      instanceOwnership: {
        owner: DataAssetRuntimeInstanceOwnershipKinds.system,
        stateScope: DataAssetRuntimeStateScopes.systemInstance,
      },
      mutability: {
        mode: DataAssetRuntimeMutabilityModes.mutable,
        writeBehavior,
      },
      accessPatterns: [
        DataAssetRuntimeAccessPatterns.scanRead,
        DataAssetRuntimeAccessPatterns.pointLookup,
        DataAssetRuntimeAccessPatterns.appendWrite,
        DataAssetRuntimeAccessPatterns.upsertWrite,
      ],
    },
  });
}

export function createImageManipulationInputImageDatasetAsset(): DataAssetBase {
  return createImageDatasetAsset({
    assetId: ImageManipulationInputDatasetAssetId,
    name: "Image Manipulation Input Dataset",
    summary: "Primary editable source-image dataset for image manipulation systems.",
    tags: Object.freeze(["image", "dataset", "input", "runtime"]),
    revision: 1,
    writeBehavior: "workflow-and-system",
  });
}

export function createImageManipulationOutputImageDatasetAsset(): DataAssetBase {
  return createImageDatasetAsset({
    assetId: ImageManipulationOutputDatasetAssetId,
    name: "Image Manipulation Output Dataset",
    summary: "System-owned generated output image dataset for image manipulation runs.",
    tags: Object.freeze(["image", "dataset", "output", "runtime"]),
    revision: 1,
    writeBehavior: "system-only",
  });
}

export function createImageManipulationFaceIdReferenceDatasetAsset(): DataAssetBase {
  return createImageDatasetAsset({
    assetId: ImageManipulationFaceIdReferenceDatasetAssetId,
    name: "Image Manipulation FaceID Reference Dataset",
    summary: "Optional FaceID reference image dataset for identity-preserving image manipulation flows.",
    tags: Object.freeze(["image", "dataset", "faceid", "reference", "runtime", "optional"]),
    revision: 1,
    writeBehavior: "workflow-and-system",
  });
}

export function registerImageManipulationDatasetAssets(
  registry: DataAssetRegistry,
): ReadonlyArray<DataAssetRegistryEntry> {
  const inputEntry = registry.register({
    asset: createImageManipulationInputImageDatasetAsset(),
    specialization: DataAssetRegistrySpecializations.dataset,
    category: "image-manipulation",
    display: {
      title: "Image Manipulation Input Dataset",
      summary: "Primary source images for prompt-based image editing systems.",
      tags: ["image", "input", "editable"],
    },
    inspectability: {
      supportedSourceKinds: ["dataset-instance", "workflow-output"],
      supportedFileExtensions: [".png", ".jpg", ".jpeg", ".webp"],
      supportedMediaTypes: ["image/png", "image/jpeg", "image/webp"],
      keyConfigKeys: [],
      previewModes: ["image-metadata-summary"],
      executionModes: ["runtime-read", "runtime-write"],
    },
    discoverability: {
      scope: DataAssetDiscoverabilityScopes.default,
      defaultEntryPoint: false,
      inspectable: true,
    },
    schemaIntentId: "media",
  });

  const outputEntry = registry.register({
    asset: createImageManipulationOutputImageDatasetAsset(),
    specialization: DataAssetRegistrySpecializations.dataset,
    category: "image-manipulation",
    display: {
      title: "Image Manipulation Output Dataset",
      summary: "Generated images produced by image manipulation workflows.",
      tags: ["image", "output", "runtime"],
    },
    inspectability: {
      supportedSourceKinds: ["workflow-output", "dataset-instance"],
      supportedFileExtensions: [".png", ".jpg", ".jpeg", ".webp"],
      supportedMediaTypes: ["image/png", "image/jpeg", "image/webp"],
      keyConfigKeys: [],
      previewModes: ["image-metadata-summary"],
      executionModes: ["runtime-read", "runtime-write"],
    },
    discoverability: {
      scope: DataAssetDiscoverabilityScopes.advanced,
      defaultEntryPoint: false,
      inspectable: true,
    },
    schemaIntentId: "media",
  });

  const faceIdReferenceEntry = registry.register({
    asset: createImageManipulationFaceIdReferenceDatasetAsset(),
    specialization: DataAssetRegistrySpecializations.dataset,
    category: "image-manipulation",
    display: {
      title: "Image Manipulation FaceID Reference Dataset",
      summary: "Optional FaceID reference images used for identity-consistent conditioning.",
      tags: ["image", "faceid", "reference", "runtime", "optional"],
    },
    inspectability: {
      supportedSourceKinds: ["dataset-instance", "workflow-output"],
      supportedFileExtensions: [".png", ".jpg", ".jpeg", ".webp"],
      supportedMediaTypes: ["image/png", "image/jpeg", "image/webp"],
      keyConfigKeys: [],
      previewModes: ["image-metadata-summary"],
      executionModes: ["runtime-read", "runtime-write"],
    },
    discoverability: {
      scope: DataAssetDiscoverabilityScopes.advanced,
      defaultEntryPoint: false,
      inspectable: true,
    },
    schemaIntentId: "media",
  });

  return Object.freeze([inputEntry, outputEntry, faceIdReferenceEntry]);
}
