import { PrepareTrainingDatasetFromArtifactsUseCase } from "../../../application/use-cases";
import { asyncLazyObject } from "./lazyProxy";

export interface ComposeDesktopDatasetPreparationFeatureOptions {
  artifacts: any;
  runtime: any;
  getArtifactRemoteFeatures: () => Promise<any>;
  now?: () => string;
}

export function composeDesktopDatasetPreparationFeature(options: ComposeDesktopDatasetPreparationFeatureOptions): any {
  return {
    prepareTrainingDatasetUseCase: new PrepareTrainingDatasetFromArtifactsUseCase({
      runtimeTaskRegistry: options.runtime.runtimeTaskRegistry,
      storageBindings: options.artifacts.artifactBindings,
      storage: options.artifacts.storage,
      artifactRepoStorage: asyncLazyObject(async () => (await options.getArtifactRemoteFeatures()).artifactRepoStorage),
      artifactCatalog: options.artifacts.artifactCatalog,
      now: options.now,
      taskPowerLifecycle: options.runtime.taskPowerLifecycle,
      runtimeCapabilityGuard: options.runtime.runtimeCapabilityGuard,
    }),
  };
}
