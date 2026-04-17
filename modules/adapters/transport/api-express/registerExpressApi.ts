import {
  registerImageUploadApiRoute,
  type RegisterImageUploadApiRouteDependencies,
} from "./image-upload/registerImageUploadApiRoute";
import {
  registerArtifactBrowserApiRoutes,
  type RegisterArtifactBrowserApiRoutesDependencies,
} from "./artifact-browser/registerArtifactBrowserApiRoutes";

export interface RegisterExpressApiDependencies {
  app: {
    post: (
      path: string,
      handler: (request: unknown, response: unknown) => Promise<void>,
    ) => void;
  };
  storeImageUploadUseCase: RegisterImageUploadApiRouteDependencies["storeImageUploadUseCase"];
  artifactBrowserUseCases: RegisterArtifactBrowserApiRoutesDependencies["useCases"];
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
    useCases: dependencies.artifactBrowserUseCases,
  });
}
