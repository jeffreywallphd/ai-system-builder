import {
  registerImageUploadApiRoute,
  type ExpressPostRoutePort,
  type RegisterImageUploadApiRouteDependencies,
} from "./image-upload/registerImageUploadApiRoute";

export type { ExpressPostRoutePort };

export function registerExpressApi(
  dependencies: RegisterImageUploadApiRouteDependencies,
): void {
  registerImageUploadApiRoute(dependencies);
}
