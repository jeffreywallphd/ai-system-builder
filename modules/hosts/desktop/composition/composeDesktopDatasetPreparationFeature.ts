import { PrepareTrainingDatasetFromArtifactsUseCase } from "../../../application/use-cases";
import { TaskType } from "../../../contracts/runtime";
import { asyncLazyObject } from "./lazyProxy";

export interface ComposeDesktopDatasetPreparationFeatureOptions {
  artifacts: any;
  runtime: any;
  getArtifactRemoteFeatures: () => Promise<any>;
  now?: () => string;
}

export function composeDesktopDatasetPreparationFeature(options: ComposeDesktopDatasetPreparationFeatureOptions): any {
  let disposed = false;
  return {
    dispose() { disposed = true; },
    get disposed() { return disposed; },
    async canDispose() {
      try {
        const active = await options.runtime.runtimeTaskRegistry.listTasks({ taskTypes: [TaskType.DATASET_PREPARATION], statuses: ["queued", "running", "unknown"] });
        const activeTaskCount = active.tasks.length;
        return activeTaskCount > 0 ? { blockedReason: "active-runtime-tasks", activeTaskCount } : undefined;
      } catch {
        return { blockedReason: "active-task-status-unavailable" };
      }
    },
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
