import type { DatasetPipelineStageKind } from "../../domain/dataset-studio/StagePipelineDomain";
import { StageAssetMappingService } from "./StageAssetMappingService";
import { getTransformationAssetRegistry } from "./TransformationAssetCatalog";
import {
  buildTransformationAssetConfigDescriptor,
  type TransformationAssetConfigUxDescriptor,
} from "./core/data/transformation";

export interface StageTransformationConfigDescriptor {
  readonly stageKind: DatasetPipelineStageKind;
  readonly assetId: string;
  readonly assetVersion: string;
  readonly configDefaults?: Readonly<Record<string, unknown>>;
  readonly descriptor: TransformationAssetConfigUxDescriptor;
}

export function listTransformationAssetConfigDescriptors(): ReadonlyArray<TransformationAssetConfigUxDescriptor> {
  const registry = getTransformationAssetRegistry();
  return Object.freeze(registry.list().map((entry) => buildTransformationAssetConfigDescriptor(entry.asset)));
}

export function resolveTransformationAssetConfigDescriptor(input: {
  readonly assetId: string;
  readonly assetVersion?: string;
}): TransformationAssetConfigUxDescriptor | undefined {
  const registry = getTransformationAssetRegistry();
  const entry = registry.get({
    id: input.assetId,
    version: input.assetVersion,
  });
  if (!entry) {
    return undefined;
  }
  return buildTransformationAssetConfigDescriptor(entry.asset);
}

export function listStageTransformationConfigDescriptors(input: {
  readonly stageKind: DatasetPipelineStageKind;
  readonly mappingService?: StageAssetMappingService;
}): ReadonlyArray<StageTransformationConfigDescriptor> {
  const mappingService = input.mappingService ?? new StageAssetMappingService();
  const mapping = mappingService.resolveStage({
    stageKind: input.stageKind,
  });
  if (mapping.status !== "resolved") {
    return Object.freeze([]);
  }

  const registry = getTransformationAssetRegistry();
  const descriptors: StageTransformationConfigDescriptor[] = [];
  for (const mappedAsset of mapping.assets) {
    const entry = registry.get({
      id: mappedAsset.assetId,
      version: mappedAsset.assetVersion,
    });
    if (!entry) {
      continue;
    }
    descriptors.push(Object.freeze({
      stageKind: input.stageKind,
      assetId: entry.asset.id,
      assetVersion: entry.asset.version,
      configDefaults: mappedAsset.configDefaults,
      descriptor: buildTransformationAssetConfigDescriptor(entry.asset),
    }));
  }

  return Object.freeze(descriptors);
}
