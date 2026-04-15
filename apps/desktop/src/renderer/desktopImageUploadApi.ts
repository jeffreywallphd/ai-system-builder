import type { DesktopImageUploadResponse } from "../../../../modules/contracts/ipc";

export interface DesktopImageUploadApi {
  uploadImage: (input: {
    fileName: string;
    mediaType: string;
    bytes: Uint8Array;
  }) => Promise<DesktopImageUploadResponse>;
}

declare global {
  interface Window {
    desktopApi?: DesktopImageUploadApi;
  }
}

export function getDesktopImageUploadApi(): DesktopImageUploadApi {
  if (!window.desktopApi) {
    throw new Error("Desktop preload API is unavailable.");
  }

  return window.desktopApi;
}
