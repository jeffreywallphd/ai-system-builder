import {
  registerImageUploadIpc,
  type RegisterImageUploadIpcDependencies,
} from "./image-upload/registerImageUploadIpc";

export function registerElectronIpc(
  dependencies: RegisterImageUploadIpcDependencies,
): void {
  registerImageUploadIpc(dependencies);
}
