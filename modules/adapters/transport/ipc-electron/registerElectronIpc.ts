import {
  registerImageUploadIpc,
  type IpcMainHandlePort,
  type RegisterImageUploadIpcDependencies,
} from "./image-upload/registerImageUploadIpc";

export type { IpcMainHandlePort };

export function registerElectronIpc(
  dependencies: RegisterImageUploadIpcDependencies,
): void {
  registerImageUploadIpc(dependencies);
}
