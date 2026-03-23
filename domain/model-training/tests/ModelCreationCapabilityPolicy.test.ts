import { describe, expect, it } from "bun:test";
import { AppRuntimeModes } from "../../runtime/AppRuntimeMode";
import { ModelCreationCapabilityPolicy } from "../ModelCreationSupport";

const policy = new ModelCreationCapabilityPolicy();

describe("ModelCreationCapabilityPolicy", () => {
  it("supports both truthful paths in healthy desktop development mode", () => {
    const capability = policy.evaluate({
      environment: {
        runtimeMode: AppRuntimeModes.desktopDevelopment,
        runtimeStatus: "ready",
        desktopBridgeAvailable: true,
        canAccessLocalArtifacts: true,
        canRegisterPromotedModels: true,
      },
      inventory: {
        installedBaseModelCount: 2,
        localBaseModelCount: 2,
        datasetVersionCount: 3,
        supportedDatasetVersionCount: 3,
      },
      selection: {
        baseModel: { id: "base-1", name: "Base", accessMethod: "local-file" },
        datasetVersion: {
          datasetId: "dataset-1",
          datasetName: "Support",
          versionId: "version-1",
          versionLabel: "v1",
          taskType: "chat_completion",
        },
      },
    });

    expect(capability.state).toBe("available");
    expect(capability.paths.every((path) => path.state === "available")).toBeTrue();
  });

  it("keeps browser fallback truthful by allowing preparation while blocking local training", () => {
    const capability = policy.evaluate({
      environment: {
        runtimeMode: AppRuntimeModes.browserDevelopment,
        runtimeStatus: "ready",
        desktopBridgeAvailable: false,
        canAccessLocalArtifacts: false,
        canRegisterPromotedModels: false,
      },
      inventory: {
        installedBaseModelCount: 1,
        localBaseModelCount: 0,
        datasetVersionCount: 1,
        supportedDatasetVersionCount: 1,
      },
      selection: {
        baseModel: { id: "base-1", name: "Remote-like Base", accessMethod: "remote-download" },
        datasetVersion: {
          datasetId: "dataset-1",
          datasetName: "Support",
          versionId: "version-1",
          versionLabel: "v1",
          taskType: "chat_completion",
        },
      },
    });

    expect(capability.state).toBe("degraded");
    expect(capability.paths.find((path) => path.path === "export-preparation-only")?.state).toBe("available");
    expect(capability.paths.find((path) => path.path === "local-training")?.state).toBe("unavailable");
    expect(capability.recommendedNextSteps.map((step) => step.id)).toContain("switch-to-desktop-app");
  });

  it("blocks both paths when the runtime is disabled", () => {
    const capability = policy.evaluate({
      environment: {
        runtimeMode: AppRuntimeModes.desktopProduction,
        runtimeStatus: "disabled",
        runtimeDetail: "Python runtime is disabled in settings.",
        desktopBridgeAvailable: true,
        canAccessLocalArtifacts: true,
        canRegisterPromotedModels: true,
      },
      inventory: {
        installedBaseModelCount: 1,
        localBaseModelCount: 1,
        datasetVersionCount: 1,
        supportedDatasetVersionCount: 1,
      },
      selection: {
        baseModel: { id: "base-1", name: "Base", accessMethod: "local-file" },
        datasetVersion: {
          datasetId: "dataset-1",
          datasetName: "Support",
          versionId: "version-1",
          versionLabel: "v1",
          taskType: "question_answering",
        },
      },
    });

    expect(capability.state).toBe("unavailable");
    expect(capability.paths.every((path) => path.state === "unavailable")).toBeTrue();
    expect(capability.headline).toContain("unavailable");
  });

  it("keeps export available while marking unsupported dataset task types as local-training only blockers", () => {
    const capability = policy.evaluate({
      environment: {
        runtimeMode: AppRuntimeModes.desktopProduction,
        runtimeStatus: "ready",
        desktopBridgeAvailable: true,
        canAccessLocalArtifacts: true,
        canRegisterPromotedModels: true,
      },
      inventory: {
        installedBaseModelCount: 1,
        localBaseModelCount: 1,
        datasetVersionCount: 2,
        supportedDatasetVersionCount: 1,
      },
      selection: {
        baseModel: { id: "base-1", name: "Base", accessMethod: "local-file" },
        datasetVersion: {
          datasetId: "dataset-1",
          datasetName: "Labels",
          versionId: "version-1",
          versionLabel: "v1",
          taskType: "classification",
        },
      },
    });

    expect(capability.paths.find((path) => path.path === "export-preparation-only")?.state).toBe("available");
    expect(capability.paths.find((path) => path.path === "local-training")?.blockers.some((entry) => entry.code === "unsupported-dataset-task-type")).toBeTrue();
  });
});
