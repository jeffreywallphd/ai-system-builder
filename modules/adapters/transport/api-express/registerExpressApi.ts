import {
  registerArtifactUploadApiRoute,
  type RegisterArtifactUploadApiRouteDependencies,
} from "./artifact-upload/registerArtifactUploadApiRoute";
import {
  registerArtifactBrowserApiRoutes,
  type RegisterArtifactBrowserApiRoutesDependencies,
} from "./artifact-browser/registerArtifactBrowserApiRoutes";
import {
  registerArtifactRepoApiRoutes,
  type RegisterArtifactRepoApiRoutesDependencies,
} from "./artifact-repo/registerArtifactRepoApiRoutes";
import { registerImageGenerationApiRoutes, type RegisterImageGenerationApiRoutesDependencies } from "./image-generation/registerImageGenerationApiRoutes";
import { registerModelManagementApiRoutes, type RegisterModelManagementApiRoutesDependencies } from "./model/registerModelManagementApiRoutes";
import { registerApplicationSettingsApiRoutes, type RegisterApplicationSettingsApiRoutesDependencies } from "./settings/registerApplicationSettingsApiRoutes";
import { registerServerControlApiRoutes, type RegisterServerControlApiRoutesDependencies } from "./server-control/registerServerControlApiRoutes";

export interface RegisterExpressApiDependencies {
  app: RegisterArtifactUploadApiRouteDependencies["app"]
    & RegisterArtifactBrowserApiRoutesDependencies["app"]
    & RegisterArtifactRepoApiRoutesDependencies["app"]
    & RegisterImageGenerationApiRoutesDependencies["app"]
    & RegisterModelManagementApiRoutesDependencies["app"]
    & RegisterApplicationSettingsApiRoutesDependencies["app"]
    & RegisterServerControlApiRoutesDependencies["app"];
  getHuggingFaceTokenStatus: RegisterArtifactRepoApiRoutesDependencies["getHuggingFaceTokenStatus"];
  setHuggingFaceToken: RegisterArtifactRepoApiRoutesDependencies["setHuggingFaceToken"];
  clearHuggingFaceToken: RegisterArtifactRepoApiRoutesDependencies["clearHuggingFaceToken"];
  storeArtifactUploadUseCase: RegisterArtifactUploadApiRouteDependencies["storeArtifactUploadUseCase"];
  browseArtifactsUseCase: RegisterArtifactBrowserApiRoutesDependencies["browseArtifactsUseCase"];
  readArtifactDetailUseCase: RegisterArtifactBrowserApiRoutesDependencies["readArtifactDetailUseCase"];
  readArtifactContentUseCase: RegisterArtifactBrowserApiRoutesDependencies["readArtifactContentUseCase"];
  artifactMediaViewRetrieval: RegisterArtifactBrowserApiRoutesDependencies["artifactMediaViewRetrieval"];
  deleteRegisteredArtifactUseCase: RegisterArtifactBrowserApiRoutesDependencies["deleteRegisteredArtifactUseCase"];
  hasArtifactInRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["hasArtifactInRepoUseCase"];
  browseHuggingFaceNamespaceDatasetsUseCase: RegisterArtifactRepoApiRoutesDependencies["browseHuggingFaceNamespaceDatasetsUseCase"];
  browseHuggingFaceDatasetParquetFilesUseCase: RegisterArtifactRepoApiRoutesDependencies["browseHuggingFaceDatasetParquetFilesUseCase"];
  storeArtifactInRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["storeArtifactInRepoUseCase"];
  publishArtifactToRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["publishArtifactToRepoUseCase"];
  verifyPublishedArtifactBackingUseCase: RegisterArtifactRepoApiRoutesDependencies["verifyPublishedArtifactBackingUseCase"];
  verifyImportedArtifactSourceBackingUseCase: RegisterArtifactRepoApiRoutesDependencies["verifyImportedArtifactSourceBackingUseCase"];
  registerArtifactFromRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["registerArtifactFromRepoUseCase"];
  localizeArtifactFromRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["localizeArtifactFromRepoUseCase"];
  generateImageUseCase: RegisterImageGenerationApiRoutesDependencies["generateImageUseCase"];
  imageGenerationFinalizationOrchestrator?: RegisterImageGenerationApiRoutesDependencies["imageGenerationFinalizationOrchestrator"];
  imageGenerationRuntimeControl?: RegisterImageGenerationApiRoutesDependencies["imageGenerationRuntimeControl"];
  browseModelsUseCase: RegisterModelManagementApiRoutesDependencies["browseModelsUseCase"];
  getModelDetailsUseCase: RegisterModelManagementApiRoutesDependencies["getModelDetailsUseCase"];
  listModelsUseCase: RegisterModelManagementApiRoutesDependencies["listModelsUseCase"];
  saveModelReferenceUseCase: RegisterModelManagementApiRoutesDependencies["saveModelReferenceUseCase"];
  downloadModelUseCase: RegisterModelManagementApiRoutesDependencies["downloadModelUseCase"];
  updateModelRecordUseCase: RegisterModelManagementApiRoutesDependencies["updateModelRecordUseCase"];
  deleteModelRecordUseCase: RegisterModelManagementApiRoutesDependencies["deleteModelRecordUseCase"];
  validateModelUseCase?: RegisterModelManagementApiRoutesDependencies["validateModelUseCase"];
  publishModelUseCase?: RegisterModelManagementApiRoutesDependencies["publishModelUseCase"]
  modelManagementLogger?: RegisterModelManagementApiRoutesDependencies["logger"];
  listSettingsDefinitionsUseCase?: RegisterApplicationSettingsApiRoutesDependencies["listSettingsDefinitionsUseCase"];
  readSettingsUseCase?: RegisterApplicationSettingsApiRoutesDependencies["readSettingsUseCase"];
  updateSettingUseCase?: RegisterApplicationSettingsApiRoutesDependencies["updateSettingUseCase"];
  clearSettingUseCase?: RegisterApplicationSettingsApiRoutesDependencies["clearSettingUseCase"];
  restartServer?: RegisterServerControlApiRoutesDependencies["restartServer"];
}

