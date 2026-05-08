import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import {
  DESKTOP_ARTIFACT_UPLOAD_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL,
  DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL,
  DESKTOP_RUNTIME_READINESS_READ_REQUEST_CHANNEL,
} from "../../../../contracts/ipc";
import { registerElectronIpc, type RegisterElectronIpcDependencies } from "../registerElectronIpc";

function dependencies(overrides: Partial<RegisterElectronIpcDependencies> = {}): RegisterElectronIpcDependencies {
  const execute = testDouble.fn(async () => ({ ok: true, value: {} }));
  return {
    ipcMain: { handle: testDouble.fn() },
    pythonRuntime: {
      startPythonRuntime: testDouble.fn(),
      stopPythonRuntime: testDouble.fn(),
      restartPythonRuntime: testDouble.fn(),
      unloadPythonRuntimeModel: testDouble.fn(),
      clearPythonRuntimeLogs: testDouble.fn(),
      readPythonRuntimeStatus: testDouble.fn(),
    },
    runtimeReadiness: {
      getReadinessSnapshot: testDouble.fn(),
      getCapabilityStatus: testDouble.fn(),
    },
    getHuggingFaceTokenStatus: testDouble.fn(),
    setHuggingFaceToken: testDouble.fn(),
    clearHuggingFaceToken: testDouble.fn(),
    storeArtifactUploadUseCase: { execute, getAcceptedUploadPolicy: testDouble.fn(() => ({ acceptedMediaTypes: [], acceptedExtensions: [] })) },
    browseArtifactsUseCase: { execute },
    browseUnregisteredArtifactsUseCase: { execute },
    registerUnregisteredArtifactUseCase: { execute },
    deleteUnregisteredArtifactUseCase: { execute },
    deleteRegisteredArtifactUseCase: { execute },
    readArtifactDetailUseCase: { execute },
    readArtifactContentUseCase: { execute },
    artifactMediaViewRetrieval: { retrieveArtifactViewerMediaByStorageKey: testDouble.fn() },
    publishArtifactToRepoUseCase: { execute },
    browseHuggingFaceNamespaceDatasetsUseCase: { execute },
    browseHuggingFaceDatasetParquetFilesUseCase: { execute },
    verifyPublishedArtifactBackingUseCase: { execute },
    verifyImportedArtifactSourceBackingUseCase: { execute },
    registerArtifactFromRepoUseCase: { execute },
    localizeArtifactFromRepoUseCase: { execute },
    ingestWebsitePageUseCase: { execute },
    ingestWebsitePagesBatchUseCase: { execute },
    prepareTrainingDatasetUseCase: {
      startPrepareTrainingDataset: execute,
      readPrepareTrainingDataset: execute,
      cancelPrepareTrainingDataset: execute,
    } as any,
    listSettingsDefinitionsUseCase: { execute },
    readSettingsUseCase: { execute },
    updateSettingUseCase: { execute },
    clearSettingUseCase: { execute },
    resolveModelDefaultUseCase: { execute },
    browseModelsUseCase: { execute },
    getModelDetailsUseCase: { execute },
    listModelsUseCase: { execute },
    saveModelReferenceUseCase: { execute },
    downloadModelUseCase: { execute },
    updateModelRecordUseCase: { execute },
    deleteModelRecordUseCase: { execute },
    trainModelUseCase: { execute, readStatus: execute } as any,
    validateModelUseCase: { execute },
    publishModelUseCase: { execute },
    generateImageUseCase: { execute },
    comfyUiInstaller: { ensureInstalled: testDouble.fn(), getInstallStatus: testDouble.fn(), repairInstall: testDouble.fn() },
    comfyUiInstallRoot: "/runtime/comfyui",
    ...overrides,
  } as RegisterElectronIpcDependencies;
}

describe("registerElectronIpc asset registry wiring", () => {
  it("registers asset registry channels only when a read port is supplied", () => {
    const withoutAssetChannels: string[] = [];
    registerElectronIpc(dependencies({
      ipcMain: { handle: testDouble.fn((channel: string) => withoutAssetChannels.push(channel)) },
    }));

    expect(withoutAssetChannels).toContain(DESKTOP_RUNTIME_READINESS_READ_REQUEST_CHANNEL.value);
    expect(withoutAssetChannels).toContain(DESKTOP_ARTIFACT_UPLOAD_REQUEST_CHANNEL.value);
    expect(withoutAssetChannels).not.toContain(DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL.value);

    const withAssetChannels: string[] = [];
    registerElectronIpc(dependencies({
      ipcMain: { handle: testDouble.fn((channel: string) => withAssetChannels.push(channel)) },
      assetRegistryRead: {
        listDefinitionCards: testDouble.fn(),
        readDefinitionDetail: testDouble.fn(),
      },
    }));

    expect(withAssetChannels).toContain(DESKTOP_ASSET_DEFINITIONS_LIST_REQUEST_CHANNEL.value);
    expect(withAssetChannels).toContain(DESKTOP_ASSET_DEFINITION_READ_REQUEST_CHANNEL.value);
    expect(withAssetChannels).toContain(DESKTOP_ASSET_DEFINITION_VERSION_READ_REQUEST_CHANNEL.value);
    expect(/asset\.(?:create|update|delete|register|seed|import|finalize|scan|execute)/i.test(withAssetChannels.join(" "))).toBe(false);
  });

  it("does not require mutation use cases or repositories for asset IPC handlers", () => {
    const deps = dependencies({
      assetRegistryRead: {
        listDefinitionCards: testDouble.fn(),
        readDefinitionDetail: testDouble.fn(),
      },
    });

    expect("assetRegistryRead" in deps).toBe(true);
    expect("assetRegistryMutation" in deps).toBe(false);
    expect("assetDefinitionRepository" in deps).toBe(false);
    expect("internalAssetRegistry" in deps).toBe(false);
  });
});
