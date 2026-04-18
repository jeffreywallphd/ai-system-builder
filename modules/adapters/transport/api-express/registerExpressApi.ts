import {
  registerImageUploadApiRoute,
  type RegisterImageUploadApiRouteDependencies,
} from "./image-upload/registerImageUploadApiRoute";
import {
  registerArtifactBrowserApiRoutes,
  type RegisterArtifactBrowserApiRoutesDependencies,
} from "./artifact-browser/registerArtifactBrowserApiRoutes";
import {
  registerArtifactRepoApiRoutes,
  type RegisterArtifactRepoApiRoutesDependencies,
} from "./artifact-repo/registerArtifactRepoApiRoutes";

export interface RegisterExpressApiDependencies {
  app: RegisterImageUploadApiRouteDependencies["app"]
    & RegisterArtifactBrowserApiRoutesDependencies["app"]
    & RegisterArtifactRepoApiRoutesDependencies["app"];
  getHuggingFaceTokenStatus: RegisterArtifactRepoApiRoutesDependencies["getHuggingFaceTokenStatus"];
  setHuggingFaceToken: RegisterArtifactRepoApiRoutesDependencies["setHuggingFaceToken"];
  clearHuggingFaceToken: RegisterArtifactRepoApiRoutesDependencies["clearHuggingFaceToken"];
  storeImageUploadUseCase: RegisterImageUploadApiRouteDependencies["storeImageUploadUseCase"];
  browseArtifactsUseCase: RegisterArtifactBrowserApiRoutesDependencies["browseArtifactsUseCase"];
  readArtifactDetailUseCase: RegisterArtifactBrowserApiRoutesDependencies["readArtifactDetailUseCase"];
  readArtifactContentUseCase: RegisterArtifactBrowserApiRoutesDependencies["readArtifactContentUseCase"];
  artifactMediaViewRetrieval: RegisterArtifactBrowserApiRoutesDependencies["artifactMediaViewRetrieval"];
  hasArtifactInRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["hasArtifactInRepoUseCase"];
  storeArtifactInRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["storeArtifactInRepoUseCase"];
  publishArtifactToRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["publishArtifactToRepoUseCase"];
  verifyPublishedArtifactBackingUseCase: RegisterArtifactRepoApiRoutesDependencies["verifyPublishedArtifactBackingUseCase"];
  verifyImportedArtifactSourceBackingUseCase: RegisterArtifactRepoApiRoutesDependencies["verifyImportedArtifactSourceBackingUseCase"];
  registerArtifactFromRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["registerArtifactFromRepoUseCase"];
  localizeArtifactFromRepoUseCase: RegisterArtifactRepoApiRoutesDependencies["localizeArtifactFromRepoUseCase"];
}

export function registerExpressApi(
  dependencies: RegisterExpressApiDependencies,
): void {
  registerImageUploadApiRoute({
    app: dependencies.app,
    storeImageUploadUseCase: dependencies.storeImageUploadUseCase,
  });

  registerArtifactBrowserApiRoutes({
    app: dependencies.app,
    browseArtifactsUseCase: dependencies.browseArtifactsUseCase,
    readArtifactDetailUseCase: dependencies.readArtifactDetailUseCase,
    readArtifactContentUseCase: dependencies.readArtifactContentUseCase,
    artifactMediaViewRetrieval: dependencies.artifactMediaViewRetrieval,
  });

  registerArtifactRepoApiRoutes({
    app: dependencies.app,
    getHuggingFaceTokenStatus: dependencies.getHuggingFaceTokenStatus,
    setHuggingFaceToken: dependencies.setHuggingFaceToken,
    clearHuggingFaceToken: dependencies.clearHuggingFaceToken,
    hasArtifactInRepoUseCase: dependencies.hasArtifactInRepoUseCase,
    storeArtifactInRepoUseCase: dependencies.storeArtifactInRepoUseCase,
    publishArtifactToRepoUseCase: dependencies.publishArtifactToRepoUseCase,
    verifyPublishedArtifactBackingUseCase: dependencies.verifyPublishedArtifactBackingUseCase,
    verifyImportedArtifactSourceBackingUseCase: dependencies.verifyImportedArtifactSourceBackingUseCase,
    registerArtifactFromRepoUseCase: dependencies.registerArtifactFromRepoUseCase,
    localizeArtifactFromRepoUseCase: dependencies.localizeArtifactFromRepoUseCase,
  });
}
