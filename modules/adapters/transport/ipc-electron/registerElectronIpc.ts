import {
  registerImageUploadIpc,
  type RegisterImageUploadIpcDependencies,
} from "./image-upload/registerImageUploadIpc";

export type {
  IpcMainHandlePort,
  StoreImageUploadUseCasePort,
} from "./image-upload/registerImageUploadIpc";
export {
  createDesktopImageUploadIpcHandler,
  mapIpcRequestPayload,
  mapStoreImageUploadResultToIpcResponse,
} from "./image-upload/registerImageUploadIpc";

export function registerElectronIpc(
  dependencies: RegisterImageUploadIpcDependencies,
): void {
  registerImageUploadIpc(dependencies);
}