export function registerExpressApi(
  dependencies: RegisterExpressApiDependencies,
): void {
  registerArtifactUploadApiRoute({
    app: dependencies.app,
    storeArtifactUploadUseCase: dependencies.storeArtifactUploadUseCase,
  });

  registerArtifactBrowserApiRoutes({
    app: dependencies.app,
    browseArtifactsUseCase: dependencies.browseArtifactsUseCase,
    readArtifactDetailUseCase: dependencies.readArtifactDetailUseCase,
    readArtifactContentUseCase: dependencies.readArtifactContentUseCase,
    artifactMediaViewRetrieval: dependencies.artifactMediaViewRetrieval,
    deleteRegisteredArtifactUseCase: dependencies.deleteRegisteredArtifactUseCase,
  });

  registerArtifactRepoApiRoutes({
    app: dependencies.app,
    getHuggingFaceTokenStatus: dependencies.getHuggingFaceTokenStatus,
    setHuggingFaceToken: dependencies.setHuggingFaceToken,
    clearHuggingFaceToken: dependencies.clearHuggingFaceToken,
    hasArtifactInRepoUseCase: dependencies.hasArtifactInRepoUseCase,
    browseHuggingFaceNamespaceDatasetsUseCase: dependencies.browseHuggingFaceNamespaceDatasetsUseCase,
    browseHuggingFaceDatasetParquetFilesUseCase: dependencies.browseHuggingFaceDatasetParquetFilesUseCase,
    storeArtifactInRepoUseCase: dependencies.storeArtifactInRepoUseCase,
    publishArtifactToRepoUseCase: dependencies.publishArtifactToRepoUseCase,
    verifyPublishedArtifactBackingUseCase: dependencies.verifyPublishedArtifactBackingUseCase,
    verifyImportedArtifactSourceBackingUseCase: dependencies.verifyImportedArtifactSourceBackingUseCase,
    registerArtifactFromRepoUseCase: dependencies.registerArtifactFromRepoUseCase,
    localizeArtifactFromRepoUseCase: dependencies.localizeArtifactFromRepoUseCase,
  });

  registerModelManagementApiRoutes({
    app: dependencies.app,
    browseModelsUseCase: dependencies.browseModelsUseCase,
    getModelDetailsUseCase: dependencies.getModelDetailsUseCase,
    listModelsUseCase: dependencies.listModelsUseCase,
    saveModelReferenceUseCase: dependencies.saveModelReferenceUseCase,
    downloadModelUseCase: dependencies.downloadModelUseCase,
    updateModelRecordUseCase: dependencies.updateModelRecordUseCase,
    deleteModelRecordUseCase: dependencies.deleteModelRecordUseCase,
    validateModelUseCase: dependencies.validateModelUseCase,
    publishModelUseCase: dependencies.publishModelUseCase,
    logger: dependencies.modelManagementLogger,
  });

  registerImageGenerationApiRoutes({
    app: dependencies.app,
    generateImageUseCase: dependencies.generateImageUseCase,
    imageGenerationFinalizationOrchestrator: dependencies.imageGenerationFinalizationOrchestrator,
    imageGenerationRuntimeControl: dependencies.imageGenerationRuntimeControl,
  });

  if (
    dependencies.listSettingsDefinitionsUseCase
    && dependencies.readSettingsUseCase
    && dependencies.updateSettingUseCase
    && dependencies.clearSettingUseCase
  ) {
    registerApplicationSettingsApiRoutes({
      app: dependencies.app,
      listSettingsDefinitionsUseCase: dependencies.listSettingsDefinitionsUseCase,
      readSettingsUseCase: dependencies.readSettingsUseCase,
      updateSettingUseCase: dependencies.updateSettingUseCase,
      clearSettingUseCase: dependencies.clearSettingUseCase,
    });
  }

  registerServerControlApiRoutes({
    app: dependencies.app,
    restartServer: dependencies.restartServer,
  });
}
