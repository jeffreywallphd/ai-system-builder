import { registerComfyUiRuntimeIpc } from "./comfyui-runtime/registerComfyUiRuntimeIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";
import { lazyProvidedObject, type AsyncFeatureProvider } from "./lazyFeatureProvider";

export interface RegisterDesktopRuntimeIpcDependencies {
  ipcMain: IpcMainHandlePort;
  getComfyUiFeature: AsyncFeatureProvider<any>;
}

export function registerDesktopRuntimeIpc(dependencies: RegisterDesktopRuntimeIpcDependencies): void {
  registerComfyUiRuntimeIpc({
    ipcMain: dependencies.ipcMain,
    installer: lazyProvidedObject(dependencies.getComfyUiFeature, (feature) => feature.installer),
    getInstallRoot: async () => (await dependencies.getComfyUiFeature()).installRoot,
  });
}
