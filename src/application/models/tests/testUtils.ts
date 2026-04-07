import type { IInstalledModelCatalog } from "../../ports/interfaces/IInstalledModelCatalog";
import type { IModelInstaller } from "../../ports/interfaces/IModelInstaller";
import type { IRemoteModelCatalog } from "../../ports/interfaces/IRemoteModelCatalog";
import type { IModelCompatibilityService } from "../../../domain/services/interfaces/IModelCompatibilityService";

export function makeInstalledModelCatalog(overrides: Partial<IInstalledModelCatalog> = {}): IInstalledModelCatalog {
  return {
    listInstalled: async () => [],
    getInstalledById: async () => undefined,
    saveInstalled: async (model) => model,
    removeInstalled: async () => false,
    ...overrides,
  };
}

export function makeModelInstaller(overrides: Partial<IModelInstaller> = {}): IModelInstaller {
  return {
    canInstall: () => true,
    install: async ({ model, destination }) => ({ model, destination, status: "completed" }),
    startInstall: async ({ model, destination }) => ({
      operationId: "op",
      request: { model, destination },
      completionPromise: Promise.resolve({ model, destination, status: "completed" }),
      cancel: async () => undefined,
      onProgress: () => () => undefined,
    }),
    canUninstall: () => true,
    uninstall: async () => undefined,
    ...overrides,
  };
}

export function makeRemoteModelCatalog(overrides: Partial<IRemoteModelCatalog> = {}): IRemoteModelCatalog {
  return {
    supportsProvider: () => true,
    getById: async () => undefined,
    search: async () => ({ items: [] }),
    ...overrides,
  };
}

export function makeCompatibilityService(overrides: Partial<IModelCompatibilityService> = {}): IModelCompatibilityService {
  const compatible = { isCompatible: true, score: 1, reasons: Object.freeze([]), metadata: {} };
  return {
    evaluateModelToModelCompatibility: () => compatible,
    evaluateModelToProfileCompatibility: () => compatible,
    evaluateProfileToProfileCompatibility: () => compatible,
    evaluateDependencyCompatibility: () => compatible,
    evaluateRequirementCompatibility: () => compatible,
    evaluateModelReadiness: () => compatible,
    ...overrides,
  } as IModelCompatibilityService;
}
