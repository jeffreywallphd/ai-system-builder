import {
  registerImageUploadApiRoute,
  type RegisterImageUploadApiRouteDependencies,
} from "./image-upload/registerImageUploadApiRoute";

export function registerExpressApi(
  dependencies: RegisterImageUploadApiRouteDependencies,
): void {
  registerImageUploadApiRoute(dependencies);
}
