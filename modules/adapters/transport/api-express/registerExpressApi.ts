import {
  registerImageUploadApiRoute,
  type RegisterImageUploadApiRouteDependencies,
} from "./image-upload/registerImageUploadApiRoute";
import {
  registerArtifactBrowserApiRoutes,
  type RegisterArtifactBrowserApiRoutesDependencies,
} from "./artifact-browser/registerArtifactBrowserApiRoutes";

export interface RegisterExpressApiDependencies {
  app: RegisterImageUploadApiRouteDependencies["app"] & RegisterArtifactBrowserApiRoutesDependencies["app"];
  storeImageUploadUseCase: RegisterImageUploadApiRouteDependencies["storeImageUploadUseCase"];
  browseArtifactsUseCase: RegisterArtifactBrowserApiRoutesDependencies["browseArtifactsUseCase"];
  readArtifactDetailUseCase: RegisterArtifactBrowserApiRoutesDependencies["readArtifactDetailUseCase"];
  readArtifactContentUseCase: RegisterArtifactBrowserApiRoutesDependencies["readArtifactContentUseCase"];
  artifactContentRetrieval: RegisterArtifactBrowserApiRoutesDependencies["artifactContentRetrieval"];
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
    artifactContentRetrieval: dependencies.artifactContentRetrieval,
  });
}
