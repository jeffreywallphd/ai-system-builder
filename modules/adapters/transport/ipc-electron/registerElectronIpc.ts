import { registerDesktopArtifactIpc, type RegisterDesktopArtifactIpcDependencies } from "./registerDesktopArtifactIpc";
import { registerDesktopAssetIpc, type RegisterDesktopAssetIpcDependencies } from "./registerDesktopAssetIpc";
import { registerDesktopDatasetPreparationIpc, type RegisterDesktopDatasetPreparationIpcDependencies } from "./registerDesktopDatasetPreparationIpc";
import { registerDesktopImageGenerationIpc, type RegisterDesktopImageGenerationIpcDependencies } from "./registerDesktopImageGenerationIpc";
import { registerDesktopIngestionIpc, type RegisterDesktopIngestionIpcDependencies } from "./registerDesktopIngestionIpc";
import { registerDesktopModelIpc, type RegisterDesktopModelIpcDependencies } from "./registerDesktopModelIpc";
import { registerDesktopRuntimeIpc, type RegisterDesktopRuntimeIpcDependencies } from "./registerDesktopRuntimeIpc";
import { registerDesktopStartupIpc, type RegisterDesktopStartupIpcDependencies } from "./registerDesktopStartupIpc";
import { registerUserLibraryIpc, type RegisterUserLibraryIpcDependencies } from "./user-library/registerUserLibraryIpc";
export type { AsyncFeatureProvider, LazyProvidedObjectOptions } from "./lazyFeatureProvider";

export type DesktopIpcRegistrationMilestoneRecorder = (milestone: string) => void;

export interface RegisterElectronIpcDependencies {
  startup: RegisterDesktopStartupIpcDependencies;
  artifact: RegisterDesktopArtifactIpcDependencies;
  asset: RegisterDesktopAssetIpcDependencies;
  model: RegisterDesktopModelIpcDependencies;
  imageGeneration: RegisterDesktopImageGenerationIpcDependencies;
  runtime: RegisterDesktopRuntimeIpcDependencies;
  ingestion: RegisterDesktopIngestionIpcDependencies;
  datasetPreparation: RegisterDesktopDatasetPreparationIpcDependencies;
  userLibrary?: RegisterUserLibraryIpcDependencies;
  recordMilestone?: DesktopIpcRegistrationMilestoneRecorder;
}

function registerGroup(recordMilestone: DesktopIpcRegistrationMilestoneRecorder | undefined, milestone: string, register: () => void): void {
  recordMilestone?.(`desktop.host.ipc.${milestone}.register.before`);
  register();
  recordMilestone?.(`desktop.host.ipc.${milestone}.register.after`);
}

export function registerElectronIpc(dependencies: RegisterElectronIpcDependencies): void {
  registerGroup(dependencies.recordMilestone, "startup-group", () => registerDesktopStartupIpc(dependencies.startup));
  registerGroup(dependencies.recordMilestone, "artifact-group", () => registerDesktopArtifactIpc(dependencies.artifact));
  registerGroup(dependencies.recordMilestone, "asset-group", () => registerDesktopAssetIpc(dependencies.asset));
  registerGroup(dependencies.recordMilestone, "model-group", () => registerDesktopModelIpc(dependencies.model));
  registerGroup(dependencies.recordMilestone, "image-generation-group", () => registerDesktopImageGenerationIpc(dependencies.imageGeneration));
  registerGroup(dependencies.recordMilestone, "runtime-group", () => registerDesktopRuntimeIpc(dependencies.runtime));
  registerGroup(dependencies.recordMilestone, "ingestion-group", () => registerDesktopIngestionIpc(dependencies.ingestion));
  registerGroup(dependencies.recordMilestone, "dataset-preparation-group", () => registerDesktopDatasetPreparationIpc(dependencies.datasetPreparation));
  if (dependencies.userLibrary) {
    registerGroup(dependencies.recordMilestone, "user-library-group", () => registerUserLibraryIpc(dependencies.userLibrary!));
  }
}

export type {
  RegisterDesktopArtifactIpcDependencies,
  RegisterDesktopAssetIpcDependencies,
  RegisterDesktopDatasetPreparationIpcDependencies,
  RegisterDesktopImageGenerationIpcDependencies,
  RegisterDesktopIngestionIpcDependencies,
  RegisterDesktopModelIpcDependencies,
  RegisterDesktopRuntimeIpcDependencies,
  RegisterDesktopStartupIpcDependencies,
  RegisterUserLibraryIpcDependencies,
};
